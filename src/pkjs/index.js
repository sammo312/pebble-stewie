'use strict';

// -----------------------------------------------------------------------------
// Module wiring
// -----------------------------------------------------------------------------

var constants = require('./constants');
var staticScreens = require('./static-screens');
var textUtils = require('./text-utils');
var screenActions = require('./screen-actions');
var agentTurn = require('./agent-turn');

var MSG_TYPE_RENDER = constants.MSG_TYPE_RENDER;
var MSG_TYPE_ACTION = constants.MSG_TYPE_ACTION;
var UI_TYPE_MENU = constants.UI_TYPE_MENU;
var UI_TYPE_CARD = constants.UI_TYPE_CARD;
var ACTION_TYPE_READY = constants.ACTION_TYPE_READY;
var ACTION_TYPE_SELECT = constants.ACTION_TYPE_SELECT;
var ACTION_TYPE_BACK = constants.ACTION_TYPE_BACK;
var ACTION_TYPE_VOICE = constants.ACTION_TYPE_VOICE;
var MAX_TITLE_LEN = constants.MAX_TITLE_LEN;
var MAX_BODY_LEN = constants.MAX_BODY_LEN;
var VOICE_INPUT_ITEM_ID = constants.VOICE_INPUT_ITEM_ID;
var VOICE_ERROR_ITEM_ID = constants.VOICE_ERROR_ITEM_ID;
var VOICE_NOT_SUPPORTED_ITEM_ID = constants.VOICE_NOT_SUPPORTED_ITEM_ID;
var OPENAI_BACKEND_DEFAULT_URL = constants.OPENAI_BACKEND_DEFAULT_URL;
var OPENAI_BACKEND_DEFAULT_TOKEN = constants.OPENAI_BACKEND_DEFAULT_TOKEN;
var SDUI_SCHEMA_VERSION = constants.SDUI_SCHEMA_VERSION;

var sanitizeText = textUtils.sanitizeText;
var limitText = textUtils.limitText;
var parseNumber = textUtils.parseNumber;

var normalizeScreenActions = screenActions.normalizeScreenActions;
var encodeActions = screenActions.encodeActions;
var buildActionLookup = screenActions.buildActionLookup;
var encodeItems = screenActions.encodeItems;

var normalizeAgentTurn = agentTurn.normalizeAgentTurn;

// -----------------------------------------------------------------------------
// Runtime state
// -----------------------------------------------------------------------------

var state = {
  currentScreenId: null,
  history: [],
  currentCardActionsById: {},
  agent: {
    requestNonce: 0,
    activeRequest: null,
    awaiting: false,
    conversationStarted: false,
    conversationId: '',
    currentTurn: null,
    currentOptionsById: {},
    turnIndex: 0
  }
};

// -----------------------------------------------------------------------------
// Screen rendering and navigation
// -----------------------------------------------------------------------------

function resolveScreen(screenId) {
  if (screenId === 'time-card') {
    return {
      id: 'time-card',
      type: 'card',
      title: 'Phone Time',
      body: new Date().toLocaleString()
    };
  }

  return staticScreens[screenId] || null;
}

function sendRender(screen) {
  if (!screen) {
    return;
  }

  var isMenu = screen.type === 'menu';
  var normalizedActions = isMenu ? [] : normalizeScreenActions(screen.actions || []);
  var payload = {
    msgType: MSG_TYPE_RENDER,
    uiType: isMenu ? UI_TYPE_MENU : UI_TYPE_CARD,
    screenId: sanitizeText(screen.id),
    title: limitText(screen.title || 'Screen', MAX_TITLE_LEN)
  };

  if (isMenu) {
    payload.items = encodeItems(screen.items);
    payload.body = screen.body ? String(screen.body) : '';
    state.currentCardActionsById = {};
  } else {
    payload.body = screen.body ? String(screen.body) : '';
    payload.actions = encodeActions(normalizedActions);
    state.currentCardActionsById = buildActionLookup(normalizedActions);
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
}

function transitionTo(screenId, pushHistory) {
  var nextScreen = resolveScreen(screenId);
  if (!nextScreen) {
    console.log('Unknown screen id:', screenId);
    return;
  }

  if (pushHistory && state.currentScreenId) {
    state.history.push(state.currentScreenId);
  }

  sendRender(nextScreen);
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

function isAgentScreenId(screenId) {
  return !!screenId && screenId.indexOf('agent-') === 0;
}

// -----------------------------------------------------------------------------
// Environment and backend configuration
// -----------------------------------------------------------------------------

function getAgentConfig() {
  return {
    backendUrl: localStorage.getItem('openai-backend-url') || OPENAI_BACKEND_DEFAULT_URL,
    backendToken: localStorage.getItem('openai-backend-token') || OPENAI_BACKEND_DEFAULT_TOKEN
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
  state.agent.currentTurn = null;
  state.agent.currentOptionsById = {};
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
  sendRender({
    id: 'agent-status-' + state.agent.turnIndex,
    type: 'card',
    title: limitText(title || 'Agent', MAX_TITLE_LEN),
    body: body || ''
  });
}

function renderAgentTurn(turn) {
  state.agent.currentTurn = turn;
  state.agent.currentOptionsById = {};

  // Card turns can be final, or interactive when they include action buttons.
  if (turn.screen.type === 'card' && (!turn.input.expectResponse || turn.screen.actions.length > 0)) {
    if (turn.input.expectResponse) {
      for (var actionIndex = 0; actionIndex < turn.screen.actions.length; actionIndex++) {
        var action = turn.screen.actions[actionIndex];
        state.agent.currentOptionsById[action.id] = {
          id: action.id,
          label: action.label,
          value: action.value || action.label
        };
      }
    }

    state.agent.turnIndex++;
    sendRender({
      id: 'agent-card-' + state.agent.turnIndex,
      type: 'card',
      title: turn.screen.title,
      body: turn.screen.body,
      actions: turn.screen.actions
    });
    return;
  }

  if (!turn.input.expectResponse) {
    state.agent.turnIndex++;
    sendRender({
      id: 'agent-card-' + state.agent.turnIndex,
      type: 'card',
      title: turn.screen.title,
      body: turn.screen.body
    });
    return;
  }

  var menuItems = [];
  for (var i = 0; i < turn.screen.options.length; i++) {
    var option = turn.screen.options[i];
    state.agent.currentOptionsById[option.id] = option;
    menuItems.push({ id: option.id, label: option.label });
  }

  if (turn.input.mode === 'voice' || turn.input.mode === 'menu_or_voice') {
    menuItems.push({ id: VOICE_INPUT_ITEM_ID, label: 'Speak response' });
  }

  if (menuItems.length === 0) {
    var fallbackOption = { id: 'continue', label: 'Continue', value: 'continue' };
    state.agent.currentOptionsById[fallbackOption.id] = fallbackOption;
    menuItems.push({ id: fallbackOption.id, label: fallbackOption.label });
  }

  state.agent.turnIndex++;
  sendRender({
    id: 'agent-turn-' + state.agent.turnIndex,
    type: 'menu',
    title: turn.screen.title,
    items: menuItems
  });
}

function renderAgentFallback(text) {
  clearAgentTurnState();
  state.agent.turnIndex++;
  sendRender({
    id: 'agent-fallback-' + state.agent.turnIndex,
    type: 'card',
    title: 'Agent Response',
    body: limitText(text || 'No structured response.', MAX_BODY_LEN)
  });
}

// -----------------------------------------------------------------------------
// Backend IO
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
      finish('Backend HTTP ' + xhr.status + ': ' + (xhr.responseText || '').substring(0, 120), null);
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

      finish('Backend returned invalid JSON: ' + error.message, null);
      return;
    }

    finish(null, parsed);
  };

  xhr.onerror = function() {
    finish('Network error talking to backend.', null);
  };

  xhr.ontimeout = function() {
    finish('Backend request timed out.', null);
  };

  xhr.send(JSON.stringify(body));
  return xhr;
}

function buildBackendRequest(userText, reason) {
  return {
    schemaVersion: SDUI_SCHEMA_VERSION,
    conversationId: state.agent.conversationId || '',
    reason: sanitizeText(reason || 'user_input'),
    input: sanitizeText(userText || ''),
    tzOffset: -(new Date()).getTimezoneOffset(),
    watch: getWatchProfile()
  };
}

function queryAgent(userText, reason) {
  var config = getAgentConfig();
  if (!config.backendUrl) {
    renderAgentStatusCard('Agent Setup', 'Set localStorage openai-backend-url first.');
    return;
  }

  cancelAgentRequest();
  clearAgentTurnState();

  var requestNonce = ++state.agent.requestNonce;
  var requestBody = buildBackendRequest(userText, reason);

  state.agent.awaiting = true;
  renderAgentStatusCard('Agent', 'Thinking...');

  console.log('Agent request URL:', config.backendUrl);
  console.log('Agent request reason:', requestBody.reason);

  state.agent.activeRequest = postJson(config.backendUrl, config.backendToken, requestBody, function(error, response) {
    if (requestNonce !== state.agent.requestNonce) {
      return;
    }

    state.agent.activeRequest = null;
    state.agent.awaiting = false;

    if (error) {
      renderAgentStatusCard('Agent Error', error);
      return;
    }

    if (!response || typeof response !== 'object') {
      renderAgentFallback('Backend returned empty response.');
      return;
    }

    if (response.conversationId) {
      state.agent.conversationId = sanitizeText(response.conversationId);
    }

    var turnCandidate = response.turn || response;
    var normalized = normalizeAgentTurn(turnCandidate);
    if (!normalized) {
      renderAgentFallback('Backend response did not match SDUI schema.');
      return;
    }

    renderAgentTurn(normalized);
  });
}

function ensureAgentConversationStarted() {
  if (!state.agent.conversationStarted) {
    if (state.currentScreenId) {
      state.history.push(state.currentScreenId);
    }
    state.agent.conversationStarted = true;
  }
}

function submitAgentTextInput(userText, reason) {
  ensureAgentConversationStarted();
  queryAgent(userText, reason);
}

function submitAgentOption(option) {
  var optionValue = option && option.value ? option.value : option.label;
  var userText = 'User selected option ' + option.id + ': ' + optionValue;
  submitAgentTextInput(userText, 'menu_option');
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
}

// -----------------------------------------------------------------------------
// Input handling
// -----------------------------------------------------------------------------

function handleBack() {
  if (isAgentScreenId(state.currentScreenId)) {
    leaveAgentConversation();
  }

  if (state.history.length === 0) {
    transitionTo('root', false);
    return;
  }

  var previous = state.history.pop();
  transitionTo(previous, false);
}

function handleStaticMenuSelect(action) {
  var currentScreen = resolveScreen(state.currentScreenId);
  if (!currentScreen || currentScreen.type !== 'menu') {
    return;
  }

  var selectedItem = getSelectedItemFromAction(action, currentScreen);
  if (!selectedItem) {
    return;
  }

  if (selectedItem.agentCommand === 'reset') {
    resetAgentConversation(true);
    renderAgentStatusCard('Agent', 'Thread reset.');
    return;
  }

  if (selectedItem.agentPrompt) {
    submitAgentTextInput(selectedItem.agentPrompt, 'preset_prompt');
    return;
  }

  if (selectedItem.next) {
    transitionTo(selectedItem.next, true);
  }
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

  // Agent cards reserve action button ids as response options first.
  if (isAgentScreenId(state.currentScreenId) && handleAgentTurnSelect(action)) {
    return true;
  }

  if (selectedAction.agentCommand === 'reset') {
    resetAgentConversation(true);
    renderAgentStatusCard('Agent', 'Thread reset.');
    return true;
  }

  if (selectedAction.agentPrompt) {
    submitAgentTextInput(selectedAction.agentPrompt, 'card_action');
    return true;
  }

  if (isAgentScreenId(state.currentScreenId) && selectedAction.value) {
    submitAgentTextInput('User selected card action ' + selectedAction.id + ': ' + selectedAction.value, 'card_action');
    return true;
  }

  if (selectedAction.next) {
    transitionTo(selectedAction.next, true);
    return true;
  }

  return true;
}

function handleAgentTurnSelect(action) {
  var selectedId = action.itemId || '';
  if (!selectedId) {
    return false;
  }

  if (selectedId === VOICE_INPUT_ITEM_ID) {
    return true;
  }

  var option = state.agent.currentOptionsById[selectedId];
  if (!option) {
    return false;
  }

  submitAgentOption(option);
  return true;
}

function handleSelect(action) {
  if (handleCardActionSelect(action)) {
    return;
  }

  if (isAgentScreenId(state.currentScreenId)) {
    if (handleAgentTurnSelect(action)) {
      return;
    }
  }

  handleStaticMenuSelect(action);
}

function handleVoiceAction(action) {
  if (action.itemId === VOICE_NOT_SUPPORTED_ITEM_ID) {
    renderAgentStatusCard('Voice', 'Voice dictation not supported on this watch.');
    return;
  }

  if (action.itemId === VOICE_ERROR_ITEM_ID) {
    renderAgentStatusCard('Voice', 'Dictation failed. Try again.');
    return;
  }

  submitAgentVoice(action.text);
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
    transitionTo('root', false);
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

// -----------------------------------------------------------------------------
// Pebble event bridge
// -----------------------------------------------------------------------------

Pebble.addEventListener('ready', function() {
  console.log('Phone brain ready');

  var config = getAgentConfig();
  if (config.backendUrl) {
    console.log('OpenAI backend URL configured:', config.backendUrl);
  } else {
    console.log('OpenAI backend URL missing. Set localStorage openai-backend-url.');
  }

  if (!state.currentScreenId) {
    state.history = [];
    transitionTo('root', false);
  }
});

Pebble.addEventListener('appmessage', function(event) {
  var payload = event && event.payload ? event.payload : {};
  handleActionMessage(payload);
});
