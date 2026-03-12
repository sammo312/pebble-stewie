'use strict';

var constants = require('./constants');
var textUtils = require('./text-utils');
var screenActions = require('./screen-actions');

function sanitizeOptionId(id, index) {
  var raw = textUtils.sanitizeText(id).toLowerCase();
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

  // Accept a few common backend shapes before falling back.
  var candidates = [
    rawTurn.body,
    rawTurn.text,
    rawTurn.message,
    rawTurn.response,
    rawTurn.output_text,
    rawTurn.reply
  ];

  for (var i = 0; i < candidates.length; i++) {
    var text = textUtils.sanitizeText(candidates[i]);
    if (text) {
      return text;
    }
  }

  if (typeof rawTurn.output === 'string') {
    return textUtils.sanitizeText(rawTurn.output);
  }

  return '';
}

function normalizeAgentTurn(rawTurn) {
  if (typeof rawTurn === 'string') {
    return {
      schemaVersion: constants.SDUI_SCHEMA_VERSION,
      screen: {
        type: 'card',
        title: 'Agent',
        body: textUtils.limitText(rawTurn, constants.MAX_BODY_LEN),
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
    schemaVersion: constants.SDUI_SCHEMA_VERSION,
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
  turn.screen.title = textUtils.limitText(screen.title || rawTurn.title || 'Agent', constants.MAX_TITLE_LEN);
  turn.screen.body = textUtils.limitText(
    screen.body || rawTurn.body || extractLooseAgentText(rawTurn) || '',
    constants.MAX_BODY_LEN
  );

  if (screenType === 'card') {
    turn.screen.actions = screenActions.normalizeScreenActions(screen.actions || rawTurn.actions || []);
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
  for (var i = 0; i < rawOptions.length && options.length < constants.MAX_AGENT_OPTIONS; i++) {
    var option = rawOptions[i];
    if (!option || typeof option !== 'object') {
      continue;
    }

    var optionId = sanitizeOptionId(option.id, i + 1);
    if (seenIds[optionId]) {
      optionId = optionId + '_' + (i + 1);
    }
    seenIds[optionId] = true;

    var label = textUtils.limitText(option.label || option.title || optionId, constants.MAX_OPTION_LABEL_LEN);
    if (!label) {
      continue;
    }

    options.push({
      id: optionId,
      label: label,
      value: textUtils.sanitizeText(option.value || option.prompt || label)
    });
  }

  turn.screen.options = options;

  var expectResponse = !!input.expectResponse;
  if (!input.hasOwnProperty('expectResponse')) {
    // Infer expectation from available interactions when backend omits the flag.
    expectResponse = options.length > 0 || turn.screen.actions.length > 0 || mode !== 'menu';
  }

  turn.input.mode = mode;
  turn.input.expectResponse = expectResponse;

  if (!turn.screen.body && turn.screen.type === 'card') {
    turn.screen.body = expectResponse ? 'Select or speak a response.' : 'Done.';
  }

  return turn;
}

module.exports = {
  normalizeAgentTurn: normalizeAgentTurn
};
