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
  }

  if (!screen.body && screen.type === 'card' && screen.actions.length === 0 && !screen.bodyTemplate) {
    screen.body = descriptor.defaults.emptyCardBody;
  }

  if (!screen.body && screen.type === 'scroll' && !screen.bodyTemplate) {
    screen.body = descriptor.defaults.emptyScrollBody;
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
