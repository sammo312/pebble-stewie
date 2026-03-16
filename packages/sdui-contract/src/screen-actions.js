'use strict';

var constants = require('./constants');
var schemaRegistry = require('./schema-registry');
var textUtils = require('./text-utils');

function resolveDescriptor(schemaVersionOrDescriptor) {
  if (schemaVersionOrDescriptor && schemaVersionOrDescriptor.schemaVersion && schemaVersionOrDescriptor.enums) {
    return schemaVersionOrDescriptor;
  }

  return schemaRegistry.getSchemaDescriptor(schemaVersionOrDescriptor) ||
    schemaRegistry.getSchemaDescriptor();
}

function sanitizeGraphId(id, fallback, maxLen) {
  var raw = textUtils.sanitizeText(id).toLowerCase();
  if (!raw) {
    raw = fallback || 'screen';
  }

  var cleaned = raw.replace(/[^a-z0-9_-]/g, '_');
  if (!cleaned) {
    cleaned = fallback || 'screen';
  }

  return cleaned.substring(0, maxLen || constants.MAX_ACTION_ID_LEN);
}

function sanitizeVarKey(key) {
  return sanitizeGraphId(key, '', constants.MAX_ACTION_ID_LEN);
}

function normalizeCondition(rawCondition, descriptor) {
  if (!rawCondition || typeof rawCondition !== 'object') {
    return null;
  }

  var conditionOps = descriptor && descriptor.enums && Array.isArray(descriptor.enums.conditionOps) ?
    descriptor.enums.conditionOps : [];
  var key = sanitizeVarKey(rawCondition.var);
  var op = textUtils.sanitizeText(rawCondition.op).toLowerCase();
  var value = textUtils.sanitizeText(rawCondition.value);

  if (!key || conditionOps.indexOf(op) < 0) {
    return null;
  }

  return {
    var: key,
    op: op,
    value: value
  };
}

function normalizeRun(rawRun, schemaVersionOrDescriptor) {
  if (!rawRun || typeof rawRun !== 'object') {
    return null;
  }

  var descriptor = resolveDescriptor(schemaVersionOrDescriptor);
  var type = textUtils.sanitizeText(rawRun.type).toLowerCase();
  var vibe = textUtils.sanitizeText(rawRun.vibe || '').toLowerCase();
  var light = !!rawRun.light;

  if (descriptor.enums.runTypes.indexOf(type) < 0) {
    return null;
  }

  if (vibe && descriptor.enums.vibeTypes.indexOf(vibe) < 0) {
    vibe = '';
  }

  if (type === 'navigate') {
    var targetScreen = sanitizeGraphId(rawRun.screen, '', constants.MAX_SCREEN_ID_LEN);
    if (!targetScreen) {
      return null;
    }
    var condition = normalizeCondition(rawRun.condition, descriptor);
    var nav = {
      type: 'navigate',
      screen: targetScreen
    };
    if (condition) { nav.condition = condition; }
    if (vibe) { nav.vibe = vibe; }
    if (light) { nav.light = true; }
    return nav;
  }

  if (type === 'set_var') {
    var key = sanitizeVarKey(rawRun.key);
    var value = textUtils.sanitizeText(rawRun.value);
    if (!key || !value) {
      return null;
    }
    var setVar = {
      type: 'set_var',
      key: key,
      value: value
    };
    if (vibe) { setVar.vibe = vibe; }
    if (light) { setVar.light = true; }
    return setVar;
  }

  if (type === 'store') {
    var storageKey = sanitizeVarKey(rawRun.key);
    var storageValue = textUtils.sanitizeText(rawRun.value);
    if (!storageKey || !storageValue) {
      return null;
    }
    var store = {
      type: 'store',
      key: storageKey,
      value: storageValue
    };
    if (vibe) { store.vibe = vibe; }
    if (light) { store.light = true; }
    return store;
  }

  if (type === 'agent_prompt') {
    var prompt = textUtils.sanitizeText(rawRun.prompt);
    if (!prompt) {
      return null;
    }
    var ap = {
      type: 'agent_prompt',
      prompt: prompt
    };
    if (vibe) { ap.vibe = vibe; }
    if (light) { ap.light = true; }
    return ap;
  }

  if (type === 'agent_command') {
    var command = textUtils.sanitizeText(rawRun.command).toLowerCase();
    if (!command) {
      return null;
    }
    var ac = {
      type: 'agent_command',
      command: command
    };
    if (vibe) { ac.vibe = vibe; }
    if (light) { ac.light = true; }
    return ac;
  }

  if (type === 'effect') {
    if (!vibe && !light) {
      return null;
    }
    var effect = {
      type: 'effect'
    };
    if (vibe) { effect.vibe = vibe; }
    if (light) { effect.light = true; }
    return effect;
  }

  if (type === 'dictation') {
    var rawVariable = textUtils.sanitizeText(rawRun.variable).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (!rawVariable) {
      return null;
    }
    var dictation = {
      type: 'dictation',
      variable: rawVariable.substring(0, constants.MAX_ACTION_ID_LEN)
    };
    var dictScreen = rawRun.screen ? sanitizeGraphId(rawRun.screen, '', constants.MAX_SCREEN_ID_LEN) : '';
    if (dictScreen) { dictation.screen = dictScreen; }
    if (rawRun.then && typeof rawRun.then === 'object' && rawRun.then.type) {
      var normalizedThen = normalizeRun(rawRun.then, schemaVersionOrDescriptor);
      if (normalizedThen) { dictation.then = normalizedThen; }
    }
    if (vibe) { dictation.vibe = vibe; }
    if (light) { dictation.light = true; }
    return dictation;
  }

  return null;
}

function sanitizeActionId(id, slot, index) {
  var raw = textUtils.sanitizeText(id).toLowerCase();
  if (!raw) {
    raw = slot + '_' + index;
  }

  var cleaned = raw.replace(/[^a-z0-9_-]/g, '_');
  if (!cleaned) {
    cleaned = slot + '_' + index;
  }

  return cleaned.substring(0, constants.MAX_ACTION_ID_LEN);
}

function normalizeActionSlot(slot, descriptor) {
  var value = textUtils.sanitizeText(slot).toLowerCase();
  for (var i = 0; i < descriptor.enums.actionSlots.length; i++) {
    if (descriptor.enums.actionSlots[i] === value) {
      return value;
    }
  }
  return '';
}

function normalizeActionIcon(icon, descriptor) {
  var token = textUtils.sanitizeText(icon).toLowerCase();
  if (descriptor.enums.actionIcons.indexOf(token) < 0) {
    return 'check';
  }
  return token;
}

function looksLikeTemplateText(value) {
  return /\{\{|\}\}/.test(String(value || ''));
}

function normalizeScreenActions(rawActions, schemaVersionOrDescriptor) {
  if (!rawActions || !rawActions.length) {
    return [];
  }

  var descriptor = resolveDescriptor(schemaVersionOrDescriptor);
  var actions = [];
  var seenSlots = {};
  var seenIds = {};
  for (var i = 0; i < rawActions.length && actions.length < descriptor.limits.maxCardActions; i++) {
    var action = rawActions[i];
    if (!action || typeof action !== 'object') {
      continue;
    }

    var slot = normalizeActionSlot(action.slot || action.button, descriptor);
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

    var label = textUtils.limitText(action.label || action.title || actionId, constants.MAX_OPTION_LABEL_LEN);
    var labelTemplate = action.labelTemplate ? String(action.labelTemplate) : '';
    if (!labelTemplate && looksLikeTemplateText(label)) {
      labelTemplate = label;
    }
    actions.push({
      id: actionId,
      slot: slot,
      icon: normalizeActionIcon(action.icon, descriptor),
      label: label || actionId,
      labelTemplate: labelTemplate,
      value: textUtils.sanitizeText(action.value || label || actionId),
      run: normalizeRun(action.run, descriptor)
    });
  }

  return actions;
}

function normalizeMenuActions(rawActions, schemaVersionOrDescriptor) {
  if (!rawActions || !rawActions.length) {
    return [];
  }

  var descriptor = resolveDescriptor(schemaVersionOrDescriptor);
  var actions = [];
  var seenIds = {};

  for (var i = 0; i < rawActions.length && actions.length < descriptor.limits.maxMenuActions; i++) {
    var action = rawActions[i];
    if (!action || typeof action !== 'object') {
      continue;
    }

    var actionId = sanitizeActionId(action.id, 'menu_action', i + 1);
    if (seenIds[actionId]) {
      actionId = sanitizeActionId(actionId + '_' + (i + 1), 'menu_action', i + 1);
    }
    if (seenIds[actionId]) {
      continue;
    }
    seenIds[actionId] = true;

    var label = textUtils.limitText(action.label || action.title || actionId, constants.MAX_OPTION_LABEL_LEN);
    if (!label) {
      continue;
    }

    var labelTemplate = action.labelTemplate ? String(action.labelTemplate) : '';
    if (!labelTemplate && looksLikeTemplateText(label)) {
      labelTemplate = label;
    }

    actions.push({
      id: actionId,
      label: label,
      labelTemplate: labelTemplate,
      value: textUtils.sanitizeText(action.value || label || actionId),
      run: normalizeRun(action.run, descriptor)
    });
  }

  return actions;
}

function encodeActions(actions) {
  if (!actions || actions.length === 0) {
    return '';
  }

  return actions
    .slice(0, constants.MAX_CARD_ACTIONS)
    .map(function(action) {
      return action.slot + '|' + action.id + '|' + action.icon;
    })
    .join('\n');
}

function encodeMenuActions(actions) {
  if (!actions || actions.length === 0) {
    return '';
  }

  return actions
    .slice(0, constants.MAX_MENU_ACTIONS)
    .map(function(action, index) {
      var label = textUtils.limitText(action.label || action.title || ('Action ' + (index + 1)),
        constants.MAX_OPTION_LABEL_LEN);
      var id = textUtils.sanitizeText(action.id || ('menu-action-' + index));
      return id + '|' + label;
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
  var safeItems = (items || []).slice(0, constants.MAX_MENU_ITEMS);

  return safeItems
    .map(function(item, index) {
      var label = textUtils.limitText(item.label || item.title || ('Item ' + (index + 1)), constants.MAX_OPTION_LABEL_LEN);
      var id = textUtils.sanitizeText(item.id || ('item-' + index));
      return id + '|' + label;
    })
    .join('\n');
}

module.exports = {
  sanitizeGraphId: sanitizeGraphId,
  normalizeRun: normalizeRun,
  normalizeMenuActions: normalizeMenuActions,
  normalizeScreenActions: normalizeScreenActions,
  encodeActions: encodeActions,
  encodeMenuActions: encodeMenuActions,
  buildActionLookup: buildActionLookup,
  encodeItems: encodeItems
};
