'use strict';

var constants = require('./constants');
var textUtils = require('./text-utils');

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

function normalizeActionSlot(slot) {
  var value = textUtils.sanitizeText(slot).toLowerCase();
  for (var i = 0; i < constants.ACTION_SLOT_ORDER.length; i++) {
    if (constants.ACTION_SLOT_ORDER[i] === value) {
      return value;
    }
  }
  return '';
}

function normalizeActionIcon(icon) {
  var token = textUtils.sanitizeText(icon).toLowerCase();
  if (!constants.VALID_ACTION_ICONS[token]) {
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
  for (var i = 0; i < rawActions.length && actions.length < constants.MAX_CARD_ACTIONS; i++) {
    var action = rawActions[i];
    if (!action || typeof action !== 'object') {
      continue;
    }

    var slot = normalizeActionSlot(action.slot || action.button);
    if (!slot || seenSlots[slot]) {
      // Pebble allows one action per hardware slot.
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
      icon: normalizeActionIcon(action.icon),
      label: label || actionId,
      value: textUtils.sanitizeText(action.value || action.prompt || label || actionId),
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

  // Watch-side parser expects `slot|id|icon` per line.
  return actions
    .slice(0, constants.MAX_CARD_ACTIONS)
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
  normalizeScreenActions: normalizeScreenActions,
  encodeActions: encodeActions,
  buildActionLookup: buildActionLookup,
  encodeItems: encodeItems
};
