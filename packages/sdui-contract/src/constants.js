'use strict';

module.exports = {
  MSG_TYPE_RENDER: 1,
  MSG_TYPE_ACTION: 2,
  UI_TYPE_MENU: 1,
  UI_TYPE_CARD: 2,
  UI_TYPE_SCROLL: 3,
  ACTION_TYPE_READY: 1,
  ACTION_TYPE_SELECT: 2,
  ACTION_TYPE_BACK: 3,
  ACTION_TYPE_VOICE: 4,
  MAX_MENU_ITEMS: 8,
  MAX_TITLE_LEN: 30,
  MAX_BODY_LEN: 180,
  MAX_SCROLL_BODY_LEN: 1024,
  MAX_SCREEN_ID_LEN: 31,
  MAX_OPTION_LABEL_LEN: 20,
  MAX_AGENT_OPTIONS: 5,
  MAX_CARD_ACTIONS: 3,
  MAX_MENU_ACTIONS: 6,
  MAX_ACTION_ID_LEN: 22,
  ACTION_SLOT_ORDER: ['up', 'select', 'down'],
  VALID_ACTION_ICONS: {
    play: true,
    pause: true,
    check: true,
    x: true,
    plus: true,
    minus: true
  },
  VALID_VIBE_TYPES: {
    short: true,
    long: true,
    double: true
  },
  LATEST_SDUI_SCHEMA_VERSION: 'pebble.sdui.v1',
  SDUI_SCHEMA_VERSION: 'pebble.sdui.v1',
  VOICE_INPUT_ITEM_ID: '__voice__',
  VOICE_ERROR_ITEM_ID: '__voice_error__',
  VOICE_NOT_SUPPORTED_ITEM_ID: '__voice_not_supported__',
  OPENAI_API_URL: 'https://api.openai.com/v1/responses',
  OPENAI_DEFAULT_MODEL: 'gpt-4.1-mini',
  STORAGE_IMPORTED_SCHEMA_JSON: 'imported-schema-json',
  STORAGE_OPENAI_TOKEN: 'openai-token',
  STORAGE_OPENAI_MODEL: 'openai-model'
};
