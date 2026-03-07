'use strict';

var MSG_TYPE_RENDER = 1;
var MSG_TYPE_ACTION = 2;

var UI_TYPE_MENU = 1;
var UI_TYPE_CARD = 2;

var ACTION_TYPE_READY = 1;
var ACTION_TYPE_SELECT = 2;
var ACTION_TYPE_BACK = 3;

var MAX_MENU_ITEMS = 8;

var state = {
  currentScreenId: null,
  history: []
};

var staticScreens = {
  root: {
    id: 'root',
    type: 'menu',
    title: 'Main Menu',
    items: [
      { id: 'controls', label: 'Controls', next: 'controls' },
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
  'status-card': {
    id: 'status-card',
    type: 'card',
    title: 'System Status',
    body: 'Phone brain online. Watch is rendering remote UI.'
  },
  'about-card': {
    id: 'about-card',
    type: 'card',
    title: 'About',
    body: 'This app is driven by a phone-side state machine.'
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

function parseNumber(value, fallback) {
  var parsed = Number(value);
  return isNaN(parsed) ? fallback : parsed;
}

function encodeItems(items) {
  var safeItems = (items || []).slice(0, MAX_MENU_ITEMS);

  return safeItems
    .map(function(item, index) {
      var label = sanitizeText(item.label || item.title || ('Item ' + (index + 1)));
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

  var payload = {
    msgType: MSG_TYPE_RENDER,
    uiType: screen.type === 'menu' ? UI_TYPE_MENU : UI_TYPE_CARD,
    screenId: sanitizeText(screen.id),
    title: sanitizeText(screen.title)
  };

  if (screen.type === 'menu') {
    payload.items = encodeItems(screen.items);
  } else {
    payload.body = screen.body ? String(screen.body) : '';
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

function handleBack() {
  if (state.history.length === 0) {
    transitionTo('root', false);
    return;
  }

  var previous = state.history.pop();
  transitionTo(previous, false);
}

function handleSelect(action) {
  var currentScreen = resolveScreen(state.currentScreenId);
  if (!currentScreen || currentScreen.type !== 'menu') {
    return;
  }

  var selectedItem = getSelectedItemFromAction(action, currentScreen);
  if (!selectedItem || !selectedItem.next) {
    return;
  }

  transitionTo(selectedItem.next, true);
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
    index: parseNumber(payload.actionIndex, -1)
  };

  if (action.screenId) {
    state.currentScreenId = action.screenId;
  }

  if (actionType === ACTION_TYPE_READY) {
    state.history = [];
    transitionTo('root', false);
    return;
  }

  if (actionType === ACTION_TYPE_SELECT) {
    handleSelect(action);
    return;
  }

  if (actionType === ACTION_TYPE_BACK) {
    handleBack();
  }
}

Pebble.addEventListener('ready', function() {
  console.log('Phone brain ready');
  state.history = [];
  transitionTo('root', false);
});

Pebble.addEventListener('appmessage', function(event) {
  var payload = event && event.payload ? event.payload : {};
  handleActionMessage(payload);
});
