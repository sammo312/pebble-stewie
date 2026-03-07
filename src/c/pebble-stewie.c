#include <pebble.h>
#include <string.h>

#define MAX_TITLE_LEN 32
#define MAX_BODY_LEN 192
#define MAX_SCREEN_ID_LEN 32
#define MAX_MENU_ITEMS 8
#define MAX_ITEM_ID_LEN 24
#define MAX_ITEM_LABEL_LEN 32
#define MAX_CARD_ACTIONS NUM_ACTION_BAR_ITEMS
#define VOICE_INPUT_ITEM_ID "__voice__"
#define VOICE_NOT_SUPPORTED_ITEM_ID "__voice_not_supported__"
#define VOICE_ERROR_ITEM_ID "__voice_error__"
#define DICTATION_BUFFER_SIZE 128

enum MessageType {
  MSG_TYPE_RENDER = 1,
  MSG_TYPE_ACTION = 2,
};

enum UiType {
  UI_TYPE_MENU = 1,
  UI_TYPE_CARD = 2,
};

enum ActionType {
  ACTION_TYPE_READY = 1,
  ACTION_TYPE_SELECT = 2,
  ACTION_TYPE_BACK = 3,
  ACTION_TYPE_VOICE = 4,
};

typedef struct {
  char id[MAX_ITEM_ID_LEN];
  char label[MAX_ITEM_LABEL_LEN];
} MenuItem;

typedef struct {
  bool active;
  ButtonId button_id;
  uint8_t icon_type;
  char id[MAX_ITEM_ID_LEN];
} CardAction;

enum CardActionIconType {
  CARD_ACTION_ICON_PLAY = 1,
  CARD_ACTION_ICON_PAUSE = 2,
  CARD_ACTION_ICON_CHECK = 3,
  CARD_ACTION_ICON_X = 4,
  CARD_ACTION_ICON_PLUS = 5,
  CARD_ACTION_ICON_MINUS = 6,
};

static Window *s_window;
static MenuLayer *s_menu_layer;
static TextLayer *s_card_title_layer;
static TextLayer *s_card_body_layer;
static ActionBarLayer *s_action_bar_layer;
static DictationSession *s_dictation_session;
static GBitmap *s_icon_play;
static GBitmap *s_icon_pause;
static GBitmap *s_icon_check;
static GBitmap *s_icon_x;
static GBitmap *s_icon_plus;
static GBitmap *s_icon_minus;

static MenuItem s_menu_items[MAX_MENU_ITEMS];
static uint16_t s_menu_item_count;
static CardAction s_card_actions[MAX_CARD_ACTIONS];
static uint16_t s_card_action_count;

static char s_menu_title[MAX_TITLE_LEN] = "Menu";
static char s_card_title[MAX_TITLE_LEN] = "Loading";
static char s_card_body[MAX_BODY_LEN] = "Waiting for phone...";
static char s_current_screen_id[MAX_SCREEN_ID_LEN] = "";
static uint8_t s_current_ui_type = UI_TYPE_CARD;
static uint16_t s_selected_menu_row = 0;

static void prv_send_action(uint8_t action_type, int32_t item_index, const char *item_id,
                            const char *action_text);

static void prv_copy_with_limit(char *dest, size_t dest_size, const char *src, size_t src_len) {
  if (dest_size == 0) {
    return;
  }

  if (!src || src_len == 0) {
    dest[0] = '\0';
    return;
  }

  size_t copy_len = src_len;
  if (copy_len > dest_size - 1) {
    copy_len = dest_size - 1;
  }

  memcpy(dest, src, copy_len);
  dest[copy_len] = '\0';
}

static int16_t prv_button_slot_index(ButtonId button_id) {
  switch (button_id) {
    case BUTTON_ID_UP:
      return 0;
    case BUTTON_ID_SELECT:
      return 1;
    case BUTTON_ID_DOWN:
      return 2;
    default:
      return -1;
  }
}

static const GBitmap *prv_get_icon_bitmap(uint8_t icon_type) {
  switch (icon_type) {
    case CARD_ACTION_ICON_PLAY:
      return s_icon_play;
    case CARD_ACTION_ICON_PAUSE:
      return s_icon_pause;
    case CARD_ACTION_ICON_X:
      return s_icon_x;
    case CARD_ACTION_ICON_PLUS:
      return s_icon_plus;
    case CARD_ACTION_ICON_MINUS:
      return s_icon_minus;
    case CARD_ACTION_ICON_CHECK:
    default:
      return s_icon_check;
  }
}

static uint8_t prv_parse_icon_type(const char *icon_token, size_t icon_token_len) {
  if (!icon_token || icon_token_len == 0) {
    return CARD_ACTION_ICON_CHECK;
  }

  if (icon_token_len == 4 && strncmp(icon_token, "play", 4) == 0) {
    return CARD_ACTION_ICON_PLAY;
  }
  if (icon_token_len == 5 && strncmp(icon_token, "pause", 5) == 0) {
    return CARD_ACTION_ICON_PAUSE;
  }
  if (icon_token_len == 1 && strncmp(icon_token, "x", 1) == 0) {
    return CARD_ACTION_ICON_X;
  }
  if (icon_token_len == 4 && strncmp(icon_token, "plus", 4) == 0) {
    return CARD_ACTION_ICON_PLUS;
  }
  if (icon_token_len == 5 && strncmp(icon_token, "minus", 5) == 0) {
    return CARD_ACTION_ICON_MINUS;
  }

  return CARD_ACTION_ICON_CHECK;
}

static bool prv_parse_action_slot(const char *slot_token, size_t slot_token_len, ButtonId *button_id_out) {
  if (!slot_token || !button_id_out) {
    return false;
  }

  if (slot_token_len == 2 && strncmp(slot_token, "up", 2) == 0) {
    *button_id_out = BUTTON_ID_UP;
    return true;
  }
  if (slot_token_len == 6 && strncmp(slot_token, "select", 6) == 0) {
    *button_id_out = BUTTON_ID_SELECT;
    return true;
  }
  if (slot_token_len == 4 && strncmp(slot_token, "down", 4) == 0) {
    *button_id_out = BUTTON_ID_DOWN;
    return true;
  }

  return false;
}

static void prv_reset_card_actions(void) {
  memset(s_card_actions, 0, sizeof(s_card_actions));
  s_card_actions[0].button_id = BUTTON_ID_UP;
  s_card_actions[1].button_id = BUTTON_ID_SELECT;
  s_card_actions[2].button_id = BUTTON_ID_DOWN;
  s_card_action_count = 0;
}

static CardAction *prv_get_card_action(ButtonId button_id) {
  int16_t slot_index = prv_button_slot_index(button_id);
  if (slot_index < 0 || slot_index >= MAX_CARD_ACTIONS) {
    return NULL;
  }

  CardAction *action = &s_card_actions[slot_index];
  if (!action->active || action->id[0] == '\0') {
    return NULL;
  }

  return action;
}

static void prv_parse_card_actions(const char *encoded_actions) {
  prv_reset_card_actions();

  if (!encoded_actions || encoded_actions[0] == '\0') {
    return;
  }

  const char *cursor = encoded_actions;
  while (*cursor != '\0' && s_card_action_count < MAX_CARD_ACTIONS) {
    const char *line_end = strchr(cursor, '\n');
    if (!line_end) {
      line_end = cursor + strlen(cursor);
    }

    size_t line_len = (size_t)(line_end - cursor);
    if (line_len > 0) {
      const char *first_sep = memchr(cursor, '|', line_len);
      const char *second_sep = first_sep ? memchr(first_sep + 1, '|', (size_t)(line_end - first_sep - 1)) : NULL;

      if (first_sep && second_sep && second_sep > first_sep + 1) {
        size_t slot_len = (size_t)(first_sep - cursor);
        size_t id_len = (size_t)(second_sep - first_sep - 1);
        size_t icon_len = (size_t)(line_end - second_sep - 1);

        ButtonId button_id = BUTTON_ID_BACK;
        if (id_len > 0 && prv_parse_action_slot(cursor, slot_len, &button_id)) {
          CardAction *action = prv_get_card_action(button_id);
          if (!action) {
            int16_t slot_index = prv_button_slot_index(button_id);
            if (slot_index >= 0 && slot_index < MAX_CARD_ACTIONS) {
              action = &s_card_actions[slot_index];
              action->active = true;
              action->button_id = button_id;
              action->icon_type = prv_parse_icon_type(second_sep + 1, icon_len);
              prv_copy_with_limit(action->id, sizeof(action->id), first_sep + 1, id_len);
              if (action->id[0] != '\0') {
                s_card_action_count++;
              } else {
                action->active = false;
              }
            }
          }
        }
      }
    }

    if (*line_end == '\0') {
      break;
    }

    cursor = line_end + 1;
  }
}

static void prv_apply_card_actions(void) {
  if (!s_action_bar_layer) {
    return;
  }

  CardAction *up_action = prv_get_card_action(BUTTON_ID_UP);
  CardAction *select_action = prv_get_card_action(BUTTON_ID_SELECT);
  CardAction *down_action = prv_get_card_action(BUTTON_ID_DOWN);

  if (up_action) {
    action_bar_layer_set_icon(s_action_bar_layer, BUTTON_ID_UP, prv_get_icon_bitmap(up_action->icon_type));
  } else {
    action_bar_layer_clear_icon(s_action_bar_layer, BUTTON_ID_UP);
  }

  if (select_action) {
    action_bar_layer_set_icon(s_action_bar_layer, BUTTON_ID_SELECT, prv_get_icon_bitmap(select_action->icon_type));
  } else {
    action_bar_layer_clear_icon(s_action_bar_layer, BUTTON_ID_SELECT);
  }

  if (down_action) {
    action_bar_layer_set_icon(s_action_bar_layer, BUTTON_ID_DOWN, prv_get_icon_bitmap(down_action->icon_type));
  } else {
    action_bar_layer_clear_icon(s_action_bar_layer, BUTTON_ID_DOWN);
  }
}

#if defined(PBL_MICROPHONE)
static void prv_dictation_result_handler(DictationSession *session, DictationSessionStatus status,
                                         char *transcription, void *context) {
  if (status == DictationSessionStatusSuccess && transcription && transcription[0] != '\0') {
    char clipped[96];
    prv_copy_with_limit(clipped, sizeof(clipped), transcription, strlen(transcription));
    prv_send_action(ACTION_TYPE_VOICE, -1, VOICE_INPUT_ITEM_ID, clipped);
    return;
  }

  prv_send_action(ACTION_TYPE_VOICE, -1, VOICE_ERROR_ITEM_ID, NULL);
}
#endif

static void prv_start_dictation(void) {
#if defined(PBL_MICROPHONE)
  if (!s_dictation_session) {
    s_dictation_session =
        dictation_session_create(DICTATION_BUFFER_SIZE, prv_dictation_result_handler, NULL);
  }
  if (!s_dictation_session) {
    APP_LOG(APP_LOG_LEVEL_ERROR, "Failed to create dictation session");
    prv_send_action(ACTION_TYPE_VOICE, -1, VOICE_ERROR_ITEM_ID, NULL);
    return;
  }
  dictation_session_start(s_dictation_session);
#else
  prv_send_action(ACTION_TYPE_VOICE, -1, VOICE_NOT_SUPPORTED_ITEM_ID, NULL);
#endif
}

static void prv_send_action(uint8_t action_type, int32_t item_index, const char *item_id,
                            const char *action_text) {
  DictionaryIterator *iter;
  AppMessageResult result = app_message_outbox_begin(&iter);
  if (result != APP_MSG_OK) {
    APP_LOG(APP_LOG_LEVEL_ERROR, "Outbox begin failed: %d", result);
    return;
  }

  dict_write_uint8(iter, MESSAGE_KEY_msgType, MSG_TYPE_ACTION);
  dict_write_uint8(iter, MESSAGE_KEY_actionType, action_type);

  if (s_current_screen_id[0] != '\0') {
    dict_write_cstring(iter, MESSAGE_KEY_actionScreenId, s_current_screen_id);
  }

  if (item_id && item_id[0] != '\0') {
    dict_write_cstring(iter, MESSAGE_KEY_actionItemId, item_id);
  }

  if (item_index >= 0) {
    dict_write_int32(iter, MESSAGE_KEY_actionIndex, item_index);
  }

  if (action_text && action_text[0] != '\0') {
    dict_write_cstring(iter, MESSAGE_KEY_actionText, action_text);
  }

  result = app_message_outbox_send();
  if (result != APP_MSG_OK) {
    APP_LOG(APP_LOG_LEVEL_ERROR, "Outbox send failed: %d", result);
  }
}

static void prv_show_menu(void) {
  if (!s_menu_layer || !s_card_title_layer || !s_card_body_layer) {
    return;
  }

  s_current_ui_type = UI_TYPE_MENU;
  if (s_menu_item_count == 0) {
    s_selected_menu_row = 0;
  } else if (s_selected_menu_row >= s_menu_item_count) {
    s_selected_menu_row = s_menu_item_count - 1;
  }

  layer_set_hidden(menu_layer_get_layer(s_menu_layer), false);
  layer_set_hidden(text_layer_get_layer(s_card_title_layer), true);
  layer_set_hidden(text_layer_get_layer(s_card_body_layer), true);
  if (s_action_bar_layer) {
    layer_set_hidden(action_bar_layer_get_layer(s_action_bar_layer), true);
  }
  menu_layer_reload_data(s_menu_layer);

  if (s_menu_item_count > 0) {
    MenuIndex index = (MenuIndex){.section = 0, .row = s_selected_menu_row};
    menu_layer_set_selected_index(s_menu_layer, index, MenuRowAlignCenter, false);
  }
}

static void prv_show_card(void) {
  if (!s_menu_layer || !s_card_title_layer || !s_card_body_layer) {
    return;
  }

  s_current_ui_type = UI_TYPE_CARD;
  text_layer_set_text(s_card_title_layer, s_card_title);
  text_layer_set_text(s_card_body_layer, s_card_body);

  layer_set_hidden(menu_layer_get_layer(s_menu_layer), true);
  layer_set_hidden(text_layer_get_layer(s_card_title_layer), false);
  layer_set_hidden(text_layer_get_layer(s_card_body_layer), false);
  if (s_action_bar_layer) {
    prv_apply_card_actions();
    layer_set_hidden(action_bar_layer_get_layer(s_action_bar_layer), s_card_action_count == 0);
  }
}

static void prv_parse_menu_items(const char *encoded_items) {
  memset(s_menu_items, 0, sizeof(s_menu_items));
  s_menu_item_count = 0;

  if (!encoded_items || encoded_items[0] == '\0') {
    return;
  }

  const char *cursor = encoded_items;

  while (*cursor != '\0' && s_menu_item_count < MAX_MENU_ITEMS) {
    const char *line_end = strchr(cursor, '\n');
    if (!line_end) {
      line_end = cursor + strlen(cursor);
    }

    size_t line_len = (size_t)(line_end - cursor);
    if (line_len > 0) {
      const char *separator = memchr(cursor, '|', line_len);
      MenuItem *item = &s_menu_items[s_menu_item_count];

      if (separator) {
        size_t id_len = (size_t)(separator - cursor);
        size_t label_len = (size_t)(line_end - separator - 1);
        prv_copy_with_limit(item->id, sizeof(item->id), cursor, id_len);
        prv_copy_with_limit(item->label, sizeof(item->label), separator + 1, label_len);
      } else {
        prv_copy_with_limit(item->id, sizeof(item->id), cursor, line_len);
        prv_copy_with_limit(item->label, sizeof(item->label), cursor, line_len);
      }

      if (item->label[0] != '\0') {
        if (item->id[0] == '\0') {
          prv_copy_with_limit(item->id, sizeof(item->id), item->label, strlen(item->label));
        }
        s_menu_item_count++;
      }
    }

    if (*line_end == '\0') {
      break;
    }
    cursor = line_end + 1;
  }
}

static uint16_t prv_menu_get_num_sections_callback(MenuLayer *menu_layer, void *context) {
  return 1;
}

static uint16_t prv_menu_get_num_rows_callback(MenuLayer *menu_layer, uint16_t section_index, void *context) {
  return s_menu_item_count;
}

static int16_t prv_menu_get_header_height_callback(MenuLayer *menu_layer, uint16_t section_index, void *context) {
  return MENU_CELL_BASIC_HEADER_HEIGHT;
}

static void prv_menu_draw_header_callback(GContext *ctx, const Layer *cell_layer, uint16_t section_index,
                                          void *context) {
  menu_cell_basic_header_draw(ctx, cell_layer, s_menu_title);
}

static void prv_menu_draw_row_callback(GContext *ctx, const Layer *cell_layer, MenuIndex *cell_index, void *context) {
  if (cell_index->row >= s_menu_item_count) {
    return;
  }

  menu_cell_basic_draw(ctx, cell_layer, s_menu_items[cell_index->row].label, NULL, NULL);
}

static void prv_send_selected_menu_action(void) {
  if (s_current_ui_type != UI_TYPE_MENU || s_menu_item_count == 0) {
    return;
  }

  if (s_selected_menu_row >= s_menu_item_count) {
    return;
  }

  MenuItem *selected = &s_menu_items[s_selected_menu_row];
  if (strcmp(selected->id, VOICE_INPUT_ITEM_ID) == 0) {
    prv_start_dictation();
    return;
  }

  prv_send_action(ACTION_TYPE_SELECT, s_selected_menu_row, selected->id, NULL);
}

static bool prv_send_card_action_for_button(ButtonId button_id) {
  if (s_current_ui_type != UI_TYPE_CARD) {
    return false;
  }

  CardAction *action = prv_get_card_action(button_id);
  if (!action) {
    return false;
  }

  prv_send_action(ACTION_TYPE_SELECT, -1, action->id, NULL);
  return true;
}

static void prv_select_click_handler(ClickRecognizerRef recognizer, void *context) {
  if (prv_send_card_action_for_button(BUTTON_ID_SELECT)) {
    return;
  }

  prv_send_selected_menu_action();
}

static void prv_up_click_handler(ClickRecognizerRef recognizer, void *context) {
  if (prv_send_card_action_for_button(BUTTON_ID_UP)) {
    return;
  }

  if (s_current_ui_type != UI_TYPE_MENU || s_menu_item_count == 0 || s_selected_menu_row == 0) {
    return;
  }

  s_selected_menu_row--;
  MenuIndex index = (MenuIndex){.section = 0, .row = s_selected_menu_row};
  menu_layer_set_selected_index(s_menu_layer, index, MenuRowAlignCenter, true);
}

static void prv_down_click_handler(ClickRecognizerRef recognizer, void *context) {
  if (prv_send_card_action_for_button(BUTTON_ID_DOWN)) {
    return;
  }

  if (s_current_ui_type != UI_TYPE_MENU || s_menu_item_count == 0 || s_selected_menu_row >= s_menu_item_count - 1) {
    return;
  }

  s_selected_menu_row++;
  MenuIndex index = (MenuIndex){.section = 0, .row = s_selected_menu_row};
  menu_layer_set_selected_index(s_menu_layer, index, MenuRowAlignCenter, true);
}

static void prv_back_click_handler(ClickRecognizerRef recognizer, void *context) {
  prv_send_action(ACTION_TYPE_BACK, -1, NULL, NULL);
}

static void prv_window_click_config_provider(void *context) {
  window_single_click_subscribe(BUTTON_ID_BACK, prv_back_click_handler);
  if (!s_action_bar_layer) {
    window_single_click_subscribe(BUTTON_ID_UP, prv_up_click_handler);
    window_single_click_subscribe(BUTTON_ID_SELECT, prv_select_click_handler);
    window_single_click_subscribe(BUTTON_ID_DOWN, prv_down_click_handler);
  }
}

static void prv_action_bar_click_config_provider(void *context) {
  window_single_click_subscribe(BUTTON_ID_UP, prv_up_click_handler);
  window_single_click_subscribe(BUTTON_ID_SELECT, prv_select_click_handler);
  window_single_click_subscribe(BUTTON_ID_DOWN, prv_down_click_handler);
}

static void prv_inbox_received_handler(DictionaryIterator *iter, void *context) {
  Tuple *msg_type_tuple = dict_find(iter, MESSAGE_KEY_msgType);
  if (msg_type_tuple && msg_type_tuple->value->uint8 != MSG_TYPE_RENDER) {
    return;
  }

  Tuple *ui_type_tuple = dict_find(iter, MESSAGE_KEY_uiType);
  if (!ui_type_tuple) {
    APP_LOG(APP_LOG_LEVEL_WARNING, "Ignoring payload without uiType");
    return;
  }

  Tuple *screen_id_tuple = dict_find(iter, MESSAGE_KEY_screenId);
  if (screen_id_tuple && screen_id_tuple->type == TUPLE_CSTRING) {
    prv_copy_with_limit(s_current_screen_id, sizeof(s_current_screen_id), screen_id_tuple->value->cstring,
                        strlen(screen_id_tuple->value->cstring));
  }

  const uint8_t ui_type = ui_type_tuple->value->uint8;

  if (ui_type == UI_TYPE_MENU) {
    Tuple *title_tuple = dict_find(iter, MESSAGE_KEY_title);
    Tuple *items_tuple = dict_find(iter, MESSAGE_KEY_items);

    if (title_tuple && title_tuple->type == TUPLE_CSTRING) {
      prv_copy_with_limit(s_menu_title, sizeof(s_menu_title), title_tuple->value->cstring,
                          strlen(title_tuple->value->cstring));
    } else {
      prv_copy_with_limit(s_menu_title, sizeof(s_menu_title), "Menu", 4);
    }

    if (items_tuple && items_tuple->type == TUPLE_CSTRING) {
      prv_parse_menu_items(items_tuple->value->cstring);
    } else {
      s_menu_item_count = 0;
    }

    prv_reset_card_actions();
    s_selected_menu_row = 0;
    prv_show_menu();
    return;
  }

  if (ui_type == UI_TYPE_CARD) {
    Tuple *title_tuple = dict_find(iter, MESSAGE_KEY_title);
    Tuple *body_tuple = dict_find(iter, MESSAGE_KEY_body);
    Tuple *actions_tuple = dict_find(iter, MESSAGE_KEY_actions);

    if (title_tuple && title_tuple->type == TUPLE_CSTRING) {
      prv_copy_with_limit(s_card_title, sizeof(s_card_title), title_tuple->value->cstring,
                          strlen(title_tuple->value->cstring));
    } else {
      prv_copy_with_limit(s_card_title, sizeof(s_card_title), "Card", 4);
    }

    if (body_tuple && body_tuple->type == TUPLE_CSTRING) {
      prv_copy_with_limit(s_card_body, sizeof(s_card_body), body_tuple->value->cstring,
                          strlen(body_tuple->value->cstring));
    } else {
      s_card_body[0] = '\0';
    }

    if (actions_tuple && actions_tuple->type == TUPLE_CSTRING) {
      prv_parse_card_actions(actions_tuple->value->cstring);
    } else {
      prv_reset_card_actions();
    }

    prv_show_card();
  }
}

static void prv_inbox_dropped_handler(AppMessageResult reason, void *context) {
  APP_LOG(APP_LOG_LEVEL_WARNING, "Inbox dropped: %d", reason);
}

static void prv_outbox_failed_handler(DictionaryIterator *iter, AppMessageResult reason, void *context) {
  APP_LOG(APP_LOG_LEVEL_ERROR, "Outbox failed: %d", reason);
}

static void prv_window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);
  int16_t card_width = bounds.size.w - ACTION_BAR_WIDTH - 12;
  if (card_width < 40) {
    card_width = bounds.size.w - 12;
  }

  s_menu_layer = menu_layer_create(bounds);
  menu_layer_set_callbacks(s_menu_layer, NULL,
                           (MenuLayerCallbacks){
                               .get_num_sections = prv_menu_get_num_sections_callback,
                               .get_num_rows = prv_menu_get_num_rows_callback,
                               .get_header_height = prv_menu_get_header_height_callback,
                               .draw_header = prv_menu_draw_header_callback,
                               .draw_row = prv_menu_draw_row_callback,
                           });
  layer_add_child(window_layer, menu_layer_get_layer(s_menu_layer));

  s_action_bar_layer = action_bar_layer_create();
  if (s_action_bar_layer) {
    action_bar_layer_add_to_window(s_action_bar_layer, window);
    action_bar_layer_set_click_config_provider(s_action_bar_layer, prv_action_bar_click_config_provider);
    action_bar_layer_set_background_color(s_action_bar_layer, GColorBlack);
    layer_set_hidden(action_bar_layer_get_layer(s_action_bar_layer), true);
  }

  s_icon_play = gbitmap_create_with_resource(RESOURCE_ID_ICON_ACTION_PLAY);
  s_icon_pause = gbitmap_create_with_resource(RESOURCE_ID_ICON_ACTION_PAUSE);
  s_icon_check = gbitmap_create_with_resource(RESOURCE_ID_ICON_ACTION_CHECK);
  s_icon_x = gbitmap_create_with_resource(RESOURCE_ID_ICON_ACTION_X);
  s_icon_plus = gbitmap_create_with_resource(RESOURCE_ID_ICON_ACTION_PLUS);
  s_icon_minus = gbitmap_create_with_resource(RESOURCE_ID_ICON_ACTION_MINUS);

  s_card_title_layer = text_layer_create(GRect(6, 18, card_width, 32));
  text_layer_set_font(s_card_title_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD));
  text_layer_set_text_alignment(s_card_title_layer, GTextAlignmentCenter);
  text_layer_set_text(s_card_title_layer, s_card_title);
  layer_add_child(window_layer, text_layer_get_layer(s_card_title_layer));

  s_card_body_layer = text_layer_create(GRect(6, 56, card_width, bounds.size.h - 64));
  text_layer_set_font(s_card_body_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18));
  text_layer_set_text_alignment(s_card_body_layer, GTextAlignmentCenter);
  text_layer_set_overflow_mode(s_card_body_layer, GTextOverflowModeWordWrap);
  text_layer_set_text(s_card_body_layer, s_card_body);
  layer_add_child(window_layer, text_layer_get_layer(s_card_body_layer));

  prv_reset_card_actions();
  prv_show_card();
}

static void prv_window_unload(Window *window) {
  if (s_menu_layer) {
    menu_layer_destroy(s_menu_layer);
    s_menu_layer = NULL;
  }
  if (s_action_bar_layer) {
    action_bar_layer_destroy(s_action_bar_layer);
    s_action_bar_layer = NULL;
  }
  if (s_card_title_layer) {
    text_layer_destroy(s_card_title_layer);
    s_card_title_layer = NULL;
  }
  if (s_card_body_layer) {
    text_layer_destroy(s_card_body_layer);
    s_card_body_layer = NULL;
  }

  if (s_icon_play) {
    gbitmap_destroy(s_icon_play);
    s_icon_play = NULL;
  }
  if (s_icon_pause) {
    gbitmap_destroy(s_icon_pause);
    s_icon_pause = NULL;
  }
  if (s_icon_check) {
    gbitmap_destroy(s_icon_check);
    s_icon_check = NULL;
  }
  if (s_icon_x) {
    gbitmap_destroy(s_icon_x);
    s_icon_x = NULL;
  }
  if (s_icon_plus) {
    gbitmap_destroy(s_icon_plus);
    s_icon_plus = NULL;
  }
  if (s_icon_minus) {
    gbitmap_destroy(s_icon_minus);
    s_icon_minus = NULL;
  }
}

static void prv_init(void) {
  s_window = window_create();
  window_set_click_config_provider(s_window, prv_window_click_config_provider);
  window_set_window_handlers(s_window, (WindowHandlers){
                                           .load = prv_window_load,
                                           .unload = prv_window_unload,
                                       });

  window_stack_push(s_window, true);

  app_message_register_inbox_received(prv_inbox_received_handler);
  app_message_register_inbox_dropped(prv_inbox_dropped_handler);
  app_message_register_outbox_failed(prv_outbox_failed_handler);

  const uint32_t inbox_size = 1024;
  const uint32_t outbox_size = 256;
  AppMessageResult open_result = app_message_open(inbox_size, outbox_size);
  if (open_result != APP_MSG_OK) {
    APP_LOG(APP_LOG_LEVEL_ERROR, "app_message_open failed: %d", open_result);
  }

  if (open_result == APP_MSG_OK) {
    prv_send_action(ACTION_TYPE_READY, -1, NULL, NULL);
  }
}

static void prv_deinit(void) {
  if (s_dictation_session) {
    dictation_session_destroy(s_dictation_session);
    s_dictation_session = NULL;
  }
  window_destroy(s_window);
}

int main(void) {
  prv_init();
  app_event_loop();
  prv_deinit();
}
