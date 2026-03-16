'use strict';

var constants = require('../constants');
var motionCompiler = require('../motion-compiler');

var SCREEN_TYPES = ['menu', 'card', 'scroll', 'draw'];
var INPUT_MODES = ['menu', 'voice', 'menu_or_voice'];
var RUN_TYPES = ['navigate', 'set_var', 'store', 'agent_prompt', 'agent_command', 'effect'];
var HOOK_RUN_TYPES = ['navigate', 'set_var', 'store', 'effect'];
var ACTION_SLOTS = constants.ACTION_SLOT_ORDER.slice();
var ACTION_ICONS = Object.keys(constants.VALID_ACTION_ICONS);
var VIBE_TYPES = Object.keys(constants.VALID_VIBE_TYPES);
var CONDITION_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'];
var DRAW_PLAY_MODES = motionCompiler.DRAW_PLAY_MODES.slice();
var DRAW_BACKGROUNDS = motionCompiler.DRAW_BACKGROUNDS.slice();
var DRAW_KINDS = motionCompiler.DRAW_KINDS.slice();
var DRAW_COLORS = motionCompiler.DRAW_COLORS.slice();
var MOTION_PRESETS = motionCompiler.MOTION_PRESETS.slice();
var MOTION_SPEEDS = motionCompiler.MOTION_SPEEDS.slice();
var MOTION_INTENSITIES = motionCompiler.MOTION_INTENSITIES.slice();
var MOTION_PLACEMENTS = motionCompiler.MOTION_PLACEMENTS.slice();
var CANVAS_TEMPLATES = motionCompiler.CANVAS_TEMPLATES.slice();

var LIMITS = {
  maxTitleLen: constants.MAX_TITLE_LEN,
  maxBodyLen: constants.MAX_BODY_LEN,
  maxMenuItems: constants.MAX_MENU_ITEMS,
  maxMenuActions: constants.MAX_MENU_ACTIONS,
  maxScreenHooks: constants.MAX_SCREEN_HOOKS,
  maxOptionLabelLen: constants.MAX_OPTION_LABEL_LEN,
  maxActionIdLen: constants.MAX_ACTION_ID_LEN,
  maxCardActions: constants.MAX_CARD_ACTIONS,
  maxAgentOptions: constants.MAX_AGENT_OPTIONS,
  maxScrollBodyLen: constants.MAX_SCROLL_BODY_LEN,
  maxDrawSteps: constants.MAX_DRAW_STEPS,
  maxScreenIdLen: constants.MAX_SCREEN_ID_LEN,
  recommended: {
    title: 24,
    body: 140,
    label: 18
  }
};

var SCREEN_FIELD_DEFS = {
  common: [
    { id: 'id', type: 'text', required: true, maxLen: constants.MAX_SCREEN_ID_LEN },
    { id: 'type', type: 'enum', required: true, options: SCREEN_TYPES },
    { id: 'title', type: 'text', required: true, maxLen: constants.MAX_TITLE_LEN },
    { id: 'body', type: 'textarea', required: false, maxLen: constants.MAX_BODY_LEN },
    { id: 'titleTemplate', type: 'text', required: false },
    { id: 'bodyTemplate', type: 'text', required: false },
    { id: 'bindings', type: 'json', required: false },
    { id: 'input.mode', type: 'enum', required: false, options: INPUT_MODES },
    { id: 'onEnter', type: 'list', required: false, maxItems: constants.MAX_SCREEN_HOOKS },
    { id: 'onExit', type: 'list', required: false, maxItems: constants.MAX_SCREEN_HOOKS }
  ],
  menu: [
    { id: 'items', type: 'list', required: false, maxItems: constants.MAX_MENU_ITEMS }
  ],
  card: [
    { id: 'actions', type: 'list', required: false, maxItems: constants.MAX_CARD_ACTIONS }
  ],
  scroll: [
    { id: 'actions', type: 'list', required: false, maxItems: constants.MAX_MENU_ACTIONS }
  ],
  draw: [
    { id: 'canvas.template', type: 'enum', required: false, options: CANVAS_TEMPLATES },
    { id: 'motion.playMode', type: 'enum', required: false, options: DRAW_PLAY_MODES },
    { id: 'motion.background', type: 'enum', required: false, options: DRAW_BACKGROUNDS },
    { id: 'motion.timelineMs', type: 'text', required: false },
    { id: 'motion.tracks', type: 'list', required: false, maxItems: constants.MAX_DRAW_STEPS },
    { id: 'drawing.playMode', type: 'enum', required: false, options: DRAW_PLAY_MODES },
    { id: 'drawing.background', type: 'enum', required: false, options: DRAW_BACKGROUNDS },
    { id: 'drawing.timelineMs', type: 'text', required: false },
    { id: 'drawing.steps', type: 'list', required: false, maxItems: constants.MAX_DRAW_STEPS }
  ]
};

var ITEM_FIELD_DEFS = [
  { id: 'id', type: 'text', required: true, maxLen: constants.MAX_ACTION_ID_LEN },
  { id: 'label', type: 'text', required: true, maxLen: constants.MAX_OPTION_LABEL_LEN },
  { id: 'labelTemplate', type: 'text', required: false },
  { id: 'value', type: 'text', required: false },
  { id: 'run.type', type: 'enum', required: false, options: RUN_TYPES },
  { id: 'run.screen', type: 'text', required: false },
  { id: 'run.condition.var', type: 'text', required: false, maxLen: constants.MAX_ACTION_ID_LEN },
  { id: 'run.condition.op', type: 'enum', required: false, options: CONDITION_OPS },
  { id: 'run.condition.value', type: 'text', required: false },
  { id: 'run.key', type: 'text', required: false, maxLen: constants.MAX_ACTION_ID_LEN },
  { id: 'run.value', type: 'text', required: false },
  { id: 'run.prompt', type: 'text', required: false },
  { id: 'run.command', type: 'text', required: false },
  { id: 'run.vibe', type: 'enum', required: false, options: VIBE_TYPES },
  { id: 'run.light', type: 'boolean', required: false }
];

var ACTION_FIELD_DEFS = [
  { id: 'slot', type: 'enum', required: true, options: ACTION_SLOTS },
  { id: 'id', type: 'text', required: true, maxLen: constants.MAX_ACTION_ID_LEN },
  { id: 'icon', type: 'enum', required: true, options: ACTION_ICONS },
  { id: 'label', type: 'text', required: false, maxLen: constants.MAX_OPTION_LABEL_LEN },
  { id: 'labelTemplate', type: 'text', required: false },
  { id: 'value', type: 'text', required: false },
  { id: 'run.type', type: 'enum', required: false, options: RUN_TYPES },
  { id: 'run.screen', type: 'text', required: false },
  { id: 'run.condition.var', type: 'text', required: false, maxLen: constants.MAX_ACTION_ID_LEN },
  { id: 'run.condition.op', type: 'enum', required: false, options: CONDITION_OPS },
  { id: 'run.condition.value', type: 'text', required: false },
  { id: 'run.key', type: 'text', required: false, maxLen: constants.MAX_ACTION_ID_LEN },
  { id: 'run.value', type: 'text', required: false },
  { id: 'run.prompt', type: 'text', required: false },
  { id: 'run.command', type: 'text', required: false },
  { id: 'run.vibe', type: 'enum', required: false, options: VIBE_TYPES },
  { id: 'run.light', type: 'boolean', required: false }
];

var MENU_ACTION_FIELD_DEFS = [
  { id: 'id', type: 'text', required: true, maxLen: constants.MAX_ACTION_ID_LEN },
  { id: 'label', type: 'text', required: true, maxLen: constants.MAX_OPTION_LABEL_LEN },
  { id: 'labelTemplate', type: 'text', required: false },
  { id: 'value', type: 'text', required: false },
  { id: 'run.type', type: 'enum', required: false, options: RUN_TYPES },
  { id: 'run.screen', type: 'text', required: false },
  { id: 'run.condition.var', type: 'text', required: false, maxLen: constants.MAX_ACTION_ID_LEN },
  { id: 'run.condition.op', type: 'enum', required: false, options: CONDITION_OPS },
  { id: 'run.condition.value', type: 'text', required: false },
  { id: 'run.key', type: 'text', required: false, maxLen: constants.MAX_ACTION_ID_LEN },
  { id: 'run.value', type: 'text', required: false },
  { id: 'run.prompt', type: 'text', required: false },
  { id: 'run.command', type: 'text', required: false },
  { id: 'run.vibe', type: 'enum', required: false, options: VIBE_TYPES },
  { id: 'run.light', type: 'boolean', required: false }
];

var HOOK_RUN_FIELD_DEFS = [
  { id: 'run.type', type: 'enum', required: false, options: HOOK_RUN_TYPES },
  { id: 'run.screen', type: 'text', required: false },
  { id: 'run.condition.var', type: 'text', required: false, maxLen: constants.MAX_ACTION_ID_LEN },
  { id: 'run.condition.op', type: 'enum', required: false, options: CONDITION_OPS },
  { id: 'run.condition.value', type: 'text', required: false },
  { id: 'run.key', type: 'text', required: false, maxLen: constants.MAX_ACTION_ID_LEN },
  { id: 'run.value', type: 'text', required: false },
  { id: 'run.vibe', type: 'enum', required: false, options: VIBE_TYPES },
  { id: 'run.light', type: 'boolean', required: false }
];

var TIMER_RUN_FIELD_DEFS = [
  { id: 'run.type', type: 'enum', required: false, options: RUN_TYPES },
  { id: 'run.screen', type: 'text', required: false },
  { id: 'run.condition.var', type: 'text', required: false, maxLen: constants.MAX_ACTION_ID_LEN },
  { id: 'run.condition.op', type: 'enum', required: false, options: CONDITION_OPS },
  { id: 'run.condition.value', type: 'text', required: false },
  { id: 'run.key', type: 'text', required: false, maxLen: constants.MAX_ACTION_ID_LEN },
  { id: 'run.value', type: 'text', required: false },
  { id: 'run.prompt', type: 'text', required: false },
  { id: 'run.command', type: 'text', required: false },
  { id: 'run.vibe', type: 'enum', required: false, options: VIBE_TYPES },
  { id: 'run.light', type: 'boolean', required: false }
];

var MOTION_TRACK_FIELD_DEFS = [
  { id: 'id', type: 'text', required: true, maxLen: constants.MAX_ACTION_ID_LEN },
  { id: 'label', type: 'text', required: true, maxLen: constants.MAX_OPTION_LABEL_LEN },
  { id: 'target', type: 'text', required: false },
  { id: 'kind', type: 'enum', required: true, options: DRAW_KINDS },
  { id: 'preset', type: 'enum', required: true, options: MOTION_PRESETS },
  { id: 'placement', type: 'enum', required: true, options: MOTION_PLACEMENTS },
  { id: 'color', type: 'enum', required: true, options: DRAW_COLORS },
  { id: 'fill', type: 'boolean', required: false },
  { id: 'speed', type: 'enum', required: true, options: MOTION_SPEEDS },
  { id: 'intensity', type: 'enum', required: true, options: MOTION_INTENSITIES },
  { id: 'delayMs', type: 'text', required: false },
  { id: 'staggerMs', type: 'text', required: false }
];

module.exports = {
  schemaVersion: constants.SDUI_SCHEMA_VERSION_V1_1_0,
  enums: {
    screenTypes: SCREEN_TYPES,
    inputModes: INPUT_MODES,
    runTypes: RUN_TYPES,
    actionSlots: ACTION_SLOTS,
    actionIcons: ACTION_ICONS,
    vibeTypes: VIBE_TYPES,
    conditionOps: CONDITION_OPS,
    drawPlayModes: DRAW_PLAY_MODES,
    drawBackgrounds: DRAW_BACKGROUNDS,
    drawKinds: DRAW_KINDS,
    drawColors: DRAW_COLORS,
    canvasTemplates: CANVAS_TEMPLATES,
    motionPresets: MOTION_PRESETS,
    motionSpeeds: MOTION_SPEEDS,
    motionIntensities: MOTION_INTENSITIES,
    motionPlacements: MOTION_PLACEMENTS
  },
  limits: LIMITS,
  defaults: {
    screenType: 'menu',
    inputMode: 'menu',
    emptyCardBody: 'Done.',
    emptyScrollBody: 'No content.'
  },
  fieldDefs: {
    screen: SCREEN_FIELD_DEFS,
    item: ITEM_FIELD_DEFS,
    action: ACTION_FIELD_DEFS,
    menuAction: MENU_ACTION_FIELD_DEFS,
    drawerItem: MENU_ACTION_FIELD_DEFS,
    hookRun: HOOK_RUN_FIELD_DEFS,
    timerRun: TIMER_RUN_FIELD_DEFS,
    motionTrack: MOTION_TRACK_FIELD_DEFS
  },
  uiSections: {
    screen: [
      { id: 'basic', title: 'Basic', defaultOpen: true, fields: ['id', 'type', 'title', 'body', 'input.mode'] },
      { id: 'data', title: 'Data Sources', defaultOpen: false, fields: ['bindings'] },
      { id: 'lifecycle', title: 'Lifecycle', defaultOpen: false, fields: ['onEnter', 'onExit'] },
      { id: 'timer', title: 'Timer', defaultOpen: false, fields: ['timer'] }
    ],
    menu: [
      { id: 'items', title: 'Menu Items', defaultOpen: true, fields: ['items'] }
    ],
    card: [
      { id: 'actions', title: 'Button Actions', defaultOpen: true, fields: ['actions'] }
    ],
    scroll: [
      { id: 'actions', title: 'Select Action Menu Items', defaultOpen: true, fields: ['actions'] }
    ],
    draw: [
      {
        id: 'motion',
        title: 'Motion',
        defaultOpen: true,
        fields: ['canvas.template', 'motion.playMode', 'motion.background', 'motion.timelineMs', 'motion.tracks']
      },
      {
        id: 'drawing',
        title: 'Advanced Raw Drawing',
        defaultOpen: false,
        fields: ['drawing.playMode', 'drawing.background', 'drawing.timelineMs', 'drawing.steps']
      }
    ]
  }
};
