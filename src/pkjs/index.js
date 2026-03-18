'use strict';

// -----------------------------------------------------------------------------
// Module wiring
// -----------------------------------------------------------------------------

var constants = require('./constants');
var configuration = require('./configuration');
var staticScreens = require('./static-screens');
var textUtils = require('./text-utils');
var runtimeValues = require('./runtime-values');
var graphSchema = require('./graph-schema');
var renderRuntime = require('./render-runtime');
var openaiRuntime = require('./openai-runtime');
var graphRuntime = require('./graph-runtime');
var inputRuntime = require('./input-runtime');
var transportRuntime = require('./transport-runtime');
var configurationRuntime = require('./configuration-runtime');

var MSG_TYPE_ACTION = constants.MSG_TYPE_ACTION;
var ACTION_TYPE_READY = constants.ACTION_TYPE_READY;
var ACTION_TYPE_SELECT = constants.ACTION_TYPE_SELECT;
var ACTION_TYPE_BACK = constants.ACTION_TYPE_BACK;
var ACTION_TYPE_VOICE = constants.ACTION_TYPE_VOICE;
var MAX_BODY_LEN = constants.MAX_BODY_LEN;
var MAX_SCROLL_BODY_LEN = constants.MAX_SCROLL_BODY_LEN;
var VOICE_INPUT_ITEM_ID = constants.VOICE_INPUT_ITEM_ID;
var VOICE_ERROR_ITEM_ID = constants.VOICE_ERROR_ITEM_ID;
var VOICE_NOT_SUPPORTED_ITEM_ID = constants.VOICE_NOT_SUPPORTED_ITEM_ID;
var OPENAI_API_URL = constants.OPENAI_API_URL;
var OPENAI_DEFAULT_MODEL = constants.OPENAI_DEFAULT_MODEL;
var STORAGE_IMPORTED_SCHEMA_JSON = constants.STORAGE_IMPORTED_SCHEMA_JSON;
var STORAGE_OPENAI_TOKEN = constants.STORAGE_OPENAI_TOKEN;
var STORAGE_OPENAI_MODEL = constants.STORAGE_OPENAI_MODEL;
var LATEST_SDUI_SCHEMA_VERSION = constants.LATEST_SDUI_SCHEMA_VERSION;
var MAX_HOOK_REDIRECTS = 8;

var sanitizeText = textUtils.sanitizeText;
var limitText = textUtils.limitText;
var parseNumber = textUtils.parseNumber;

var normalizeCanonicalGraph = graphSchema.normalizeCanonicalGraph;
var getAgentConfig = configuration.getAgentConfig;
var buildConfigurationUrl = configuration.buildConfigurationUrl;
var parseConfigurationResponse = configuration.parseConfigurationResponse;

// -----------------------------------------------------------------------------
// Runtime state
// -----------------------------------------------------------------------------

var state = {
  activeGraph: staticScreens,
  activeGraphSource: 'static',
  currentScreenId: null,
  currentScreenDefinition: null,
  currentRenderedScreen: null,
  history: [],
  currentCardActionsById: {},
  currentMenuActionsById: {},
  vars: {},
  screenTimerId: null,
  screenTimerDeadline: 0,
  liveRenderTimer: null,
  pendingEffectVibe: '',
  pendingEffectLight: false,
  pendingDictation: null,
  agent: {
    requestNonce: 0,
    activeRequest: null,
    awaiting: false,
    conversationStarted: false,
    conversationId: '',
    turnIndex: 0
  }
};

var OPENAI_SYSTEM_PROMPT = openaiRuntime.buildSystemPrompt(LATEST_SDUI_SCHEMA_VERSION);

// -----------------------------------------------------------------------------
// Screen rendering and navigation
// -----------------------------------------------------------------------------

function resolveScreenInGraph(graph, screenId) {
  if (!graph || !graph.screens || !screenId) {
    return null;
  }

  return graph.screens[screenId] || null;
}

function getEntryScreenId(graph) {
  if (!graph || !graph.entryScreenId) {
    return '';
  }

  return String(graph.entryScreenId);
}

function setActiveGraph(graph, source) {
  state.activeGraph = graph;
  state.activeGraphSource = source || 'static';
}

function pushCurrentHistoryEntry() {
  if (!state.currentScreenId || !state.activeGraph) {
    return;
  }

  state.history.push({
    graph: state.activeGraph,
    source: state.activeGraphSource,
    screenId: state.currentScreenId
  });
}

function clearLiveRenderTimer() {
  if (!state.liveRenderTimer) {
    return;
  }

  clearTimeout(state.liveRenderTimer);
  state.liveRenderTimer = null;
}

function clearScreenTimer() {
  if (!state.screenTimerId) {
    state.screenTimerDeadline = 0;
    return;
  }

  clearTimeout(state.screenTimerId);
  state.screenTimerId = null;
  state.screenTimerDeadline = 0;
}

function getScreenTimerRemainingSeconds() {
  if (!state.screenTimerDeadline) {
    return 0;
  }

  return Math.max(0, Math.ceil((state.screenTimerDeadline - Date.now()) / 1000));
}

function sanitizeVarKey(key) {
  return runtimeValues.sanitizeVarKey(key);
}

function readGraphStorageMap(graph) {
  return renderRuntime.readGraphStorageMap(localStorage, graph, { logger: console });
}

function writeGraphStorageMap(graph, nextStorage) {
  return renderRuntime.writeGraphStorageMap(localStorage, graph, nextStorage, { logger: console });
}

function evaluateRunCondition(condition) {
  return runtimeValues.evaluateCondition(condition, state.vars);
}

function applySetVar(run) {
  var nextVars = runtimeValues.applySetVar(run, state.vars);
  if (!nextVars) {
    return false;
  }

  state.vars = nextVars;
  return true;
}

function queueRunEffects(run) {
  if (!run || typeof run !== 'object') {
    return;
  }

  if (run.vibe) {
    state.pendingEffectVibe = String(run.vibe);
  }
  if (run.light) {
    state.pendingEffectLight = true;
  }
}

function applyStore(run, screen) {
  if (!run || typeof run !== 'object') {
    return false;
  }

  var key = sanitizeVarKey(run.key);
  var rawValue = run.value === undefined || run.value === null ? '' : String(run.value);
  if (!key || !rawValue) {
    return false;
  }

  var nextStorage = readGraphStorageMap(state.activeGraph);
  var appliedStorage = runtimeValues.applyStore(
    run,
    screen || state.currentScreenDefinition || state.currentRenderedScreen || {},
    state.vars,
    nextStorage,
    {
      timer: {
        remaining: getScreenTimerRemainingSeconds()
      },
      now: new Date()
    }
  );
  if (!appliedStorage) {
    return false;
  }
  nextStorage = appliedStorage;
  return writeGraphStorageMap(state.activeGraph, nextStorage);
}

function applyScreenBindings(screen) {
  return renderRuntime.applyScreenBindings(screen, {
    vars: state.vars,
    storage: readGraphStorageMap(state.activeGraph),
    timerRemaining: getScreenTimerRemainingSeconds(),
    now: new Date()
  });
}

function prepareScreenForRender(screen) {
  return renderRuntime.prepareScreenForRender(screen, {
    activeGraphSource: state.activeGraphSource
  });
}

function clearPendingEffects() {
  state.pendingEffectVibe = '';
  state.pendingEffectLight = false;
}

function sendNavigationError(targetScreen) {
  sendRender({
    id: 'nav-error',
    type: 'card',
    title: 'Navigation Error',
    body: limitText('Screen not found: ' + targetScreen, MAX_BODY_LEN)
  });
}

function getGraphRuntimeDeps() {
  return {
    applySetVar: applySetVar,
    applyStore: applyStore,
    clearPendingEffects: clearPendingEffects,
    evaluateRunCondition: evaluateRunCondition,
    getActiveGraphSource: function() {
      return state.activeGraphSource;
    },
    getCurrentRenderedScreen: function() {
      return state.currentRenderedScreen;
    },
    getCurrentScreenDefinition: function() {
      return state.currentScreenDefinition;
    },
    leaveAgentConversation: leaveAgentConversation,
    log: function() {
      console.log.apply(console, arguments);
    },
    maxHookRedirects: MAX_HOOK_REDIRECTS,
    pushCurrentHistoryEntry: pushCurrentHistoryEntry,
    queueRunEffects: queueRunEffects,
    renderAgentStatusCard: renderAgentStatusCard,
    resolveScreenInGraph: resolveScreenInGraph,
    resetAgentConversation: resetAgentConversation,
    sanitizeVarKey: sanitizeVarKey,
    sendNavigationError: sendNavigationError,
    sendRender: sendRender,
    setActiveGraph: setActiveGraph,
    setPendingDictation: function(nextPendingDictation) {
      state.pendingDictation = nextPendingDictation;
    },
    submitAgentTextInput: submitAgentTextInput,
    transitionTo: transitionTo
  };
}

function getInputRuntimeDeps() {
  return {
    activateGraph: activateGraph,
    actionTypeBack: ACTION_TYPE_BACK,
    actionTypeReady: ACTION_TYPE_READY,
    actionTypeSelect: ACTION_TYPE_SELECT,
    actionTypeVoice: ACTION_TYPE_VOICE,
    applySetVar: applySetVar,
    clearPendingDictation: function() {
      state.pendingDictation = null;
    },
    clearScreenTimer: clearScreenTimer,
    executeTypedAction: executeTypedAction,
    getActiveGraph: function() {
      return state.activeGraph;
    },
    getActiveGraphSource: function() {
      return state.activeGraphSource;
    },
    getCurrentCardActionsById: function() {
      return state.currentCardActionsById;
    },
    getCurrentMenuActionsById: function() {
      return state.currentMenuActionsById;
    },
    getCurrentRenderedScreen: function() {
      return state.currentRenderedScreen;
    },
    getCurrentScreenDefinition: function() {
      return state.currentScreenDefinition;
    },
    getHistoryLength: function() {
      return state.history.length;
    },
    getPendingDictation: function() {
      return state.pendingDictation;
    },
    getStaticGraph: function() {
      return staticScreens;
    },
    leaveAgentConversation: leaveAgentConversation,
    limitText: limitText,
    maxScrollBodyLen: MAX_SCROLL_BODY_LEN,
    msgTypeAction: MSG_TYPE_ACTION,
    parseNumber: parseNumber,
    popHistoryEntry: function() {
      return state.history.pop();
    },
    pushCurrentHistoryEntry: pushCurrentHistoryEntry,
    resetAgentConversation: resetAgentConversation,
    resetHistory: function() {
      state.history = [];
    },
    resetVars: function() {
      state.vars = {};
    },
    restoreHistoryEntry: restoreHistoryEntry,
    sanitizeText: sanitizeText,
    sanitizeVarKey: sanitizeVarKey,
    sendRender: sendRender,
    setCurrentScreenId: function(screenId) {
      state.currentScreenId = screenId;
    },
    submitAgentTextInput: submitAgentTextInput,
    submitAgentVoice: submitAgentVoice,
    transitionTo: transitionTo,
    tryRenderImportedSchemaFromStorage: tryRenderImportedSchemaFromStorage,
    voiceErrorItemId: VOICE_ERROR_ITEM_ID,
    voiceInputItemId: VOICE_INPUT_ITEM_ID,
    voiceNotSupportedItemId: VOICE_NOT_SUPPORTED_ITEM_ID
  };
}

function getTransportRuntimeDeps() {
  return {
    applyScreenBindings: applyScreenBindings,
    clearLiveRenderTimer: clearLiveRenderTimer,
    clearPendingEffects: clearPendingEffects,
    clearScreenTimer: clearScreenTimer,
    executeTypedAction: executeTypedAction,
    getCurrentScreenDefinition: function() {
      return state.currentScreenDefinition;
    },
    getCurrentScreenId: function() {
      return state.currentScreenId;
    },
    getPendingEffects: function() {
      return {
        vibe: state.pendingEffectVibe,
        light: state.pendingEffectLight
      };
    },
    getScreenTimerDeadline: function() {
      return state.screenTimerDeadline;
    },
    log: function() {
      console.log.apply(console, arguments);
    },
    now: Date.now,
    prepareScreenForRender: prepareScreenForRender,
    sendAppMessage: function(payload, onSuccess, onError) {
      Pebble.sendAppMessage(payload, onSuccess, onError);
    },
    sendRender: sendRender,
    setCurrentCardActionsById: function(nextActions) {
      state.currentCardActionsById = nextActions;
    },
    setCurrentMenuActionsById: function(nextActions) {
      state.currentMenuActionsById = nextActions;
    },
    setCurrentRenderedScreen: function(screen) {
      state.currentRenderedScreen = screen;
    },
    setCurrentScreenDefinition: function(screen) {
      state.currentScreenDefinition = screen;
    },
    setCurrentScreenId: function(screenId) {
      state.currentScreenId = screenId;
    },
    setLiveRenderTimer: function(timerId) {
      state.liveRenderTimer = timerId;
    },
    setScreenTimerDeadline: function(deadline) {
      state.screenTimerDeadline = deadline;
    },
    setScreenTimerId: function(timerId) {
      state.screenTimerId = timerId;
    },
    setTimeout: setTimeout
  };
}

function getConfigurationRuntimeDeps() {
  return {
    activateGraph: activateGraph,
    defaultOpenAIModel: OPENAI_DEFAULT_MODEL,
    getAgentConfig: getAgentConfig,
    getCurrentScreenId: function() {
      return state.currentScreenId;
    },
    getStaticGraph: function() {
      return staticScreens;
    },
    importedSchemaStorageKey: STORAGE_IMPORTED_SCHEMA_JSON,
    log: function() {
      console.log.apply(console, arguments);
    },
    normalizeCanonicalGraph: normalizeCanonicalGraph,
    openaiModelStorageKey: STORAGE_OPENAI_MODEL,
    openaiTokenStorageKey: STORAGE_OPENAI_TOKEN,
    renderAgentStatusCard: renderAgentStatusCard,
    renderImportError: renderImportError,
    resetHistory: function() {
      state.history = [];
    },
    sanitizeText: sanitizeText,
    storage: localStorage
  };
}

function scheduleLiveRender(screenId, refreshMs) {
  transportRuntime.scheduleLiveRender(screenId, refreshMs, getTransportRuntimeDeps());
}

function syncScreenTimer(screen, resetTimer) {
  transportRuntime.syncScreenTimer(screen, resetTimer, getTransportRuntimeDeps());
}

function executeTypedAction(run, source) {
  return graphRuntime.executeTypedAction(run, source, getGraphRuntimeDeps());
}

function executeHookRun(run, screen) {
  return graphRuntime.executeHookRun(run, screen, getGraphRuntimeDeps());
}

function executeHookRuns(runs, screen) {
  return graphRuntime.executeHookRuns(runs, screen, getGraphRuntimeDeps());
}

function sendRender(screen, options) {
  transportRuntime.sendRender(screen, options, getTransportRuntimeDeps());
}

function renderGraphScreen(graph, source, screenId, pushHistory) {
  return graphRuntime.renderGraphScreen(graph, source, screenId, pushHistory, getGraphRuntimeDeps());
}

function transitionTo(screenId, pushHistory) {
  return renderGraphScreen(state.activeGraph, state.activeGraphSource, screenId, pushHistory);
}

function activateGraph(graph, source, pushHistory) {
  return renderGraphScreen(graph, source, getEntryScreenId(graph), pushHistory);
}

function restoreHistoryEntry(entry) {
  if (!entry || !entry.graph || !entry.screenId) {
    return false;
  }

  return renderGraphScreen(entry.graph, entry.source, entry.screenId, false);
}

function getSelectedItemFromAction(action, menuScreen) {
  return inputRuntime.getSelectedItemFromAction(action, menuScreen);
}

function getWatchProfile() {
  var profile = {
    platform: '',
    supportsColour: true,
    screenWidth: 144,
    screenHeight: 168
  };

  if (!Pebble.getActiveWatchInfo) {
    return profile;
  }

  var info = Pebble.getActiveWatchInfo();
  if (!info || !info.platform) {
    return profile;
  }

  profile.platform = info.platform;

  if (info.platform === 'aplite' || info.platform === 'diorite') {
    profile.supportsColour = false;
    profile.screenWidth = 144;
    profile.screenHeight = 168;
  } else if (info.platform === 'chalk') {
    profile.supportsColour = true;
    profile.screenWidth = 180;
    profile.screenHeight = 180;
  } else if (info.platform === 'emery') {
    profile.supportsColour = true;
    profile.screenWidth = 200;
    profile.screenHeight = 228;
  } else {
    profile.supportsColour = true;
    profile.screenWidth = 144;
    profile.screenHeight = 168;
  }

  return profile;
}

// -----------------------------------------------------------------------------
// Agent lifecycle helpers
// -----------------------------------------------------------------------------

function cancelAgentRequest() {
  if (!state.agent.activeRequest) {
    return;
  }

  try {
    state.agent.activeRequest.abort();
  } catch (error) {
    console.log('Abort request failed:', error && error.message ? error.message : error);
  }

  state.agent.activeRequest = null;
  state.agent.awaiting = false;
}

function clearAgentTurnState() {
  state.currentRenderedScreen = null;
}

function resetAgentConversation(resetConversationId) {
  cancelAgentRequest();
  clearAgentTurnState();
  state.agent.conversationStarted = false;

  if (resetConversationId) {
    state.agent.conversationId = '';
  }
}

function renderAgentStatusCard(title, body) {
  state.agent.turnIndex++;
  state.activeGraphSource = 'agent';
  sendRender({
    id: 'agent-status-' + state.agent.turnIndex,
    type: 'card',
    title: limitText(title || 'Agent', MAX_TITLE_LEN),
    body: body || ''
  });
}

function pruneAgentHistory() {
  state.history = state.history.filter(function(entry) {
    return entry && entry.source !== 'agent';
  });
}

function renderAgentGraph(graph) {
  pruneAgentHistory();
  activateGraph(graph, 'agent', false);
}

function renderAgentFallback(text) {
  clearAgentTurnState();
  state.agent.turnIndex++;
  state.activeGraphSource = 'agent';
  sendRender({
    id: 'agent-fallback-' + state.agent.turnIndex,
    type: 'card',
    title: 'Agent Response',
    body: limitText(text || 'No structured response.', MAX_BODY_LEN)
  });
}

function renderImportError(message) {
  sendRender({
    id: 'import-error',
    type: 'card',
    title: 'Import Error',
    body: limitText(message || 'Invalid imported schema.', MAX_BODY_LEN),
    actions: [{ slot: 'select', id: 'import-error-root', icon: 'check', run: { type: 'navigate', screen: getEntryScreenId(staticScreens) } }]
  });
}

function parseImportedGraphFromJson(schemaJson) {
  return configurationRuntime.parseImportedGraphFromJson(schemaJson, getConfigurationRuntimeDeps());
}

function tryRenderImportedSchemaFromStorage() {
  return configurationRuntime.tryRenderImportedSchemaFromStorage(getConfigurationRuntimeDeps());
}

// -----------------------------------------------------------------------------
// OpenAI IO
// -----------------------------------------------------------------------------

function postJson(url, token, body, onDone) {
  return openaiRuntime.postJson(function() {
    return new XMLHttpRequest();
  }, url, token, body, onDone);
}

function buildOpenAIContext(userText, reason) {
  return openaiRuntime.buildOpenAIContext({
    schemaVersion: LATEST_SDUI_SCHEMA_VERSION,
    conversationId: state.agent.conversationId || '',
    reason: reason || 'user_input',
    userText: userText || '',
    vars: state.vars,
    storage: readGraphStorageMap(state.activeGraph),
    watch: getWatchProfile(),
    now: new Date()
  });
}

function buildOpenAIRequestBody(config, userText, reason) {
  return openaiRuntime.buildOpenAIRequestBody({
    model: config.openaiModel,
    instructions: OPENAI_SYSTEM_PROMPT,
    context: buildOpenAIContext(userText, reason),
    previousResponseId: state.agent.conversationId
  });
}

function extractFirstJsonObject(text) {
  return openaiRuntime.extractFirstJsonObject(text);
}

function extractOpenAIOutputText(response) {
  return openaiRuntime.extractOpenAIOutputText(response);
}

function queryAgent(userText, reason) {
  var config = getAgentConfig();
  if (!config.openaiToken) {
    renderAgentStatusCard('Agent Setup', 'Open settings and paste your OpenAI key.');
    return;
  }

  cancelAgentRequest();
  clearAgentTurnState();

  var requestNonce = ++state.agent.requestNonce;
  var requestBody = buildOpenAIRequestBody(config, userText, reason);

  state.agent.awaiting = true;
  renderAgentStatusCard('Agent', 'Thinking...');

  console.log('OpenAI request model:', config.openaiModel);
  console.log('OpenAI request reason:', sanitizeText(reason || 'user_input'));

  state.agent.activeRequest = postJson(OPENAI_API_URL, config.openaiToken, requestBody, function(error, response) {
    if (requestNonce !== state.agent.requestNonce) {
      return;
    }

    state.agent.activeRequest = null;
    state.agent.awaiting = false;

    if (state.activeGraphSource !== 'agent') {
      return;
    }

    if (error) {
      renderAgentStatusCard('OpenAI Error', error);
      return;
    }

    if (!response || typeof response !== 'object') {
      renderAgentFallback('OpenAI returned empty response.');
      return;
    }

    var responseText = sanitizeText(extractOpenAIOutputText(response));
    if (!responseText) {
      renderAgentFallback('OpenAI returned no text output.');
      return;
    }

    var jsonText = extractFirstJsonObject(responseText);
    if (!jsonText) {
      renderAgentFallback(responseText);
      return;
    }

    var parsedGraph;
    try {
      parsedGraph = JSON.parse(jsonText);
    } catch (parseError) {
      renderAgentFallback('OpenAI JSON parse error: ' + parseError.message);
      return;
    }

    var normalized = normalizeCanonicalGraph(parsedGraph);
    if (!normalized) {
      renderAgentFallback('OpenAI response did not match canonical graph schema.');
      return;
    }

    if (response.id) {
      state.agent.conversationId = String(response.id);
    }

    renderAgentGraph(normalized);
  });
}

function ensureAgentConversationStarted() {
  if (!state.agent.conversationStarted) {
    pushCurrentHistoryEntry();
    state.agent.conversationStarted = true;
  }
}

function submitAgentTextInput(userText, reason) {
  ensureAgentConversationStarted();
  queryAgent(userText, reason);
}

function submitAgentVoice(transcript) {
  var text = sanitizeText(transcript);
  if (!text) {
    renderAgentStatusCard('Voice', 'No transcript captured. Try again.');
    return;
  }

  submitAgentTextInput('User said: ' + text, 'voice_transcript');
}

function leaveAgentConversation() {
  cancelAgentRequest();
  clearAgentTurnState();
  state.agent.conversationStarted = false;
  state.agent.conversationId = '';
}

// -----------------------------------------------------------------------------
// Input handling
// -----------------------------------------------------------------------------

function handleBack() {
  inputRuntime.handleBack(getInputRuntimeDeps());
}

function handleMenuSelect(action) {
  inputRuntime.handleMenuSelect(action, getInputRuntimeDeps());
}

function handleMenuActionSelect(action) {
  return inputRuntime.handleMenuActionSelect(action, getInputRuntimeDeps());
}

function handleCardActionSelect(action) {
  return inputRuntime.handleCardActionSelect(action, getInputRuntimeDeps());
}

function handleSelect(action) {
  inputRuntime.handleSelect(action, getInputRuntimeDeps());
}

function handleVoiceAction(action) {
  inputRuntime.handleVoiceAction(action, getInputRuntimeDeps());
}

function handleActionMessage(payload) {
  inputRuntime.handleActionMessage(payload, getInputRuntimeDeps());
}

function applyConfigurationFromPayload(payload) {
  configurationRuntime.applyConfigurationFromPayload(payload, getConfigurationRuntimeDeps());
}

// -----------------------------------------------------------------------------
// Pebble event bridge
// -----------------------------------------------------------------------------

Pebble.addEventListener('showConfiguration', function() {
  Pebble.openURL(buildConfigurationUrl());
});

Pebble.addEventListener('webviewclosed', function(event) {
  var payload = parseConfigurationResponse(event);
  if (!payload) {
    return;
  }

  applyConfigurationFromPayload(payload);
});

Pebble.addEventListener('ready', function() {
  configurationRuntime.handleReady(getConfigurationRuntimeDeps());
});

Pebble.addEventListener('appmessage', function(event) {
  var payload = event && event.payload ? event.payload : {};
  handleActionMessage(payload);
});
