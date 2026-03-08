'use strict';

var MSG_TYPE_RENDER = 1;
var MSG_TYPE_ACTION = 2;

var UI_TYPE_MENU = 1;
var UI_TYPE_CARD = 2;

var ACTION_TYPE_READY = 1;
var ACTION_TYPE_SELECT = 2;
var ACTION_TYPE_BACK = 3;
var ACTION_TYPE_VOICE = 4;

var MAX_MENU_ITEMS = 8;
var MAX_TITLE_LEN = 30;
var MAX_BODY_LEN = 180;
var MAX_OPTION_LABEL_LEN = 20;
var MAX_AGENT_OPTIONS = 5;
var MAX_CARD_ACTIONS = 3;
var MAX_ACTION_ID_LEN = 22;

var ACTION_SLOT_ORDER = ['up', 'select', 'down'];
var VALID_ACTION_ICONS = {
  play: true,
  pause: true,
  check: true,
  x: true,
  plus: true,
  minus: true
};

var SDUI_SCHEMA_VERSION = 'pebble.sdui.v1';
var VOICE_INPUT_ITEM_ID = '__voice__';
var VOICE_ERROR_ITEM_ID = '__voice_error__';
var VOICE_NOT_SUPPORTED_ITEM_ID = '__voice_not_supported__';
var OPENAI_BACKEND_DEFAULT_URL = 'http://192.168.12.187:8787/turn';
var OPENAI_BACKEND_DEFAULT_TOKEN = '';

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

var staticScreens = {
  root: {
    id: 'root',
    type: 'menu',
    title: 'Main Menu',
    items: [
      { id: 'controls', label: 'Controls', next: 'controls' },
      { id: 'agent-home', label: 'Agent SDUI', next: 'agent-home' },
      { id: 'status', label: 'Status Card', next: 'status-card' },
      { id: 'time', label: 'Phone Time', next: 'time-card' },
      { id: 'about', label: 'About', next: 'about-card' }
    ]
  },
  controls: {
    id: 'controls',
    type: 'menu',
    title: 'Controls',
    items: [
      { id: 'start', label: 'Start Task', next: 'start-card' },
      { id: 'stop', label: 'Stop Task', next: 'stop-card' },
      { id: 'diag', label: 'Diagnostics', next: 'diag-card' }
    ]
  },
  'agent-home': {
    id: 'agent-home',
    type: 'menu',
    title: 'Agent SDUI',
    items: [
      { id: 'agent-quickstart', label: 'Start Conversation', agentPrompt: 'Start a useful short conversation and ask me a yes or no question first.' },
      { id: VOICE_INPUT_ITEM_ID, label: 'Speak to Agent' },
      { id: 'agent-reset', label: 'Reset Thread', agentCommand: 'reset' },
      { id: 'agent-help', label: 'Setup Help', next: 'agent-help-card' }
    ]
  },
  'agent-help-card': {
    id: 'agent-help-card',
    type: 'card',
    title: 'Agent Setup',
    body: 'Set localStorage openai-backend-url and optional openai-backend-token.'
  },
  'status-card': {
    id: 'status-card',
    type: 'card',
    title: 'System Status',
    body: 'Phone brain online. Watch renders SDUI from phone state.',
    actions: [
      { slot: 'select', id: 'status-home', icon: 'check', next: 'root' }
    ]
  },
  'about-card': {
    id: 'about-card',
    type: 'card',
    title: 'About',
    body: 'Watch renders. Phone + backend decide next screens.'
  },
  'start-card': {
    id: 'start-card',
    type: 'card',
    title: 'Started',
    body: 'Start action acknowledged by phone.'
  },
  'stop-card': {
    id: 'stop-card',
    type: 'card',
    title: 'Stopped',
    body: 'Stop action acknowledged by phone.'
  },
  'diag-card': {
    id: 'diag-card',
    type: 'card',
    title: 'Diagnostics',
    body: 'All checks passed. Rendering loop healthy.'
  }
};

function sanitizeText(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).replace(/\n/g, ' ').replace(/\|/g, '/').trim();
}

function limitText(value, maxLen) {
  var text = sanitizeText(value);
  if (!text) {
    return '';
  }

  if (text.length <= maxLen) {
    return text;
  }

  return text.substring(0, maxLen - 3) + '...';
}

function parseNumber(value, fallback) {
  var parsed = Number(value);
  return isNaN(parsed) ? fallback : parsed;
}

function sanitizeActionId(id, slot, index) {
  var raw = sanitizeText(id).toLowerCase();
  if (!raw) {
    raw = slot + '_' + index;
  }

  var cleaned = raw.replace(/[^a-z0-9_-]/g, '_');
  if (!cleaned) {
    cleaned = slot + '_' + index;
  }

  return cleaned.substring(0, MAX_ACTION_ID_LEN);
}

function normalizeActionSlot(slot) {
  var value = sanitizeText(slot).toLowerCase();
  for (var i = 0; i < ACTION_SLOT_ORDER.length; i++) {
    if (ACTION_SLOT_ORDER[i] === value) {
      return value;
    }
  }
  return '';
}

function normalizeActionIcon(icon) {
  var token = sanitizeText(icon).toLowerCase();
  if (!VALID_ACTION_ICONS[token]) {
    return 'check';
  }
  return token;
}

function normalizeScreenActions(rawActions) {
  if (!rawActions || !rawActions.length) {
    return [];
  }

  var actions = [];
  var seenSlots = {};
  var seenIds = {};
  for (var i = 0; i < rawActions.length && actions.length < MAX_CARD_ACTIONS; i++) {
    var action = rawActions[i];
    if (!action || typeof action !== 'object') {
      continue;
    }

    var slot = normalizeActionSlot(action.slot || action.button);
    if (!slot || seenSlots[slot]) {
      continue;
    }

    var actionId = sanitizeActionId(action.id, slot, i + 1);
    if (seenIds[actionId]) {
      actionId = sanitizeActionId(actionId + '_' + (i + 1), slot, i + 1);
    }
    if (seenIds[actionId]) {
      continue;
    }

    seenSlots[slot] = true;
    seenIds[actionId] = true;

    var label = limitText(action.label || action.title || actionId, MAX_OPTION_LABEL_LEN);
    actions.push({
      id: actionId,
      slot: slot,
      icon: normalizeActionIcon(action.icon),
      label: label || actionId,
      value: sanitizeText(action.value || action.prompt || label || actionId),
      next: action.next ? String(action.next) : '',
      agentPrompt: action.agentPrompt ? String(action.agentPrompt) : '',
      agentCommand: action.agentCommand ? String(action.agentCommand) : ''
    });
  }

  return actions;
}

function encodeActions(actions) {
  if (!actions || actions.length === 0) {
    return '';
  }

  return actions
    .slice(0, MAX_CARD_ACTIONS)
    .map(function(action) {
      return action.slot + '|' + action.id + '|' + action.icon;
    })
    .join('\n');
}

function buildActionLookup(actions) {
  var byId = {};
  for (var i = 0; i < actions.length; i++) {
    byId[actions[i].id] = actions[i];
  }
  return byId;
}

function encodeItems(items) {
  var safeItems = (items || []).slice(0, MAX_MENU_ITEMS);

  return safeItems
    .map(function(item, index) {
      var label = limitText(item.label || item.title || ('Item ' + (index + 1)), MAX_OPTION_LABEL_LEN);
      var id = sanitizeText(item.id || ('item-' + index));
      return id + '|' + label;
    })
    .join('\n');
}

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

function sanitizeOptionId(id, index) {
  var raw = sanitizeText(id).toLowerCase();
  if (!raw) {
    return 'option_' + index;
  }

  var cleaned = raw.replace(/[^a-z0-9_-]/g, '_');
  if (!cleaned) {
    cleaned = 'option_' + index;
  }

  return cleaned.substring(0, 22);
}

function extractLooseAgentText(rawTurn) {
  if (!rawTurn || typeof rawTurn !== 'object') {
    return '';
  }

  var candidates = [
    rawTurn.body,
    rawTurn.text,
    rawTurn.message,
    rawTurn.response,
    rawTurn.output_text,
    rawTurn.reply
  ];

  for (var i = 0; i < candidates.length; i++) {
    var text = sanitizeText(candidates[i]);
    if (text) {
      return text;
    }
  }

  if (typeof rawTurn.output === 'string') {
    return sanitizeText(rawTurn.output);
  }

  return '';
}

function normalizeAgentTurn(rawTurn) {
  if (typeof rawTurn === 'string') {
    return {
      schemaVersion: SDUI_SCHEMA_VERSION,
      screen: {
        type: 'card',
        title: 'Agent',
        body: limitText(rawTurn, MAX_BODY_LEN),
        options: [],
        actions: []
      },
      input: {
        mode: 'menu',
        expectResponse: false
      }
    };
  }

  if (!rawTurn || typeof rawTurn !== 'object') {
    return null;
  }

  var turn = {
    schemaVersion: SDUI_SCHEMA_VERSION,
    screen: {
      type: 'card',
      title: 'Agent',
      body: '',
      actions: []
    },
    input: {
      mode: 'menu',
      expectResponse: false
    }
  };

  var screen = rawTurn.screen || {};
  var input = rawTurn.input || {};

  var screenType = String(screen.type || rawTurn.type || 'card').toLowerCase();
  if (screenType !== 'menu' && screenType !== 'card') {
    screenType = 'card';
  }

  turn.screen.type = screenType;
  turn.screen.title = limitText(screen.title || rawTurn.title || 'Agent', MAX_TITLE_LEN);
  turn.screen.body = limitText(screen.body || rawTurn.body || extractLooseAgentText(rawTurn) || '', MAX_BODY_LEN);
  if (screenType === 'card') {
    turn.screen.actions = normalizeScreenActions(screen.actions || rawTurn.actions || []);
  } else {
    turn.screen.actions = [];
  }

  var mode = String(input.mode || 'menu').toLowerCase();
  if (mode !== 'menu' && mode !== 'voice' && mode !== 'menu_or_voice') {
    mode = 'menu';
  }

  var options = [];
  var seenIds = {};
  var rawOptions = screen.options || rawTurn.options || [];
  for (var i = 0; i < rawOptions.length && options.length < MAX_AGENT_OPTIONS; i++) {
    var option = rawOptions[i];
    if (!option || typeof option !== 'object') {
      continue;
    }

    var optionId = sanitizeOptionId(option.id, i + 1);
    if (seenIds[optionId]) {
      optionId = optionId + '_' + (i + 1);
    }
    seenIds[optionId] = true;

    var label = limitText(option.label || option.title || optionId, MAX_OPTION_LABEL_LEN);
    if (!label) {
      continue;
    }

    options.push({
      id: optionId,
      label: label,
      value: sanitizeText(option.value || option.prompt || label)
    });
  }

  turn.screen.options = options;

  var expectResponse = !!input.expectResponse;
  if (!input.hasOwnProperty('expectResponse')) {
    expectResponse = options.length > 0 || turn.screen.actions.length > 0 || mode !== 'menu';
  }

  turn.input.mode = mode;
  turn.input.expectResponse = expectResponse;

  if (!turn.screen.body && turn.screen.type === 'card') {
    turn.screen.body = expectResponse ? 'Select or speak a response.' : 'Done.';
  }

  return turn;
}

function renderAgentTurn(turn) {
  state.agent.currentTurn = turn;
  state.agent.currentOptionsById = {};

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
