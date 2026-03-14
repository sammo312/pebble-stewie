'use strict';

// -----------------------------------------------------------------------------
// Module wiring
// -----------------------------------------------------------------------------

var constants = require('./constants');
var staticScreens = require('./static-screens');
var textUtils = require('./text-utils');
var screenActions = require('./screen-actions');
var graphSchema = require('./graph-schema');

var MSG_TYPE_RENDER = constants.MSG_TYPE_RENDER;
var MSG_TYPE_ACTION = constants.MSG_TYPE_ACTION;
var UI_TYPE_MENU = constants.UI_TYPE_MENU;
var UI_TYPE_CARD = constants.UI_TYPE_CARD;
var UI_TYPE_SCROLL = constants.UI_TYPE_SCROLL;
var ACTION_TYPE_READY = constants.ACTION_TYPE_READY;
var ACTION_TYPE_SELECT = constants.ACTION_TYPE_SELECT;
var ACTION_TYPE_BACK = constants.ACTION_TYPE_BACK;
var ACTION_TYPE_VOICE = constants.ACTION_TYPE_VOICE;
var MAX_TITLE_LEN = constants.MAX_TITLE_LEN;
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
var SDUI_SCHEMA_VERSION = constants.SDUI_SCHEMA_VERSION;

var sanitizeText = textUtils.sanitizeText;
var limitText = textUtils.limitText;
var parseNumber = textUtils.parseNumber;

var normalizeScreenActions = screenActions.normalizeScreenActions;
var normalizeMenuActions = screenActions.normalizeMenuActions;
var encodeActions = screenActions.encodeActions;
var encodeMenuActions = screenActions.encodeMenuActions;
var buildActionLookup = screenActions.buildActionLookup;
var encodeItems = screenActions.encodeItems;

var normalizeCanonicalGraph = graphSchema.normalizeCanonicalGraph;

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
  liveRenderTimer: null,
  pendingEffectVibe: '',
  pendingEffectLight: false,
  agent: {
    requestNonce: 0,
    activeRequest: null,
    awaiting: false,
    conversationStarted: false,
    conversationId: '',
    turnIndex: 0
  }
};

var OPENAI_SYSTEM_PROMPT = [
  'You are a canonical graph engine for a Pebble watch app.',
  'Respond with exactly one JSON object and no markdown.',
  'Schema:',
  '{',
  '  "schemaVersion": "pebble.sdui.v1",',
  '  "entryScreenId": "root",',
  '  "screens": {',
  '    "root": {',
  '      "id": "root",',
  '      "type": "menu" | "card" | "scroll",',
  '      "title": "short title",',
  '      "body": "short body",',
  '      "bodyTemplate": "optional {{binding.path}}",',
  '      "bindings": {',
  '        "time": { "source": "device.time", "live": true, "refreshMs": 30000 }',
  '      },',
  '      "input": {',
  '        "mode": "menu" | "voice" | "menu_or_voice"',
  '      },',
  '      "items": [',
  '        { "id": "yes", "label": "Yes", "value": "yes" }',
  '      ],',
  '      "actions": [',
  '        { "slot": "select", "id": "confirm", "icon": "check", "label": "Confirm", "value": "confirm" }',
  '      ]',
  '    }',
  '  }',
  '}',
  'Constraints:',
  '- schemaVersion must be pebble.sdui.v1',
  '- always return entryScreenId and screens',
  '- title <= 24 chars, body <= 140 chars (scroll body <= 1024 chars)',
  '- items <= 8, item labels <= 18 chars',
  '- scroll screens may include optional select action-menu items, max 6',
  '- card actions are only for card screens, max 3',
  '- action slot in up/select/down, unique per action list',
  '- action icon in play/pause/check/x/plus/minus',
  '- use items for menu screens, never options',
  '- action-menu items do not need slot or icon',
  '- use run for effects, not next/agentPrompt/agentCommand',
  '- run can include optional vibe (short/long/double) and light (true) for effects',
  '- use scroll type for long text content that needs vertical scrolling',
  '- return valid JSON only'
].join('\n');

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

function readBindingValue(binding) {
  var source = binding && binding.source ? String(binding.source) : '';
  var now = new Date();

  if (source === 'device.time') {
    return {
      localString: now.toLocaleString(),
      localTime: now.toLocaleTimeString(),
      iso: now.toISOString(),
      timestamp: now.getTime()
    };
  }

  return '';
}

function resolvePathValue(context, path) {
  var parts = String(path || '').split('.');
  var cursor = context;
  for (var i = 0; i < parts.length; i++) {
    var key = parts[i];
    if (!key) {
      continue;
    }

    if (!cursor || !Object.prototype.hasOwnProperty.call(cursor, key)) {
      return '';
    }
    cursor = cursor[key];
  }

  return cursor;
}

function renderTemplate(template, context) {
  if (template === undefined || template === null) {
    return '';
  }

  return String(template).replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, function(match, path) {
    var value = resolvePathValue(context, path);
    if (value === undefined || value === null) {
      return '';
    }
    return String(value);
  });
}

function applyScreenBindings(screen) {
  if (!screen || typeof screen !== 'object') {
    return { screen: screen, refreshMs: 0 };
  }

  var bindings = screen.bindings || {};
  var bindingKeys = Object.keys(bindings);
  var context = {};
  var refreshMs = 0;
  var i;

  for (i = 0; i < bindingKeys.length; i++) {
    var bindingKey = bindingKeys[i];
    var binding = bindings[bindingKey];
    context[bindingKey] = readBindingValue(binding);

    if (binding && binding.live) {
      var candidateRefresh = parseNumber(binding.refreshMs, 0);
      if (candidateRefresh > 0 && (refreshMs === 0 || candidateRefresh < refreshMs)) {
        refreshMs = candidateRefresh;
      }
    }
  }

  var resolved = {};
  for (var key in screen) {
    if (Object.prototype.hasOwnProperty.call(screen, key)) {
      resolved[key] = screen[key];
    }
  }

  if (screen.titleTemplate) {
    resolved.title = renderTemplate(screen.titleTemplate, context);
  }

  if (screen.bodyTemplate) {
    resolved.body = renderTemplate(screen.bodyTemplate, context);
  }

  if (screen.items && screen.items.length) {
    resolved.items = screen.items.map(function(item) {
      var nextItem = {};
      for (var itemKey in item) {
        if (Object.prototype.hasOwnProperty.call(item, itemKey)) {
          nextItem[itemKey] = item[itemKey];
        }
      }

      if (item.labelTemplate) {
        nextItem.label = renderTemplate(item.labelTemplate, context);
      }
      return nextItem;
    });
  }

  return {
    screen: resolved,
    refreshMs: refreshMs
  };
}

function prepareScreenForRender(screen) {
  if (!screen || typeof screen !== 'object') {
    return screen;
  }

  var prepared = {};
  for (var key in screen) {
    if (Object.prototype.hasOwnProperty.call(screen, key)) {
      prepared[key] = screen[key];
    }
  }

  if (prepared.type === 'menu') {
    var hasVoice = prepared.input && (prepared.input.mode === 'voice' || prepared.input.mode === 'menu_or_voice');
    var maxItems = hasVoice ? constants.MAX_MENU_ITEMS - 1 : constants.MAX_MENU_ITEMS;
    prepared.items = (prepared.items || []).slice(0, maxItems);

    if (hasVoice) {
      prepared.items.push({ id: VOICE_INPUT_ITEM_ID, label: 'Speak response', value: '' });
    }

    if (state.activeGraphSource === 'agent' && prepared.items.length === 0) {
      prepared.items.push({ id: 'continue', label: 'Continue', value: 'continue' });
    }
  }

  return prepared;
}

function scheduleLiveRender(screenId, refreshMs) {
  clearLiveRenderTimer();
  if (!screenId || refreshMs <= 0) {
    return;
  }

  state.liveRenderTimer = setTimeout(function() {
    if (state.currentScreenId !== screenId) {
      return;
    }

    var liveScreen = state.currentScreenDefinition;
    if (!liveScreen) {
      return;
    }

    sendRender(liveScreen);
  }, refreshMs);
}

function executeTypedAction(run, source) {
  if (!run || typeof run !== 'object') {
    return false;
  }

  var type = run.type ? String(run.type) : '';
  if (!type) {
    return false;
  }

  if (run.vibe) {
    state.pendingEffectVibe = String(run.vibe);
  }
  if (run.light) {
    state.pendingEffectLight = true;
  }

  if (type === 'navigate') {
    var targetScreen = String(run.screen || '');
    if (!targetScreen) {
      return false;
    }
    if (!transitionTo(targetScreen, true)) {
      state.pendingEffectVibe = '';
      state.pendingEffectLight = false;
      sendRender({
        id: 'nav-error',
        type: 'card',
        title: 'Navigation Error',
        body: limitText('Screen not found: ' + targetScreen, MAX_BODY_LEN)
      });
    }
    return true;
  }

  if (type === 'agent_prompt') {
    var prompt = String(run.prompt || '');
    if (!prompt) {
      return false;
    }
    submitAgentTextInput(prompt, source || 'schema_action');
    return true;
  }

  if (type === 'agent_command') {
    if (String(run.command || '') === 'reset') {
      resetAgentConversation(true);
      renderAgentStatusCard('Agent', 'Thread reset.');
      return true;
    }
    return false;
  }

  if (type === 'effect') {
    if (state.currentScreenDefinition) {
      sendRender(state.currentScreenDefinition);
      return true;
    }
    return false;
  }

  return false;
}

function sendRender(screen) {
  if (!screen) {
    return;
  }

  clearLiveRenderTimer();
  state.currentScreenDefinition = screen;

  var prepared = applyScreenBindings(screen);
  screen = prepareScreenForRender(prepared.screen);

  var isMenu = screen.type === 'menu';
  var isScroll = screen.type === 'scroll';
  var isCard = screen.type === 'card';
  var normalizedMenuActions = isScroll ? normalizeMenuActions(screen.actions || []) : [];
  var normalizedActions = isCard ? normalizeScreenActions(screen.actions || []) : [];
  var uiType = isMenu ? UI_TYPE_MENU : (isScroll ? UI_TYPE_SCROLL : UI_TYPE_CARD);
  var payload = {
    msgType: MSG_TYPE_RENDER,
    uiType: uiType,
    screenId: sanitizeText(screen.id),
    title: limitText(screen.title || 'Screen', MAX_TITLE_LEN)
  };

  if (isMenu) {
    payload.items = encodeItems(screen.items);
    payload.actions = '';
    payload.body = screen.body ? String(screen.body) : '';
    state.currentRenderedScreen = screen;
    state.currentCardActionsById = {};
    state.currentMenuActionsById = {};
  } else {
    var bodyLimit = isScroll ? MAX_SCROLL_BODY_LEN : MAX_BODY_LEN;
    payload.body = screen.body ? limitText(screen.body, bodyLimit) : '';
    state.currentRenderedScreen = screen;
    if (isCard) {
      payload.actions = encodeActions(normalizedActions);
      state.currentCardActionsById = buildActionLookup(normalizedActions);
    } else {
      state.currentCardActionsById = {};
      payload.actions = encodeMenuActions(normalizedMenuActions);
    }
    state.currentMenuActionsById = isScroll ? buildActionLookup(normalizedMenuActions) : {};
  }

  if (state.pendingEffectVibe) {
    payload.effectVibe = state.pendingEffectVibe;
    state.pendingEffectVibe = '';
  }
  if (state.pendingEffectLight) {
    payload.effectLight = 1;
    state.pendingEffectLight = false;
  }

  Pebble.sendAppMessage(
    payload,
    function() {
      console.log('Render sent:', screen.id);
    },
    function(error) {
      console.log('Render failed:', JSON.stringify(error));
    }
  );

  state.currentScreenId = screen.id;
  scheduleLiveRender(screen.id, prepared.refreshMs);
}

function renderGraphScreen(graph, source, screenId, pushHistory) {
  var nextScreen = resolveScreenInGraph(graph, screenId);
  if (!nextScreen) {
    console.log('Unknown screen id:', screenId);
    return false;
  }

  if (pushHistory) {
    pushCurrentHistoryEntry();
  }

  if (state.activeGraphSource === 'agent' && source !== 'agent') {
    leaveAgentConversation();
  }

  setActiveGraph(graph, source);
  sendRender(nextScreen);
  return true;
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
  var items = menuScreen.items || [];

  if (action.itemId) {
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === action.itemId) {
        return items[i];
      }
    }
  }

  if (action.index >= 0 && action.index < items.length) {
    return items[action.index];
  }

  return null;
}

// -----------------------------------------------------------------------------
// Environment and OpenAI configuration
// -----------------------------------------------------------------------------

function getAgentConfig() {
  return {
    openaiToken: localStorage.getItem(STORAGE_OPENAI_TOKEN) || '',
    openaiModel: localStorage.getItem(STORAGE_OPENAI_MODEL) || OPENAI_DEFAULT_MODEL
  };
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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  var trimmed = String(schemaJson || '').trim();
  if (!trimmed) {
    return { graph: null, error: '' };
  }

  var parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    return { graph: null, error: 'Schema JSON is invalid.' };
  }

  var normalized = normalizeCanonicalGraph(parsed);
  if (!normalized) {
    return { graph: null, error: 'Schema must be a canonical graph with schemaVersion, entryScreenId, and screens.' };
  }

  return { graph: normalized, error: '' };
}

function tryRenderImportedSchemaFromStorage() {
  var storedSchema = localStorage.getItem(STORAGE_IMPORTED_SCHEMA_JSON) || '';
  if (!storedSchema) {
    return false;
  }

  var parsed = parseImportedGraphFromJson(storedSchema);
  if (!parsed.graph) {
    renderImportError(parsed.error || 'Stored schema is invalid.');
    return true;
  }

  activateGraph(parsed.graph, 'imported', false);
  return true;
}

function buildConfigurationUrl() {
  var existingSchema = localStorage.getItem(STORAGE_IMPORTED_SCHEMA_JSON) || '';
  var existingToken = localStorage.getItem(STORAGE_OPENAI_TOKEN) || '';
  var existingModel = localStorage.getItem(STORAGE_OPENAI_MODEL) || OPENAI_DEFAULT_MODEL;

  var html = [
    '<!doctype html><html><head><meta charset="utf-8"/>',
    '<meta name="viewport" content="width=device-width,initial-scale=1"/>',
    '<title>Pebble SDUI Setup</title>',
    '<style>body{font-family:-apple-system,system-ui,sans-serif;padding:12px;background:#111;color:#eee;}',
    'label{display:block;margin:10px 0 4px;}textarea,input{width:100%;box-sizing:border-box;padding:8px;border-radius:6px;border:1px solid #444;background:#1c1c1c;color:#fff;}',
    'textarea{min-height:160px;}button{margin-top:12px;padding:10px 12px;border:0;border-radius:6px;background:#2f7cff;color:#fff;font-weight:600;width:100%;}</style>',
    '</head><body>',
    '<h3>SDUI Import Setup</h3>',
    '<label>Schema JSON</label>',
    '<textarea id="schema" placeholder="{&quot;schemaVersion&quot;:&quot;pebble.sdui.v1&quot;,&quot;entryScreenId&quot;:&quot;root&quot;,&quot;screens&quot;:{...}}">', escapeHtml(existingSchema), '</textarea>',
    '<label>OpenAI API Key</label>',
    '<input id="token" type="password" placeholder="sk-..." value="', escapeHtml(existingToken), '"/>',
    '<label>OpenAI Model</label>',
    '<input id="model" type="text" value="', escapeHtml(existingModel), '"/>',
    '<button id="save">Save</button>',
    '<script>',
    'document.getElementById("save").addEventListener("click", function(){',
    'var payload={schemaJson:document.getElementById("schema").value||"",openaiToken:document.getElementById("token").value||"",openaiModel:document.getElementById("model").value||""};',
    'document.location="pebblejs://close#"+encodeURIComponent(JSON.stringify(payload));',
    '});',
    '</script>',
    '</body></html>'
  ].join('');

  return 'data:text/html,' + encodeURIComponent(html);
}

function parseConfigurationResponse(event) {
  if (!event || !event.response) {
    return null;
  }

  var decoded;
  try {
    decoded = decodeURIComponent(event.response);
  } catch (error) {
    decoded = event.response;
  }

  if (!decoded) {
    return null;
  }

  try {
    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
}

// -----------------------------------------------------------------------------
// OpenAI IO
// -----------------------------------------------------------------------------

function postJson(url, token, body, onDone) {
  var xhr = new XMLHttpRequest();
  var done = false;

  function finish(error, value) {
    if (done) {
      return;
    }
    done = true;
    onDone(error, value);
  }

  xhr.open('POST', url, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  if (token) {
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
  }
  xhr.timeout = 25000;

  xhr.onload = function() {
    if (xhr.status < 200 || xhr.status >= 300) {
      finish('HTTP ' + xhr.status + ': ' + (xhr.responseText || '').substring(0, 120), null);
      return;
    }

    var parsed;
    try {
      parsed = JSON.parse(xhr.responseText || '{}');
    } catch (error) {
      var textBody = sanitizeText(xhr.responseText || '');
      if (textBody) {
        finish(null, { message: textBody });
        return;
      }

      finish('Response returned invalid JSON: ' + error.message, null);
      return;
    }

    finish(null, parsed);
  };

  xhr.onerror = function() {
    finish('Network request failed.', null);
  };

  xhr.ontimeout = function() {
    finish('Request timed out.', null);
  };

  xhr.send(JSON.stringify(body));
  return xhr;
}

function buildOpenAIContext(userText, reason) {
  return {
    schemaVersion: SDUI_SCHEMA_VERSION,
    conversationId: state.agent.conversationId || '',
    reason: sanitizeText(reason || 'user_input'),
    input: sanitizeText(userText || ''),
    tzOffset: -(new Date()).getTimezoneOffset(),
    watch: getWatchProfile()
  };
}

function buildOpenAIRequestBody(config, userText, reason) {
  var context = buildOpenAIContext(userText, reason);
  var prompt = [
    'Runtime context:',
    JSON.stringify(context),
    '',
    'Return one JSON object that follows the schema in instructions.'
  ].join('\n');

  var body = {
    model: config.openaiModel,
    instructions: OPENAI_SYSTEM_PROMPT,
    input: prompt
  };

  if (state.agent.conversationId) {
    body.previous_response_id = state.agent.conversationId;
  }

  return body;
}

function extractFirstJsonObject(text) {
  if (!text) {
    return '';
  }

  var start = text.indexOf('{');
  if (start < 0) {
    return '';
  }

  var depth = 0;
  var inString = false;
  var escaped = false;

  for (var i = start; i < text.length; i++) {
    var ch = text.charAt(i);

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      depth++;
      continue;
    }

    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.substring(start, i + 1);
      }
    }
  }

  return '';
}

function extractOpenAIOutputText(response) {
  if (!response || typeof response !== 'object') {
    return '';
  }

  if (typeof response.output_text === 'string' && response.output_text) {
    return response.output_text;
  }

  if (Array.isArray(response.output)) {
    for (var i = 0; i < response.output.length; i++) {
      var item = response.output[i];
      if (!item || !Array.isArray(item.content)) {
        continue;
      }
      for (var j = 0; j < item.content.length; j++) {
        var chunk = item.content[j];
        if (!chunk) {
          continue;
        }
        if (typeof chunk.text === 'string' && chunk.text) {
          return chunk.text;
        }
      }
    }
  }

  if (response.message && typeof response.message === 'string') {
    return response.message;
  }

  return '';
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
  if (state.history.length === 0) {
    if (state.activeGraphSource === 'agent') {
      leaveAgentConversation();
      activateGraph(staticScreens, 'static', false);
      return;
    }

    activateGraph(state.activeGraph || staticScreens, state.activeGraphSource || 'static', false);
    return;
  }

  var previous = state.history.pop();
  if (state.activeGraphSource === 'agent' && previous.source !== 'agent') {
    leaveAgentConversation();
  }
  restoreHistoryEntry(previous);
}

function handleMenuSelect(action) {
  var currentScreen = state.currentRenderedScreen;
  if (!currentScreen || currentScreen.type !== 'menu') {
    return;
  }

  var selectedItem = getSelectedItemFromAction(action, currentScreen);
  if (!selectedItem) {
    return;
  }

  if (executeTypedAction(selectedItem.run, 'menu_item')) {
    return;
  }

  if (state.activeGraphSource === 'agent' && selectedItem.value) {
    submitAgentTextInput('User selected item ' + selectedItem.id + ': ' + selectedItem.value, 'menu_item');
  }
}

function handleMenuActionSelect(action) {
  if (action.index >= 0) {
    return false;
  }

  var selectedId = action.itemId || '';
  if (!selectedId) {
    return false;
  }

  var selectedAction = state.currentMenuActionsById[selectedId];
  if (!selectedAction) {
    return false;
  }

  if (executeTypedAction(selectedAction.run, 'menu_action')) {
    return true;
  }

  if (state.activeGraphSource === 'agent' && selectedAction.value) {
    submitAgentTextInput('User selected action menu item ' + selectedAction.id + ': ' + selectedAction.value, 'menu_action');
    return true;
  }

  return true;
}

function handleCardActionSelect(action) {
  var selectedId = action.itemId || '';
  if (!selectedId) {
    return false;
  }

  var selectedAction = state.currentCardActionsById[selectedId];
  if (!selectedAction) {
    return false;
  }

  if (executeTypedAction(selectedAction.run, 'card_action')) {
    return true;
  }

  if (state.activeGraphSource === 'agent' && selectedAction.value) {
    submitAgentTextInput('User selected card action ' + selectedAction.id + ': ' + selectedAction.value, 'card_action');
    return true;
  }

  return true;
}

function handleSelect(action) {
  if (handleCardActionSelect(action)) {
    return;
  }

  if (handleMenuActionSelect(action)) {
    return;
  }

  handleMenuSelect(action);
}

function handleVoiceAction(action) {
  if (action.itemId === VOICE_NOT_SUPPORTED_ITEM_ID) {
    sendRender({
      id: 'voice-unsupported',
      type: 'card',
      title: 'Voice',
      body: 'Voice dictation not supported on this watch.'
    });
    return;
  }

  if (action.itemId === VOICE_ERROR_ITEM_ID) {
    sendRender({
      id: 'voice-error',
      type: 'card',
      title: 'Voice',
      body: 'Dictation failed. Try again.'
    });
    return;
  }

  if (state.activeGraphSource === 'agent') {
    submitAgentVoice(action.text);
    return;
  }

  // Non-agent voice: show transcript as a scroll screen
  var transcript = sanitizeText(action.text);
  if (!transcript) {
    sendRender({
      id: 'voice-empty',
      type: 'card',
      title: 'Voice',
      body: 'No transcript captured. Try again.'
    });
    return;
  }

  pushCurrentHistoryEntry();
  sendRender({
    id: 'voice-result',
    type: 'scroll',
    title: 'Voice Input',
    body: limitText(transcript, MAX_SCROLL_BODY_LEN)
  });
}

function handleActionMessage(payload) {
  var msgType = parseNumber(payload.msgType, 0);
  if (msgType !== MSG_TYPE_ACTION) {
    return;
  }

  var actionType = parseNumber(payload.actionType, 0);
  var action = {
    screenId: payload.actionScreenId ? String(payload.actionScreenId) : '',
    itemId: payload.actionItemId ? String(payload.actionItemId) : '',
    index: parseNumber(payload.actionIndex, -1),
    text: payload.actionText ? String(payload.actionText) : ''
  };

  if (action.screenId) {
    state.currentScreenId = action.screenId;
  }

  if (actionType === ACTION_TYPE_READY) {
    state.history = [];
    resetAgentConversation(false);
    if (!tryRenderImportedSchemaFromStorage()) {
      activateGraph(staticScreens, 'static', false);
    }
    return;
  }

  if (actionType === ACTION_TYPE_SELECT) {
    handleSelect(action);
    return;
  }

  if (actionType === ACTION_TYPE_BACK) {
    handleBack();
    return;
  }

  if (actionType === ACTION_TYPE_VOICE) {
    handleVoiceAction(action);
  }
}

function applyConfigurationFromPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return;
  }

  var openaiToken = sanitizeText(payload.openaiToken || '');
  var openaiModel = sanitizeText(payload.openaiModel || OPENAI_DEFAULT_MODEL) || OPENAI_DEFAULT_MODEL;
  var schemaJson = payload.schemaJson !== undefined && payload.schemaJson !== null ? String(payload.schemaJson) : '';

  if (openaiToken) {
    localStorage.setItem(STORAGE_OPENAI_TOKEN, openaiToken);
  } else {
    localStorage.removeItem(STORAGE_OPENAI_TOKEN);
  }

  localStorage.setItem(STORAGE_OPENAI_MODEL, openaiModel);

  var schemaTrimmed = String(schemaJson || '').trim();
  if (!schemaTrimmed) {
    localStorage.removeItem(STORAGE_IMPORTED_SCHEMA_JSON);
    renderAgentStatusCard('Import Cleared', 'Imported schema removed.');
    return;
  }

  var parsed = parseImportedGraphFromJson(schemaJson);
  if (!parsed.graph) {
    renderImportError(parsed.error || 'Invalid imported schema.');
    return;
  }

  localStorage.setItem(STORAGE_IMPORTED_SCHEMA_JSON, schemaJson);
  activateGraph(parsed.graph, 'imported', false);
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
  console.log('Phone brain ready');

  var config = getAgentConfig();
  if (config.openaiToken) {
    console.log('OpenAI key configured');
  } else {
    console.log('OpenAI key missing. Open app settings to add one.');
  }

  if (!state.currentScreenId) {
    state.history = [];
    if (!tryRenderImportedSchemaFromStorage()) {
      activateGraph(staticScreens, 'static', false);
    }
  }
});

Pebble.addEventListener('appmessage', function(event) {
  var payload = event && event.payload ? event.payload : {};
  handleActionMessage(payload);
});
