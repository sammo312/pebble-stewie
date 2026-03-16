'use strict';

var constants = require('./constants');
var textUtils = require('./text-utils');

var MAX_DRAW_STEPS = constants.MAX_DRAW_STEPS;
var MAX_ACTION_ID_LEN = constants.MAX_ACTION_ID_LEN;
var MAX_OPTION_LABEL_LEN = constants.MAX_OPTION_LABEL_LEN;

var PLAY_MODE_TOKENS = {
  loop: 'l',
  once: 'o',
  ping_pong: 'p'
};

var BACKGROUND_TOKENS = {
  grid: 'g',
  dark: 'd',
  light: 'l'
};

var KIND_TOKENS = {
  circle: 'c',
  rect: 'r',
  text: 't'
};

var COLOR_TOKENS = {
  ink: 'i',
  accent: 'a',
  accent2: 'b',
  danger: 'd'
};

function clampInt(value, fallback, min, max) {
  var next = parseInt(value, 10);
  if (isNaN(next)) {
    next = fallback;
  }
  if (typeof min === 'number' && next < min) {
    next = min;
  }
  if (typeof max === 'number' && next > max) {
    next = max;
  }
  return next;
}

function toPercent(value, fallback) {
  return clampInt(Math.round(Number(value) * 100), fallback, 0, 400);
}

function sanitizeId(rawValue, fallback) {
  var raw = textUtils.sanitizeText(rawValue).toLowerCase();
  if (!raw) {
    raw = fallback;
  }

  raw = raw.replace(/[^a-z0-9_-]/g, '_');
  if (!raw) {
    raw = fallback;
  }

  return raw.substring(0, MAX_ACTION_ID_LEN);
}

function getToken(map, rawValue, fallbackKey) {
  var key = String(rawValue || fallbackKey).toLowerCase();
  return map[key] || map[fallbackKey];
}

function encodeDrawingStep(step, index) {
  var safeStep = step && typeof step === 'object' ? step : {};
  var label = textUtils.limitText(safeStep.label || ('Step ' + (index + 1)), MAX_OPTION_LABEL_LEN);

  return [
    's',
    sanitizeId(safeStep.id, 'step_' + (index + 1)),
    getToken(KIND_TOKENS, safeStep.kind, 'circle'),
    getToken(COLOR_TOKENS, safeStep.color, 'accent'),
    safeStep.fill ? '1' : '0',
    clampInt(safeStep.x, 0, 0, 144),
    clampInt(safeStep.y, 0, 0, 168),
    clampInt(safeStep.toX, safeStep.x, 0, 144),
    clampInt(safeStep.toY, safeStep.y, 0, 168),
    clampInt(safeStep.width, 24, 4, 96),
    clampInt(safeStep.height, 24, 4, 96),
    clampInt(safeStep.delayMs, 0, 0, 20000),
    clampInt(safeStep.durationMs, 720, 120, 20000),
    toPercent(safeStep.fromScale, 75),
    toPercent(safeStep.toScale, 100),
    toPercent(safeStep.fromOpacity, 30),
    toPercent(safeStep.toOpacity, 100),
    label
  ].join('|');
}

function encodeDrawingPayload(drawing) {
  if (!drawing || typeof drawing !== 'object') {
    return '';
  }

  var safeDrawing = drawing;
  var lines = [
    [
      'cfg',
      getToken(PLAY_MODE_TOKENS, safeDrawing.playMode, 'loop'),
      getToken(BACKGROUND_TOKENS, safeDrawing.background, 'grid'),
      clampInt(safeDrawing.timelineMs, 1600, 240, 20000)
    ].join('|')
  ];

  var steps = Array.isArray(safeDrawing.steps) ? safeDrawing.steps.slice(0, MAX_DRAW_STEPS) : [];
  for (var i = 0; i < steps.length; i++) {
    lines.push(encodeDrawingStep(steps[i], i));
  }

  return lines.join('\n');
}

module.exports = {
  encodeDrawingPayload: encodeDrawingPayload
};
