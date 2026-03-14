'use strict';

var constants = require('../constants');

var SCREEN_TYPES = ['menu', 'card', 'scroll'];
var INPUT_MODES = ['menu', 'voice', 'menu_or_voice'];
var RUN_TYPES = ['navigate', 'agent_prompt', 'agent_command', 'effect'];
var ACTION_SLOTS = constants.ACTION_SLOT_ORDER.slice();
var ACTION_ICONS = Object.keys(constants.VALID_ACTION_ICONS);
var VIBE_TYPES = Object.keys(constants.VALID_VIBE_TYPES);

var LIMITS = {
  maxTitleLen: constants.MAX_TITLE_LEN,
  maxBodyLen: constants.MAX_BODY_LEN,
  maxMenuItems: constants.MAX_MENU_ITEMS,
  maxMenuActions: constants.MAX_MENU_ACTIONS,
  maxOptionLabelLen: constants.MAX_OPTION_LABEL_LEN,
  maxActionIdLen: constants.MAX_ACTION_ID_LEN,
  maxCardActions: constants.MAX_CARD_ACTIONS,
  maxAgentOptions: constants.MAX_AGENT_OPTIONS,
  maxScrollBodyLen: constants.MAX_SCROLL_BODY_LEN,
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
    { id: 'input.mode', type: 'enum', required: false, options: INPUT_MODES }
  ],
  menu: [
    { id: 'items', type: 'list', required: false, maxItems: constants.MAX_MENU_ITEMS }
  ],
  card: [
    { id: 'actions', type: 'list', required: false, maxItems: constants.MAX_CARD_ACTIONS }
  ],
  scroll: [
    { id: 'actions', type: 'list', required: false, maxItems: constants.MAX_MENU_ACTIONS }
  ]
};

var ITEM_FIELD_DEFS = [
  { id: 'id', type: 'text', required: true, maxLen: constants.MAX_ACTION_ID_LEN },
  { id: 'label', type: 'text', required: true, maxLen: constants.MAX_OPTION_LABEL_LEN },
  { id: 'labelTemplate', type: 'text', required: false },
  { id: 'value', type: 'text', required: false },
  { id: 'run.type', type: 'enum', required: false, options: RUN_TYPES },
  { id: 'run.screen', type: 'text', required: false },
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
  { id: 'value', type: 'text', required: false },
  { id: 'run.type', type: 'enum', required: false, options: RUN_TYPES },
  { id: 'run.screen', type: 'text', required: false },
  { id: 'run.prompt', type: 'text', required: false },
  { id: 'run.command', type: 'text', required: false },
  { id: 'run.vibe', type: 'enum', required: false, options: VIBE_TYPES },
  { id: 'run.light', type: 'boolean', required: false }
];

var MENU_ACTION_FIELD_DEFS = [
  { id: 'id', type: 'text', required: true, maxLen: constants.MAX_ACTION_ID_LEN },
  { id: 'label', type: 'text', required: true, maxLen: constants.MAX_OPTION_LABEL_LEN },
  { id: 'value', type: 'text', required: false },
  { id: 'run.type', type: 'enum', required: false, options: RUN_TYPES },
  { id: 'run.screen', type: 'text', required: false },
  { id: 'run.prompt', type: 'text', required: false },
  { id: 'run.command', type: 'text', required: false },
  { id: 'run.vibe', type: 'enum', required: false, options: VIBE_TYPES },
  { id: 'run.light', type: 'boolean', required: false }
];

module.exports = {
  schemaVersion: constants.SDUI_SCHEMA_VERSION,
  enums: {
    screenTypes: SCREEN_TYPES,
    inputModes: INPUT_MODES,
    runTypes: RUN_TYPES,
    actionSlots: ACTION_SLOTS,
    actionIcons: ACTION_ICONS,
    vibeTypes: VIBE_TYPES
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
    drawerItem: MENU_ACTION_FIELD_DEFS
  },
  uiSections: {
    screen: [
      { id: 'basic', title: 'Basic', defaultOpen: true, fields: ['id', 'type', 'title', 'body'] },
      { id: 'dynamic', title: 'Dynamic Content', defaultOpen: false, fields: ['titleTemplate', 'bodyTemplate', 'bindings', 'input.mode'] }
    ],
  menu: [
      { id: 'items', title: 'Menu Items', defaultOpen: true, fields: ['items'] }
    ],
    card: [
      { id: 'actions', title: 'Button Actions', defaultOpen: true, fields: ['actions'] }
    ],
    scroll: [
      { id: 'actions', title: 'Select Action Menu Items', defaultOpen: true, fields: ['actions'] }
    ]
  }
};
