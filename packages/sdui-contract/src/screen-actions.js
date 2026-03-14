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
    var nav = {
      type: 'navigate',
      screen: targetScreen
    };
    if (vibe) { nav.vibe = vibe; }
    if (light) { nav.light = true; }
    return nav;
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
    actions.push({
      id: actionId,
      slot: slot,
      icon: normalizeActionIcon(action.icon, descriptor),
      label: label || actionId,
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

    actions.push({
      id: actionId,
      label: label,
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
