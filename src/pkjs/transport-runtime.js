'use strict';

var constants = require('./constants');
var textUtils = require('./text-utils');
var screenActions = require('./screen-actions');
var drawCodec = require('./draw-codec');

var MSG_TYPE_RENDER = constants.MSG_TYPE_RENDER;
var UI_TYPE_MENU = constants.UI_TYPE_MENU;
var UI_TYPE_CARD = constants.UI_TYPE_CARD;
var UI_TYPE_SCROLL = constants.UI_TYPE_SCROLL;
var UI_TYPE_DRAW = constants.UI_TYPE_DRAW;
var UI_TYPE_VOICE = constants.UI_TYPE_VOICE;
var MAX_TITLE_LEN = constants.MAX_TITLE_LEN;
var MAX_BODY_LEN = constants.MAX_BODY_LEN;
var MAX_SCROLL_BODY_LEN = constants.MAX_SCROLL_BODY_LEN;

var sanitizeText = textUtils.sanitizeText;
var limitText = textUtils.limitText;
var parseNumber = textUtils.parseNumber;

var normalizeScreenActions = screenActions.normalizeScreenActions;
var normalizeMenuActions = screenActions.normalizeMenuActions;
var encodeActions = screenActions.encodeActions;
var encodeMenuActions = screenActions.encodeMenuActions;
var buildActionLookup = screenActions.buildActionLookup;
var encodeItems = screenActions.encodeItems;
var encodeDrawingPayload = drawCodec.encodeDrawingPayload;

function scheduleLiveRender(screenId, refreshMs, deps) {
  deps.clearLiveRenderTimer();
  if (!screenId || refreshMs <= 0) {
    return;
  }

  deps.setLiveRenderTimer(
    deps.setTimeout(function() {
      if (deps.getCurrentScreenId() !== screenId) {
        return;
      }

      var liveScreen = deps.getCurrentScreenDefinition();
      if (!liveScreen) {
        return;
      }

      deps.sendRender(liveScreen, { resetTimer: false });
    }, refreshMs)
  );
}

function syncScreenTimer(screen, resetTimer, deps) {
  var timer = screen && screen.timer && typeof screen.timer === 'object' ? screen.timer : null;
  var durationMs = parseNumber(timer && timer.durationMs, 0);
  if (!timer || !timer.run || durationMs <= 0) {
    deps.clearScreenTimer();
    return;
  }

  if (!resetTimer && deps.getScreenTimerDeadline() > 0) {
    return;
  }

  deps.clearScreenTimer();
  deps.setScreenTimerDeadline(deps.now() + durationMs);
  deps.setScreenTimerId(
    deps.setTimeout(function() {
      deps.setScreenTimerId(null);
      deps.setScreenTimerDeadline(0);
      if (deps.getCurrentScreenId() !== screen.id) {
        return;
      }
      deps.executeTypedAction(timer.run, 'screen_timer');
    }, durationMs)
  );
}

function buildRenderState(screen, deps) {
  var isMenu = screen.type === 'menu';
  var isScroll = screen.type === 'scroll';
  var isDraw = screen.type === 'draw';
  var isCard = screen.type === 'card';
  var isVoice = screen.type === 'voice';
  var normalizedMenuActions = isScroll ? normalizeMenuActions(screen.actions || []) : [];
  var normalizedActions = isCard ? normalizeScreenActions(screen.actions || []) : [];
  var uiType = isVoice ? UI_TYPE_VOICE : (isMenu ? UI_TYPE_MENU : (isScroll ? UI_TYPE_SCROLL : (isDraw ? UI_TYPE_DRAW : UI_TYPE_CARD)));
  var payload = {
    msgType: MSG_TYPE_RENDER,
    uiType: uiType,
    screenId: sanitizeText(screen.id),
    title: limitText(screen.title || 'Screen', MAX_TITLE_LEN)
  };
  var currentCardActionsById = {};
  var currentMenuActionsById = {};

  if (isVoice) {
    payload.body = '';
    payload.actions = '';
  } else if (isMenu) {
    payload.items = encodeItems(screen.items);
    payload.actions = '';
    payload.body = screen.body ? String(screen.body) : '';
  } else if (isDraw) {
    payload.body = screen.body ? limitText(screen.body, MAX_BODY_LEN) : '';
    payload.actions = '';
    payload.drawing = encodeDrawingPayload(screen.drawing);
  } else {
    var bodyLimit = isScroll ? MAX_SCROLL_BODY_LEN : MAX_BODY_LEN;
    payload.body = screen.body ? limitText(screen.body, bodyLimit) : '';
    if (isCard) {
      payload.actions = encodeActions(normalizedActions);
      currentCardActionsById = buildActionLookup(normalizedActions);
    } else {
      payload.actions = encodeMenuActions(normalizedMenuActions);
    }
    currentMenuActionsById = isScroll ? buildActionLookup(normalizedMenuActions) : {};
  }

  return {
    payload: payload,
    currentRenderedScreen: screen,
    currentCardActionsById: currentCardActionsById,
    currentMenuActionsById: currentMenuActionsById
  };
}

function sendRender(screen, options, deps) {
  if (!screen) {
    return;
  }

  var resetTimer = !options || options.resetTimer !== false;
  deps.clearLiveRenderTimer();
  deps.setCurrentScreenDefinition(screen);
  syncScreenTimer(screen, resetTimer, deps);

  var prepared = deps.applyScreenBindings(screen);
  screen = deps.prepareScreenForRender(prepared.screen);

  var renderState = buildRenderState(screen, deps);
  var pendingEffects = deps.getPendingEffects();

  deps.setCurrentRenderedScreen(renderState.currentRenderedScreen);
  deps.setCurrentCardActionsById(renderState.currentCardActionsById);
  deps.setCurrentMenuActionsById(renderState.currentMenuActionsById);

  if (pendingEffects.vibe) {
    renderState.payload.effectVibe = pendingEffects.vibe;
  }
  if (pendingEffects.light) {
    renderState.payload.effectLight = 1;
  }
  deps.clearPendingEffects();

  deps.sendAppMessage(
    renderState.payload,
    function() {
      deps.log('Render sent:', screen.id);
    },
    function(error) {
      deps.log('Render failed:', JSON.stringify(error));
    }
  );

  deps.setCurrentScreenId(screen.id);
  var refreshMs = prepared.refreshMs;
  if (screen.timer && deps.getScreenTimerDeadline() > 0) {
    refreshMs = refreshMs > 0 ? Math.min(refreshMs, 1000) : 1000;
  }
  scheduleLiveRender(screen.id, refreshMs, deps);
}

module.exports = {
  scheduleLiveRender: scheduleLiveRender,
  syncScreenTimer: syncScreenTimer,
  buildRenderState: buildRenderState,
  sendRender: sendRender
};
