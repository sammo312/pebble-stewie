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
var BOBBY_DEFAULT_QUERY_URL = 'wss://bobby-api.rebble.io/query';

var state = {
  currentScreenId: null,
  history: [],
  currentCardActionsById: {},
  agent: {
    ws: null,
    sessionToken: 0,
    threadId: '',
    awaiting: false,
    responseBuffer: '',
    conversationStarted: false,
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
      { id: 'agent-quickstart', label: 'Start Conversation', agentPrompt: 'Start a useful short conversation. Ask me a yes or no question first.' },
      { id: VOICE_INPUT_ITEM_ID, label: 'Speak to Bobby' },
      { id: 'agent-reset', label: 'Reset Thread', agentCommand: 'reset' },
      { id: 'agent-help', label: 'Schema Help', next: 'agent-help-card' }
    ]
  },
  'agent-help-card': {
    id: 'agent-help-card',
    type: 'card',
    title: 'Agent Setup',
    body: 'Set localStorage bobby-token and optional bobby-query-url.'
  },
  'status-card': {
    id: 'status-card',
    type: 'card',
    title: 'System Status',
    body: 'Phone brain online. Watch is rendering SDUI from the phone.',
    actions: [
      { slot: 'select', id: 'status-home', icon: 'check', next: 'root' }
    ]
  },
  'about-card': {
    id: 'about-card',
    type: 'card',
    title: 'About',
    body: 'Watch renders. Phone + agent decide next screens.'
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

function getBobbyConfig() {
  var queryUrl = localStorage.getItem('bobby-query-url') || BOBBY_DEFAULT_QUERY_URL;
  var token = localStorage.getItem('bobby-token') || '';
  return { queryUrl: queryUrl, token: token };
}

function requestTimelineToken(onDone) {
  if (!Pebble.getTimelineToken) {
    onDone('');
    return;
  }

  Pebble.getTimelineToken(
    function(token) {
      var cleaned = token ? String(token) : '';
      if (cleaned) {
        localStorage.setItem('bobby-token', cleaned);
        console.log('Stored bobby-token from timeline token');
      }
      onDone(cleaned);
    },
    function(error) {
      console.log('Timeline token lookup failed:', JSON.stringify(error));
      onDone('');
    }
  );
}

function requestAccountToken(onDone) {
  if (!Pebble.getAccountToken) {
    onDone('');
    return;
  }

  var finished = false;
  function complete(token) {
    if (finished) {
      return;
    }
    finished = true;
    onDone(token || '');
  }

  try {
    var maybeToken = Pebble.getAccountToken(
      function(token) {
        var cleaned = token ? String(token) : '';
        if (cleaned) {
          localStorage.setItem('bobby-token', cleaned);
          console.log('Stored bobby-token from account token');
        }
        complete(cleaned);
      },
      function(error) {
        console.log('Account token lookup failed:', JSON.stringify(error));
        complete('');
      }
    );

    if (maybeToken && typeof maybeToken === 'string') {
      var directToken = String(maybeToken);
      if (directToken) {
        localStorage.setItem('bobby-token', directToken);
        console.log('Stored bobby-token from direct account token');
      }
      complete(directToken);
    }
  } catch (error) {
    console.log('Account token lookup threw:', error && error.message ? error.message : error);
    complete('');
  }
}

function requestPlatformToken(onDone) {
  requestTimelineToken(function(timelineToken) {
    if (timelineToken) {
      onDone(timelineToken);
      return;
    }

    requestAccountToken(function(accountToken) {
      onDone(accountToken || '');
    });
  });
}

function ensureBobbyToken(onDone) {
  var existing = localStorage.getItem('bobby-token') || '';
  var config = getBobbyConfig();

  if (existing && config.queryUrl !== BOBBY_DEFAULT_QUERY_URL) {
    onDone(existing);
    return;
  }

  requestPlatformToken(function(token) {
    if (token) {
      onDone(token);
      return;
    }
    onDone(existing || '');
  });
}

function classifyBobbyCloseReason(reasonText) {
  var normalized = sanitizeText(reasonText).toLowerCase();
  if (!normalized) {
    return '';
  }

  if (normalized.indexOf('get user info failed') >= 0 || normalized.indexOf('no token provided') >= 0) {
    return 'auth';
  }

  if (normalized.indexOf('active rebble subscription') >= 0 || normalized.indexOf('subscription') >= 0) {
    return 'subscription';
  }

  if (normalized.indexOf('exceeded your quota') >= 0 || normalized.indexOf('quota') >= 0) {
    return 'quota';
  }

  if (normalized.indexOf('unavailable right now') >= 0) {
    return 'unavailable';
  }

  return '';
}

function closeAgentSocket() {
  if (state.agent.ws) {
    try {
      state.agent.ws.close();
    } catch (error) {
      console.log('Closing websocket failed:', error && error.message ? error.message : error);
    }
  }

  state.agent.ws = null;
  state.agent.awaiting = false;
  state.agent.responseBuffer = '';
}

function clearAgentTurnState() {
  state.agent.currentTurn = null;
  state.agent.currentOptionsById = {};
}

function resetAgentConversation(resetThread) {
  closeAgentSocket();
  clearAgentTurnState();
  state.agent.conversationStarted = false;

  if (resetThread) {
    state.agent.threadId = '';
  }
}

function renderAgentStatusCard(title, body) {
  state.agent.turnIndex++;
  sendRender({
    id: 'agent-status-' + state.agent.turnIndex,
    type: 'card',
    title: limitText(title || 'Bobby', MAX_TITLE_LEN),
    body: body || ''
  });
}

function extractFirstJsonObject(text) {
  if (!text) {
    return null;
  }

  var start = text.indexOf('{');
  if (start < 0) {
    return null;
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

  return null;
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

function normalizeAgentTurn(rawTurn) {
  if (!rawTurn || typeof rawTurn !== 'object') {
    return null;
  }

  var turn = {
    schemaVersion: SDUI_SCHEMA_VERSION,
    screen: {
      type: 'card',
      title: 'Bobby',
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

  var screenType = String(screen.type || 'card').toLowerCase();
  if (screenType !== 'menu' && screenType !== 'card') {
    screenType = 'card';
  }

  turn.screen.type = screenType;
  turn.screen.title = limitText(screen.title || rawTurn.title || 'Bobby', MAX_TITLE_LEN);
  turn.screen.body = limitText(screen.body || rawTurn.body || '', MAX_BODY_LEN);
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

  if (!turn.screen.title) {
    turn.screen.title = 'Bobby';
  }

  if (!turn.screen.body && turn.screen.type === 'card' && !expectResponse) {
    turn.screen.body = 'No response body provided.';
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

  var menuTitle = turn.screen.title;
  if (turn.screen.body && turn.screen.body !== menuTitle) {
    menuTitle = limitText(turn.screen.body, MAX_TITLE_LEN);
  }

  sendRender({
    id: 'agent-turn-' + state.agent.turnIndex,
    type: 'menu',
    title: menuTitle,
    items: menuItems
  });
}

function renderAgentFallback(rawText) {
  clearAgentTurnState();
  state.agent.turnIndex++;
  sendRender({
    id: 'agent-fallback-' + state.agent.turnIndex,
    type: 'card',
    title: 'Agent Response',
    body: limitText(rawText || 'No structured response.', MAX_BODY_LEN)
  });
}

function handleAgentRawResponse(rawText) {
  var cleaned = String(rawText || '').replace(/<<!!WIDGET:[\s\S]*?!!>>/g, ' ').trim();
  var jsonText = extractFirstJsonObject(cleaned);

  if (!jsonText) {
    renderAgentFallback(cleaned || 'No JSON object in response.');
    return;
  }

  var parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    renderAgentFallback('Invalid JSON: ' + error.message);
    return;
  }

  var normalized = normalizeAgentTurn(parsed);
  if (!normalized) {
    renderAgentFallback('Response did not match SDUI schema.');
    return;
  }

  renderAgentTurn(normalized);
}

function buildStructuredPrompt(userText, reason) {
  var promptParts = [
    'You are Bobby, producing server-driven UI turns for a Pebble watch runtime.',
    'Respond with ONLY a single JSON object and no markdown, no prose.',
    'Schema:',
    '{',
    '  "schemaVersion": "pebble.sdui.v1",',
    '  "screen": {',
    '    "type": "menu" | "card",',
    '    "title": "short title",',
    '    "body": "short body text",',
    '    "actions": [',
    '      {"slot":"select","id":"yes","icon":"check","label":"Yes","value":"yes"}',
    '    ],',
    '    "options": [',
    '      {"id":"yes","label":"Yes","value":"yes"}',
    '    ]',
    '  },',
    '  "input": {',
    '    "mode": "menu" | "voice" | "menu_or_voice",',
    '    "expectResponse": true | false',
    '  }',
    '}',
    'Rules:',
    '- schemaVersion must be pebble.sdui.v1',
    '- title <= 24 chars, body <= 140 chars',
    '- options <= 5, label <= 18 chars',
    '- actions are optional and only for card screens',
    '- actions <= 3, slots must be unique: up/select/down',
    '- action icon must be one of: play, pause, check, x, plus, minus',
    '- For yes/no prompts, use options with ids yes/no and labels Yes/No',
    '- If expecting spoken reply, set input.mode to voice or menu_or_voice',
    '- Do not include widgets, tool calls, or extra keys outside this schema unless essential.',
    '',
    'Turn reason: ' + reason,
    'User input: ' + userText,
    'Return JSON now.'
  ];

  return promptParts.join('\n');
}

function buildBobbyQueryUrl(prompt) {
  var config = getBobbyConfig();
  var url = config.queryUrl + '?prompt=' + encodeURIComponent(prompt);

  if (config.token) {
    url += '&token=' + encodeURIComponent(config.token);
  }

  if (state.agent.threadId) {
    url += '&threadId=' + encodeURIComponent(state.agent.threadId);
  }

  url += '&location=unknown';
  url += '&tzOffset=' + (-(new Date()).getTimezoneOffset());
  url += '&actions=';
  url += '&widgets=';

  if (Pebble.getActiveWatchInfo) {
    var info = Pebble.getActiveWatchInfo();
    if (info && info.platform) {
      if (info.platform === 'aplite' || info.platform === 'diorite') {
        url += '&supportsColour=false&screenWidth=144&screenHeight=168';
      } else if (info.platform === 'chalk') {
        url += '&supportsColour=true&screenWidth=180&screenHeight=180';
      } else if (info.platform === 'emery') {
        url += '&supportsColour=true&screenWidth=200&screenHeight=228';
      } else {
        url += '&supportsColour=true&screenWidth=144&screenHeight=168';
      }
    }
  }

  return url;
}

function queryAgent(userInput, reason, retryCount) {
  var authRetryCount = retryCount || 0;

  ensureBobbyToken(function(token) {
    var config = getBobbyConfig();
    if (!token && !config.token) {
      renderAgentStatusCard('Agent Setup', 'Missing timeline token. Sign into Rebble and retry.');
      return;
    }

    closeAgentSocket();
    clearAgentTurnState();

    var requestToken = ++state.agent.sessionToken;
    var prompt = buildStructuredPrompt(userInput, reason);
    var socketUrl = buildBobbyQueryUrl(prompt);

    state.agent.awaiting = true;
    state.agent.responseBuffer = '';

    renderAgentStatusCard('Bobby', 'Thinking...');
    console.log('Bobby query URL:', socketUrl);

    var ws;
    try {
      ws = new WebSocket(socketUrl);
    } catch (error) {
      state.agent.awaiting = false;
      renderAgentStatusCard('Bobby Error', 'WebSocket open failed: ' + String(error && error.message ? error.message : error));
      return;
    }

    state.agent.ws = ws;
    var completed = false;

    ws.addEventListener('message', function(event) {
      if (requestToken !== state.agent.sessionToken) {
        return;
      }

      var message = event && event.data ? String(event.data) : '';
      if (!message) {
        return;
      }

      var prefix = message.charAt(0);
      var content = message.substring(1);

      if (prefix === 'c') {
        state.agent.responseBuffer += content;
        return;
      }

      if (prefix === 'f') {
        return;
      }

      if (prefix === 'w') {
        state.agent.responseBuffer += '\nWarning: ' + content;
        return;
      }

      if (prefix === 't') {
        state.agent.threadId = content;
        return;
      }

      if (prefix === 'a') {
        state.agent.responseBuffer += '\nAction requested by Bobby was ignored in SDUI mode.';
        return;
      }

      if (prefix === 'd') {
        completed = true;
        state.agent.awaiting = false;
        state.agent.ws = null;
        handleAgentRawResponse(state.agent.responseBuffer);
      }
    });

    ws.addEventListener('close', function(event) {
      if (requestToken !== state.agent.sessionToken) {
        return;
      }

      state.agent.ws = null;
      state.agent.awaiting = false;

      if (completed) {
        return;
      }

      var code = event && event.code ? event.code : 0;
      var reasonText = event && event.reason ? event.reason : '';
      var closeReason = classifyBobbyCloseReason(reasonText);

      if (closeReason === 'auth') {
        localStorage.removeItem('bobby-token');
        if (authRetryCount < 1) {
          requestPlatformToken(function(refreshedToken) {
            if (refreshedToken) {
              renderAgentStatusCard('Bobby', 'Retrying with refreshed token...');
              queryAgent(userInput, reason, authRetryCount + 1);
              return;
            }
            renderAgentStatusCard('Bobby Auth', 'Token rejected. Re-login Rebble. If it persists, default Bobby API may reject custom app UUIDs.');
          });
          return;
        }

        renderAgentStatusCard('Bobby Auth', 'Token rejected. Re-login Rebble. If it persists, default Bobby API may reject custom app UUIDs.');
        return;
      }

      if (closeReason === 'subscription') {
        renderAgentStatusCard('Bobby Plan', 'Bobby needs an active Rebble subscription.');
        return;
      }

      if (closeReason === 'quota') {
        renderAgentStatusCard('Bobby Quota', 'Monthly Bobby quota exceeded.');
        return;
      }

      if (closeReason === 'unavailable') {
        renderAgentStatusCard('Bobby', 'Bobby unavailable right now. Try again soon.');
        return;
      }
      renderAgentStatusCard('Bobby Closed', 'Connection closed (' + code + ') ' + reasonText);
    });

    ws.addEventListener('error', function() {
      if (requestToken !== state.agent.sessionToken) {
        return;
      }

      state.agent.awaiting = false;
      renderAgentStatusCard('Bobby Error', 'WebSocket error while waiting for response.');
    });
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
  closeAgentSocket();
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

  var currentScreen = resolveScreen(state.currentScreenId);
  if (!currentScreen || currentScreen.type !== 'card') {
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

  console.log('Card action selected with no handler:', selectedAction.id);
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
  ensureBobbyToken(function(token) {
    if (token) {
      console.log('Bobby token available');
    }
  });
  if (!state.currentScreenId) {
    state.history = [];
    transitionTo('root', false);
  }
});

Pebble.addEventListener('appmessage', function(event) {
  var payload = event && event.payload ? event.payload : {};
  handleActionMessage(payload);
});
