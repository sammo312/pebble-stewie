'use strict';

var constants = require('./constants');
var textUtils = require('./text-utils');

var MOTION_VERSION = 1;
var MOTION_PRESETS = ['fade', 'slide_up', 'slide_left', 'pulse', 'hover', 'blink', 'orbit'];
var MOTION_SPEEDS = ['fast', 'normal', 'slow'];
var MOTION_INTENSITIES = ['low', 'medium', 'high'];
var MOTION_PLACEMENTS = ['top', 'middle', 'bottom'];
var CANVAS_TEMPLATES = ['freeform', 'header_list'];
var DRAW_PLAY_MODES = ['loop', 'once', 'ping_pong'];
var DRAW_BACKGROUNDS = ['grid', 'dark', 'light'];
var DRAW_KINDS = ['circle', 'rect', 'text'];
var DRAW_COLORS = ['ink', 'accent', 'accent2', 'danger'];
var MAX_CANVAS_ITEMS = 4;

var PLACEMENT_BASE_Y = {
  top: 26,
  middle: 82,
  bottom: 136
};

var SPEED_CONFIG = {
  fast: { durationMs: 420 },
  normal: { durationMs: 760 },
  slow: { durationMs: 1120 }
};

var INTENSITY_CONFIG = {
  low: { distance: 8, opacity: 0.6, minScale: 0.94, maxScale: 1.08 },
  medium: { distance: 14, opacity: 0.32, minScale: 0.86, maxScale: 1.16 },
  high: { distance: 22, opacity: 0.14, minScale: 0.76, maxScale: 1.24 }
};

var TRACK_SEED_LABELS = ['Orbit', 'Sweep', 'Hi'];
var TRACK_SEED_PRESETS = ['orbit', 'slide_left', 'hover'];
var TRACK_SEED_KINDS = ['circle', 'rect', 'text'];
var TRACK_SEED_COLORS = ['accent', 'accent2', 'ink'];
var CANVAS_ITEM_SEEDS = ['Play', 'Settings', 'Help'];

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

function normalizeEnum(rawValue, options, fallback) {
  var value = String(rawValue || fallback).toLowerCase();
  return options.indexOf(value) >= 0 ? value : fallback;
}

function normalizeBoolean(rawValue, fallback) {
  if (rawValue === true || rawValue === 'true') {
    return true;
  }
  if (rawValue === false || rawValue === 'false') {
    return false;
  }
  return !!fallback;
}

function sanitizeMotionId(rawValue, fallback) {
  var raw = textUtils.sanitizeText(rawValue || fallback).toLowerCase();
  raw = raw.replace(/[^a-z0-9_-]/g, '_');
  if (!raw) {
    raw = fallback;
  }
  return raw.substring(0, constants.MAX_ACTION_ID_LEN);
}

function ensureUniqueTrackId(existingTracks, rawValue, fallback) {
  var base = sanitizeMotionId(rawValue, fallback);
  var value = base;
  var index = 2;
  var taken = {};

  for (var i = 0; i < existingTracks.length; i++) {
    if (existingTracks[i] && existingTracks[i].id) {
      taken[String(existingTracks[i].id)] = true;
    }
  }

  while (taken[value]) {
    value = sanitizeMotionId(base + '_' + index, fallback);
    index++;
  }

  return value;
}

function defaultTrackLabel(index) {
  return TRACK_SEED_LABELS[index] || ('Track ' + (index + 1));
}

function defaultTrackKind(index) {
  return TRACK_SEED_KINDS[index] || DRAW_KINDS[index % DRAW_KINDS.length];
}

function defaultTrackPreset(index) {
  return TRACK_SEED_PRESETS[index] || MOTION_PRESETS[index % MOTION_PRESETS.length];
}

function defaultTrackColor(index) {
  return TRACK_SEED_COLORS[index] || DRAW_COLORS[(index % (DRAW_COLORS.length - 1)) + 1];
}

function defaultTrackPlacement(index) {
  return MOTION_PLACEMENTS[index % MOTION_PLACEMENTS.length];
}

function defaultTrackTarget(index) {
  return index === 0 ? 'header' : index === 1 ? 'items' : 'freeform';
}

function ensureUniqueCanvasItemId(existingItems, rawValue, fallback) {
  var base = sanitizeMotionId(rawValue, fallback);
  var value = base;
  var index = 2;
  var taken = {};

  for (var i = 0; i < existingItems.length; i++) {
    if (existingItems[i] && existingItems[i].id) {
      taken[String(existingItems[i].id)] = true;
    }
  }

  while (taken[value]) {
    value = sanitizeMotionId(base + '_' + index, fallback);
    index++;
  }

  return value;
}

function getBaseFrame(track, index) {
  var placement = normalizeEnum(track && track.placement, MOTION_PLACEMENTS, defaultTrackPlacement(index));
  var kind = normalizeEnum(track && track.kind, DRAW_KINDS, defaultTrackKind(index));
  var columnOffset = (index % 2) * 10;
  var y = PLACEMENT_BASE_Y[placement] || PLACEMENT_BASE_Y.middle;
  var x = kind === 'text' ? 18 : 24 + columnOffset;
  var width = kind === 'rect' ? 40 : kind === 'text' ? 44 : 28;
  var height = kind === 'rect' ? 14 : kind === 'text' ? 18 : 28;

  if (placement === 'middle' && kind === 'rect') {
    width = 52;
  }

  return {
    x: x,
    y: y,
    width: width,
    height: height
  };
}

function buildTrackStep(track, index, options) {
  var safeTrack = track && typeof track === 'object' ? track : {};
  var config = options || {};
  var preset = normalizeEnum(safeTrack.preset, MOTION_PRESETS, defaultTrackPreset(index));
  var speed = normalizeEnum(safeTrack.speed, MOTION_SPEEDS, 'normal');
  var intensity = normalizeEnum(safeTrack.intensity, MOTION_INTENSITIES, 'medium');
  var kind = normalizeEnum(safeTrack.kind, DRAW_KINDS, config.defaultKind || defaultTrackKind(index));
  var color = normalizeEnum(safeTrack.color, DRAW_COLORS, config.defaultColor || defaultTrackColor(index));
  var timing = SPEED_CONFIG[speed] || SPEED_CONFIG.normal;
  var strength = INTENSITY_CONFIG[intensity] || INTENSITY_CONFIG.medium;
  var base = config.baseFrame || getBaseFrame(safeTrack, index);
  var distance = strength.distance;
  var x = base.x;
  var y = base.y;
  var toX = base.x;
  var toY = base.y;
  var fromScale = 1;
  var toScale = 1;
  var fromOpacity = 1;
  var toOpacity = 1;

  if (preset === 'fade') {
    fromOpacity = strength.opacity;
    toOpacity = 1;
    fromScale = kind === 'text' ? 0.98 : 0.92;
  } else if (preset === 'slide_up') {
    y = base.y + distance;
    toY = base.y;
    fromOpacity = strength.opacity;
    toOpacity = 1;
    fromScale = 0.98;
  } else if (preset === 'slide_left') {
    x = base.x + distance;
    toX = base.x;
    fromOpacity = strength.opacity;
    toOpacity = 1;
    fromScale = 0.98;
  } else if (preset === 'pulse') {
    fromScale = strength.minScale;
    toScale = strength.maxScale;
    fromOpacity = 0.82;
    toOpacity = 1;
  } else if (preset === 'hover') {
    y = base.y + Math.round(distance / 2);
    toY = base.y - Math.round(distance / 2);
    fromOpacity = 0.9;
    toOpacity = 1;
  } else if (preset === 'blink') {
    fromOpacity = Math.max(0.08, strength.opacity * 0.45);
    toOpacity = 1;
  } else if (preset === 'orbit') {
    x = base.x - Math.round(distance * 0.6);
    y = base.y + Math.round(distance * 0.3);
    toX = base.x + Math.round(distance * 0.6);
    toY = base.y - Math.round(distance * 0.3);
    fromScale = 0.88;
    toScale = 1.12;
    fromOpacity = 0.75;
    toOpacity = 1;
  }

  return {
    id: sanitizeMotionId(config.id || safeTrack.id, 'track_' + (index + 1)),
    kind: kind,
    label: textUtils.limitText(config.label || safeTrack.label || defaultTrackLabel(index), constants.MAX_OPTION_LABEL_LEN),
    x: clampInt(x, base.x, 0, 144),
    y: clampInt(y, base.y, 0, 168),
    toX: clampInt(toX, base.x, 0, 144),
    toY: clampInt(toY, base.y, 0, 168),
    width: clampInt(base.width, base.width, 4, 96),
    height: clampInt(base.height, base.height, 4, 96),
    delayMs: clampInt((safeTrack.delayMs || 0) + (config.delayMsOffset || 0), index * 160, 0, 20000),
    durationMs: clampInt(safeTrack.durationMs, timing.durationMs, 120, 20000),
    fromScale: Math.max(0.1, Math.min(4, Number(fromScale))),
    toScale: Math.max(0.1, Math.min(4, Number(toScale))),
    fromOpacity: Math.max(0.05, Math.min(1, Number(fromOpacity))),
    toOpacity: Math.max(0.05, Math.min(1, Number(toOpacity))),
    fill: kind === 'text' ? true : normalizeBoolean(safeTrack.fill, config.defaultFill !== undefined ? config.defaultFill : kind === 'rect'),
    color: color
  };
}

function compileTrack(track, index) {
  return buildTrackStep(track, index);
}

function createDefaultMotionTrack(existingTracks, overrides) {
  var tracks = Array.isArray(existingTracks) ? existingTracks : [];
  var index = tracks.length;
  var defaults = {
    id: ensureUniqueTrackId(tracks, 'track_' + (index + 1), 'track_' + (index + 1)),
    label: defaultTrackLabel(index),
    target: defaultTrackTarget(index),
    kind: defaultTrackKind(index),
    preset: defaultTrackPreset(index),
    placement: defaultTrackPlacement(index),
    color: defaultTrackColor(index),
    fill: defaultTrackKind(index) === 'rect',
    speed: index === 0 ? 'normal' : 'slow',
    intensity: index === 2 ? 'low' : 'medium',
    delayMs: index * 160,
    staggerMs: 120
  };

  return Object.assign(defaults, overrides || {});
}

function createDefaultMotion(overrides) {
  var tracks = [];
  tracks.push(createDefaultMotionTrack(tracks, { label: 'Orbit', preset: 'orbit', kind: 'circle', placement: 'top', color: 'accent', fill: false, speed: 'normal', intensity: 'medium', delayMs: 0 }));
  tracks.push(createDefaultMotionTrack(tracks, { label: 'Sweep', preset: 'slide_left', kind: 'rect', placement: 'middle', color: 'accent2', fill: true, speed: 'slow', intensity: 'medium', delayMs: 180 }));
  tracks.push(createDefaultMotionTrack(tracks, { label: 'Hi', preset: 'hover', kind: 'text', placement: 'bottom', color: 'ink', fill: true, speed: 'slow', intensity: 'low', delayMs: 320 }));

  return Object.assign({
    version: MOTION_VERSION,
    playMode: 'ping_pong',
    background: 'grid',
    timelineMs: 1800,
    tracks: tracks
  }, overrides || {});
}

function createDefaultCanvas(overrides) {
  return Object.assign({
    template: 'header_list',
    header: 'Main Menu',
    items: [
      { id: 'play', label: CANVAS_ITEM_SEEDS[0] },
      { id: 'settings', label: CANVAS_ITEM_SEEDS[1] },
      { id: 'help', label: CANVAS_ITEM_SEEDS[2] }
    ]
  }, overrides || {});
}

function createDefaultCanvasMotion(canvas, overrides) {
  var safeCanvas = normalizeCanvas(canvas);
  if (safeCanvas.template !== 'header_list') {
    return createDefaultMotion(overrides);
  }

  return Object.assign({
    version: MOTION_VERSION,
    playMode: 'once',
    background: 'grid',
    timelineMs: 1600,
    tracks: [
      createDefaultMotionTrack([], {
        id: 'header',
        label: 'Header In',
        target: 'header',
        preset: 'slide_up',
        speed: 'normal',
        intensity: 'medium',
        delayMs: 0,
        staggerMs: 0,
        kind: 'text',
        placement: 'top',
        color: 'accent',
        fill: true
      }),
      createDefaultMotionTrack([{ id: 'header' }], {
        id: 'items',
        label: 'Items In',
        target: 'items',
        preset: 'slide_left',
        speed: 'normal',
        intensity: 'low',
        delayMs: 180,
        staggerMs: 120,
        kind: 'text',
        placement: 'middle',
        color: 'ink',
        fill: true
      })
    ]
  }, overrides || {});
}

function normalizeCanvas(rawCanvas) {
  var canvas = rawCanvas && typeof rawCanvas === 'object' ? rawCanvas : {};
  var template = normalizeEnum(canvas.template, CANVAS_TEMPLATES, 'freeform');

  if (template !== 'header_list') {
    return {
      template: 'freeform'
    };
  }

  var rawItems = Array.isArray(canvas.items) ? canvas.items : [];
  var items = [];

  for (var i = 0; i < rawItems.length && items.length < MAX_CANVAS_ITEMS; i++) {
    var item = rawItems[i];
    var label = '';
    var rawId = 'item_' + (i + 1);
    if (item && typeof item === 'object') {
      label = textUtils.limitText(item.label || item.text || '', constants.MAX_OPTION_LABEL_LEN);
      rawId = item.id || rawId;
    } else {
      label = textUtils.limitText(String(item || ''), constants.MAX_OPTION_LABEL_LEN);
    }
    if (!label) {
      continue;
    }
    items.push({
      id: ensureUniqueCanvasItemId(items, rawId, 'item_' + (i + 1)),
      label: label
    });
  }

  if (items.length === 0) {
    var defaults = createDefaultCanvas();
    items = defaults.items.slice(0, MAX_CANVAS_ITEMS);
  }

  return {
    template: 'header_list',
    header: textUtils.limitText(canvas.header || 'Main Menu', constants.MAX_TITLE_LEN),
    items: items
  };
}

function normalizeMotion(rawMotion, options) {
  var motion = rawMotion && typeof rawMotion === 'object' ? rawMotion : {};
  var maxTracks = options && options.maxTracks ? options.maxTracks : constants.MAX_DRAW_STEPS;
  var trackLabelLen = options && options.maxLabelLen ? options.maxLabelLen : constants.MAX_OPTION_LABEL_LEN;
  var rawTracks = Array.isArray(motion.tracks) ? motion.tracks : [];
  var tracks = [];

  for (var i = 0; i < rawTracks.length && tracks.length < maxTracks; i++) {
    var track = rawTracks[i];
    if (!track || typeof track !== 'object') {
      continue;
    }

    var normalizedTrack = createDefaultMotionTrack(tracks, {
      id: ensureUniqueTrackId(tracks, track.id, 'track_' + (i + 1)),
      label: textUtils.limitText(track.label || defaultTrackLabel(i), trackLabelLen),
      target: String(track.target || defaultTrackTarget(i)).toLowerCase(),
      kind: normalizeEnum(track.kind, DRAW_KINDS, defaultTrackKind(i)),
      preset: normalizeEnum(track.preset, MOTION_PRESETS, defaultTrackPreset(i)),
      placement: normalizeEnum(track.placement, MOTION_PLACEMENTS, defaultTrackPlacement(i)),
      color: normalizeEnum(track.color, DRAW_COLORS, defaultTrackColor(i)),
      fill: normalizeBoolean(track.fill, defaultTrackKind(i) === 'rect'),
      speed: normalizeEnum(track.speed, MOTION_SPEEDS, i === 0 ? 'normal' : 'slow'),
      intensity: normalizeEnum(track.intensity, MOTION_INTENSITIES, i === 2 ? 'low' : 'medium'),
      delayMs: clampInt(track.delayMs, i * 160, 0, 20000),
      staggerMs: clampInt(track.staggerMs, 120, 0, 2000)
    });

    tracks.push(normalizedTrack);
  }

  if (tracks.length === 0) {
    tracks = createDefaultMotion().tracks;
  }

  return {
    version: MOTION_VERSION,
    playMode: normalizeEnum(motion.playMode, DRAW_PLAY_MODES, 'ping_pong'),
    background: normalizeEnum(motion.background, DRAW_BACKGROUNDS, 'grid'),
    timelineMs: clampInt(motion.timelineMs, 1800, 240, 20000),
    tracks: tracks.slice(0, maxTracks)
  };
}

function getCanvasTargetBase(canvas, target) {
  if (target.type === 'header') {
    return {
      x: 12,
      y: 26,
      width: 120,
      height: 18,
      kind: 'text',
      color: 'accent',
      fill: true
    };
  }

  return {
    x: 16,
    y: 66 + (target.index * 22),
    width: 112,
    height: 16,
    kind: 'text',
    color: 'ink',
    fill: true
  };
}

function resolveCanvasTargets(track, canvas) {
  if (!canvas || canvas.template !== 'header_list') {
    return [];
  }

  var target = String(track && track.target || 'items').toLowerCase();
  if (target === 'header') {
    return [{
      id: 'header',
      type: 'header',
      index: 0,
      label: canvas.header
    }];
  }

  if (target === 'items') {
    return canvas.items.map(function(item, index) {
      return {
        id: item.id,
        type: 'item',
        index: index,
        label: item.label
      };
    });
  }

  for (var i = 0; i < canvas.items.length; i++) {
    if (canvas.items[i].id === target) {
      return [{
        id: canvas.items[i].id,
        type: 'item',
        index: i,
        label: canvas.items[i].label
      }];
    }
  }

  return [];
}

function compileCanvasMotion(normalizedMotion, canvas, options) {
  var maxSteps = options && options.maxSteps ? options.maxSteps : constants.MAX_DRAW_STEPS;
  var steps = [];
  var maxEndMs = 0;

  for (var i = 0; i < normalizedMotion.tracks.length && steps.length < maxSteps; i++) {
    var track = normalizedMotion.tracks[i];
    var targets = resolveCanvasTargets(track, canvas);
    if (targets.length === 0) {
      continue;
    }

    for (var j = 0; j < targets.length && steps.length < maxSteps; j++) {
      var target = targets[j];
      var base = getCanvasTargetBase(canvas, target);
      var step = buildTrackStep(track, i, {
        id: sanitizeMotionId(track.id + '_' + target.id, 'track_' + (i + 1) + '_' + target.id),
        label: target.label,
        baseFrame: base,
        defaultKind: base.kind,
        defaultColor: base.color,
        defaultFill: base.fill,
        delayMsOffset: j * clampInt(track.staggerMs, 120, 0, 2000)
      });
      steps.push(step);
      maxEndMs = Math.max(maxEndMs, step.delayMs + step.durationMs);
    }
  }

  return {
    mode: 'compiled',
    warnings: [],
    drawing: {
      playMode: normalizedMotion.playMode,
      background: normalizedMotion.background,
      timelineMs: Math.max(normalizedMotion.timelineMs || 0, maxEndMs || 0, 240),
      steps: steps
    }
  };
}

function compileMotionToDrawing(motion, options) {
  var normalizedMotion = normalizeMotion(motion, options);
  var canvas = normalizeCanvas(options && options.canvas);

  if (canvas.template === 'header_list') {
    return compileCanvasMotion(normalizedMotion, canvas, options);
  }

  var rawTracks = Array.isArray(normalizedMotion.tracks) ? normalizedMotion.tracks : [];
  var steps = [];
  var maxEndMs = 0;
  for (var i = 0; i < rawTracks.length && steps.length < constants.MAX_DRAW_STEPS; i++) {
    var step = compileTrack(rawTracks[i], i);
    steps.push(step);
    maxEndMs = Math.max(maxEndMs, step.delayMs + step.durationMs);
  }

  return {
    mode: 'compiled',
    warnings: [],
    drawing: {
      playMode: normalizedMotion.playMode,
      background: normalizedMotion.background,
      timelineMs: Math.max(normalizedMotion.timelineMs || 0, maxEndMs || 0, 240),
      steps: steps
    }
  };
}

module.exports = {
  MOTION_VERSION: MOTION_VERSION,
  MOTION_PRESETS: MOTION_PRESETS,
  MOTION_SPEEDS: MOTION_SPEEDS,
  MOTION_INTENSITIES: MOTION_INTENSITIES,
  MOTION_PLACEMENTS: MOTION_PLACEMENTS,
  CANVAS_TEMPLATES: CANVAS_TEMPLATES,
  DRAW_PLAY_MODES: DRAW_PLAY_MODES,
  DRAW_BACKGROUNDS: DRAW_BACKGROUNDS,
  DRAW_KINDS: DRAW_KINDS,
  DRAW_COLORS: DRAW_COLORS,
  createDefaultCanvas: createDefaultCanvas,
  createDefaultCanvasMotion: createDefaultCanvasMotion,
  createDefaultMotionTrack: createDefaultMotionTrack,
  createDefaultMotion: createDefaultMotion,
  normalizeCanvas: normalizeCanvas,
  normalizeMotion: normalizeMotion,
  compileMotionToDrawing: compileMotionToDrawing
};
