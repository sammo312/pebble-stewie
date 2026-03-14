'use strict';

var constants = require('./constants');
var schemaRegistry = require('./schema-registry');
var textUtils = require('./text-utils');
var screenActions = require('./screen-actions');

var sanitizeGraphId = screenActions.sanitizeGraphId;

function getSchemaDescriptor(schemaVersion) {
  return schemaRegistry.getSchemaDescriptor(schemaVersion) ||
    schemaRegistry.getSchemaDescriptor();
}

function normalizeRun(rawRun, schemaVersionOrDescriptor) {
  return screenActions.normalizeRun(rawRun, schemaVersionOrDescriptor);
}

function normalizeScreenInput(rawInput, descriptor) {
  var input = rawInput && typeof rawInput === 'object' ? rawInput : {};
  var mode = textUtils.sanitizeText(input.mode || descriptor.defaults.inputMode).toLowerCase();
  if (descriptor.enums.inputModes.indexOf(mode) < 0) {
    mode = descriptor.defaults.inputMode;
  }

  return {
    mode: mode
  };
}

function normalizeScreenBindings(rawBindings) {
  if (!rawBindings || typeof rawBindings !== 'object') {
    return null;
  }

  return rawBindings;
}

function clampInteger(rawValue, fallback, min, max) {
  var value = parseInt(rawValue, 10);
  if (isNaN(value)) {
    value = fallback;
  }
  if (typeof min === 'number' && value < min) {
    value = min;
  }
  if (typeof max === 'number' && value > max) {
    value = max;
  }
  return value;
}

function clampFloat(rawValue, fallback, min, max) {
  var value = parseFloat(rawValue);
  if (isNaN(value)) {
    value = fallback;
  }
  if (typeof min === 'number' && value < min) {
    value = min;
  }
  if (typeof max === 'number' && value > max) {
    value = max;
  }
  return value;
}

function normalizeBoolean(rawValue) {
  return rawValue === true || rawValue === 'true';
}

function normalizeDrawing(rawDrawing, descriptor) {
  var defaults = {
    playMode: 'loop',
    background: 'grid',
    timelineMs: 1600,
    steps: []
  };
  var drawing = rawDrawing && typeof rawDrawing === 'object' ? rawDrawing : {};
  var playMode = String(drawing.playMode || defaults.playMode).toLowerCase();
  var background = String(drawing.background || defaults.background).toLowerCase();
  var validPlayModes = ['loop', 'once', 'ping_pong'];
  var validBackgrounds = ['grid', 'dark', 'light'];
  var validKinds = ['circle', 'rect', 'text'];
  var validColors = ['ink', 'accent', 'accent2', 'danger'];
  var steps = [];
  var seenIds = {};
  var rawSteps = Array.isArray(drawing.steps) ? drawing.steps : [];

  if (validPlayModes.indexOf(playMode) < 0) {
    playMode = defaults.playMode;
  }
  if (validBackgrounds.indexOf(background) < 0) {
    background = defaults.background;
  }

  for (var i = 0; i < rawSteps.length && steps.length < descriptor.limits.maxDrawSteps; i++) {
    var step = rawSteps[i];
    if (!step || typeof step !== 'object') {
      continue;
    }

    var stepId = sanitizeGraphId(step.id, 'step_' + (i + 1), constants.MAX_ACTION_ID_LEN);
    if (seenIds[stepId]) {
      stepId = sanitizeGraphId(stepId + '_' + (i + 1), 'step_' + (i + 1), constants.MAX_ACTION_ID_LEN);
    }
    if (seenIds[stepId]) {
      continue;
    }
    seenIds[stepId] = true;

    var kind = String(step.kind || 'circle').toLowerCase();
    if (validKinds.indexOf(kind) < 0) {
      kind = 'circle';
    }

    var color = String(step.color || 'accent').toLowerCase();
    if (validColors.indexOf(color) < 0) {
      color = 'accent';
    }

    steps.push({
      id: stepId,
      kind: kind,
      label: textUtils.limitText(step.label || ('Step ' + (i + 1)), descriptor.limits.maxOptionLabelLen),
      x: clampInteger(step.x, 18 + (i * 18), 0, 144),
      y: clampInteger(step.y, 24 + (i * 20), 0, 168),
      toX: clampInteger(step.toX, 72, 0, 144),
      toY: clampInteger(step.toY, 84, 0, 168),
      width: clampInteger(step.width, 24, 4, 96),
      height: clampInteger(step.height, 24, 4, 96),
      delayMs: clampInteger(step.delayMs, i * 120, 0, 20000),
      durationMs: clampInteger(step.durationMs, 720, 120, 20000),
      fromScale: clampFloat(step.fromScale, 0.75, 0.1, 4),
      toScale: clampFloat(step.toScale, 1, 0.1, 4),
      fromOpacity: clampFloat(step.fromOpacity, 0.3, 0.05, 1),
      toOpacity: clampFloat(step.toOpacity, 1, 0.05, 1),
      fill: normalizeBoolean(step.fill),
      color: color
    });
  }

  if (steps.length === 0) {
    steps.push({
      id: 'step_1',
      kind: 'circle',
      label: 'Pulse',
      x: 18,
      y: 28,
      toX: 78,
      toY: 52,
      width: 26,
      height: 26,
      delayMs: 0,
      durationMs: 900,
      fromScale: 0.75,
      toScale: 1.05,
      fromOpacity: 0.2,
      toOpacity: 1,
      fill: false,
      color: 'accent'
    });
  }

  return {
    playMode: playMode,
    background: background,
    timelineMs: clampInteger(drawing.timelineMs, defaults.timelineMs, 240, 20000),
    steps: steps
  };
}

function normalizeMenuItems(rawItems, descriptor) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return [];
  }

  var items = [];
  var seenIds = {};

  for (var i = 0; i < rawItems.length && items.length < descriptor.limits.maxMenuItems; i++) {
    var item = rawItems[i];
    if (!item || typeof item !== 'object') {
      continue;
    }

    var itemId = sanitizeGraphId(item.id, 'item_' + (i + 1), constants.MAX_ACTION_ID_LEN);
    if (seenIds[itemId]) {
      itemId = sanitizeGraphId(itemId + '_' + (i + 1), 'item_' + (i + 1), constants.MAX_ACTION_ID_LEN);
    }
    if (seenIds[itemId]) {
      continue;
    }
    seenIds[itemId] = true;

    var label = textUtils.limitText(item.label || item.title || itemId, descriptor.limits.maxOptionLabelLen);
    if (!label) {
      continue;
    }

    items.push({
      id: itemId,
      label: label,
      labelTemplate: item.labelTemplate ? String(item.labelTemplate) : '',
      value: textUtils.sanitizeText(item.value || label),
      run: normalizeRun(item.run, descriptor)
    });
  }

  return items;
}

function normalizeGraphScreen(rawScreen, fallbackId, schemaVersionOrDescriptor) {
  if (!rawScreen || typeof rawScreen !== 'object') {
    return null;
  }

  var descriptor = getSchemaDescriptor(schemaVersionOrDescriptor && schemaVersionOrDescriptor.schemaVersion ?
    schemaVersionOrDescriptor.schemaVersion : schemaVersionOrDescriptor);
  if (schemaVersionOrDescriptor && schemaVersionOrDescriptor.schemaVersion && schemaVersionOrDescriptor.enums) {
    descriptor = schemaVersionOrDescriptor;
  }

  var screenId = sanitizeGraphId(rawScreen.id, fallbackId || 'screen', descriptor.limits.maxScreenIdLen);
  var screenType = textUtils.sanitizeText(rawScreen.type || descriptor.defaults.screenType).toLowerCase();
  if (descriptor.enums.screenTypes.indexOf(screenType) < 0) {
    screenType = descriptor.defaults.screenType;
  }

  var bodyLimit = screenType === 'scroll' ? descriptor.limits.maxScrollBodyLen : descriptor.limits.maxBodyLen;
  var screen = {
    id: screenId,
    type: screenType,
    title: textUtils.limitText(rawScreen.title || screenId, descriptor.limits.maxTitleLen),
    body: textUtils.limitText(rawScreen.body || '', bodyLimit),
    titleTemplate: rawScreen.titleTemplate ? String(rawScreen.titleTemplate) : '',
    bodyTemplate: rawScreen.bodyTemplate ? String(rawScreen.bodyTemplate) : '',
    bindings: normalizeScreenBindings(rawScreen.bindings),
    input: normalizeScreenInput(rawScreen.input, descriptor)
  };

  if (screenType === 'menu') {
    screen.items = normalizeMenuItems(rawScreen.items || [], descriptor);
  } else if (screenType === 'card') {
    screen.actions = screenActions.normalizeScreenActions(rawScreen.actions || [], descriptor);
  } else if (screenType === 'scroll') {
    screen.actions = screenActions.normalizeMenuActions(rawScreen.actions || [], descriptor);
  } else if (screenType === 'draw') {
    screen.drawing = normalizeDrawing(rawScreen.drawing, descriptor);
  }

  if (!screen.body && screen.type === 'card' && screen.actions.length === 0 && !screen.bodyTemplate) {
    screen.body = descriptor.defaults.emptyCardBody;
  }

  if (!screen.body && screen.type === 'scroll' && !screen.bodyTemplate) {
    screen.body = descriptor.defaults.emptyScrollBody;
  }

  if (!screen.body && screen.type === 'draw' && !screen.bodyTemplate) {
    screen.body = 'Animated drawing';
  }

  return screen;
}

function normalizeCanonicalGraph(rawGraph) {
  if (!rawGraph || typeof rawGraph !== 'object') {
    return null;
  }

  var descriptor = schemaRegistry.getSchemaDescriptor(String(rawGraph.schemaVersion || ''));
  if (!descriptor) {
    return null;
  }

  if (!rawGraph.screens || typeof rawGraph.screens !== 'object') {
    return null;
  }

  var normalizedScreens = {};
  var screenKeys = Object.keys(rawGraph.screens);
  if (screenKeys.length === 0) {
    return null;
  }

  for (var i = 0; i < screenKeys.length; i++) {
    var rawScreenKey = screenKeys[i];
    var normalizedScreen = normalizeGraphScreen(rawGraph.screens[rawScreenKey], rawScreenKey, descriptor);
    if (!normalizedScreen) {
      return null;
    }
    if (normalizedScreens[normalizedScreen.id]) {
      return null;
    }
    normalizedScreens[normalizedScreen.id] = normalizedScreen;
  }

  var entryScreenId = sanitizeGraphId(rawGraph.entryScreenId, '', descriptor.limits.maxScreenIdLen);
  if (!entryScreenId) {
    return null;
  }

  if (!normalizedScreens[entryScreenId]) {
    return null;
  }

  return {
    schemaVersion: descriptor.schemaVersion,
    entryScreenId: entryScreenId,
    screens: normalizedScreens
  };
}

module.exports = {
  getSchemaDescriptor: getSchemaDescriptor,
  normalizeCanonicalGraph: normalizeCanonicalGraph,
  normalizeGraphScreen: normalizeGraphScreen,
  normalizeRun: normalizeRun
};
