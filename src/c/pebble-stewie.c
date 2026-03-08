#include <pebble.h>
#include <string.h>

#define MAX_TITLE_LEN 32
#define MAX_BODY_LEN 192
#define MAX_SCREEN_ID_LEN 32
#define MAX_MENU_ITEMS 8
#define MAX_ITEM_ID_LEN 24
#define MAX_ITEM_LABEL_LEN 32
#define MENU_BODY_MAX_HEIGHT 50
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

static Window *s_window;
static MenuLayer *s_menu_layer;
static TextLayer *s_menu_body_layer;
static TextLayer *s_card_title_layer;
static TextLayer *s_card_body_layer;
static DictationSession *s_dictation_session;
static GRect s_window_bounds;

static MenuItem s_menu_items[MAX_MENU_ITEMS];
static uint16_t s_menu_item_count;

static char s_menu_title[MAX_TITLE_LEN] = "Menu";
static char s_menu_body[MAX_BODY_LEN] = "";
static char s_card_title[MAX_TITLE_LEN] = "Loading";
static char s_card_body[MAX_BODY_LEN] = "Waiting for phone...";
static char s_current_screen_id[MAX_SCREEN_ID_LEN] = "";
static uint8_t s_current_ui_type = UI_TYPE_CARD;
static uint16_t s_selected_menu_row = 0;

static void prv_send_action(uint8_t action_type, int32_t item_index, const char *item_id,
                            const char *action_text);

static void prv_layout_menu_layers(void) {
  if (!s_menu_layer || !s_menu_body_layer) {
    return;
  }

  int16_t top_offset = 0;
  if (s_menu_body[0] != '\0') {
    text_layer_set_text(s_menu_body_layer, s_menu_body);
    GSize content_size = text_layer_get_content_size(s_menu_body_layer);
    int16_t body_height = content_size.h;
    if (body_height < 18) {
      body_height = 18;
    }
    if (body_height > MENU_BODY_MAX_HEIGHT) {
      body_height = MENU_BODY_MAX_HEIGHT;
    }

    layer_set_frame(text_layer_get_layer(s_menu_body_layer),
                    GRect(6, 2, s_window_bounds.size.w - 12, body_height));
    layer_set_hidden(text_layer_get_layer(s_menu_body_layer), false);
    top_offset = body_height + 4;
  } else {
    layer_set_hidden(text_layer_get_layer(s_menu_body_layer), true);
  }

  layer_set_frame(menu_layer_get_layer(s_menu_layer),
                  GRect(0, top_offset, s_window_bounds.size.w, s_window_bounds.size.h - top_offset));
}

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
  if (!s_menu_layer || !s_menu_body_layer || !s_card_title_layer || !s_card_body_layer) {
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
  prv_layout_menu_layers();
  menu_layer_reload_data(s_menu_layer);

  if (s_menu_item_count > 0) {
    MenuIndex index = (MenuIndex){.section = 0, .row = s_selected_menu_row};
    menu_layer_set_selected_index(s_menu_layer, index, MenuRowAlignCenter, false);
  }
}

static void prv_show_card(void) {
  if (!s_menu_layer || !s_menu_body_layer || !s_card_title_layer || !s_card_body_layer) {
    return;
  }

  s_current_ui_type = UI_TYPE_CARD;
  text_layer_set_text(s_card_title_layer, s_card_title);
  text_layer_set_text(s_card_body_layer, s_card_body);

  layer_set_hidden(menu_layer_get_layer(s_menu_layer), true);
  layer_set_hidden(text_layer_get_layer(s_menu_body_layer), true);
  layer_set_hidden(text_layer_get_layer(s_card_title_layer), false);
  layer_set_hidden(text_layer_get_layer(s_card_body_layer), false);
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

static void prv_select_click_handler(ClickRecognizerRef recognizer, void *context) {
  prv_send_selected_menu_action();
}

static void prv_up_click_handler(ClickRecognizerRef recognizer, void *context) {
  if (s_current_ui_type != UI_TYPE_MENU || s_menu_item_count == 0 || s_selected_menu_row == 0) {
    return;
  }

  s_selected_menu_row--;
  MenuIndex index = (MenuIndex){.section = 0, .row = s_selected_menu_row};
  menu_layer_set_selected_index(s_menu_layer, index, MenuRowAlignCenter, true);
}

static void prv_down_click_handler(ClickRecognizerRef recognizer, void *context) {
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

static void prv_click_config_provider(void *context) {
  window_single_click_subscribe(BUTTON_ID_UP, prv_up_click_handler);
  window_single_click_subscribe(BUTTON_ID_SELECT, prv_select_click_handler);
  window_single_click_subscribe(BUTTON_ID_DOWN, prv_down_click_handler);
  window_single_click_subscribe(BUTTON_ID_BACK, prv_back_click_handler);
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
    Tuple *body_tuple = dict_find(iter, MESSAGE_KEY_body);

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

    if (body_tuple && body_tuple->type == TUPLE_CSTRING) {
      prv_copy_with_limit(s_menu_body, sizeof(s_menu_body), body_tuple->value->cstring,
                          strlen(body_tuple->value->cstring));
    } else {
      s_menu_body[0] = '\0';
    }

    s_selected_menu_row = 0;
    prv_show_menu();
    return;
  }

  if (ui_type == UI_TYPE_CARD) {
    Tuple *title_tuple = dict_find(iter, MESSAGE_KEY_title);
    Tuple *body_tuple = dict_find(iter, MESSAGE_KEY_body);

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
  s_window_bounds = layer_get_bounds(window_layer);

  s_menu_layer = menu_layer_create(s_window_bounds);
  menu_layer_set_callbacks(s_menu_layer, NULL,
                           (MenuLayerCallbacks){
                               .get_num_sections = prv_menu_get_num_sections_callback,
                               .get_num_rows = prv_menu_get_num_rows_callback,
                               .get_header_height = prv_menu_get_header_height_callback,
                               .draw_header = prv_menu_draw_header_callback,
                               .draw_row = prv_menu_draw_row_callback,
                           });
  layer_add_child(window_layer, menu_layer_get_layer(s_menu_layer));

  s_menu_body_layer = text_layer_create(GRect(6, 2, s_window_bounds.size.w - 12, 32));
  text_layer_set_font(s_menu_body_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_text_alignment(s_menu_body_layer, GTextAlignmentCenter);
  text_layer_set_overflow_mode(s_menu_body_layer, GTextOverflowModeWordWrap);
  text_layer_set_text(s_menu_body_layer, s_menu_body);
  layer_add_child(window_layer, text_layer_get_layer(s_menu_body_layer));

  s_card_title_layer = text_layer_create(GRect(6, 18, s_window_bounds.size.w - 12, 32));
  text_layer_set_font(s_card_title_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD));
  text_layer_set_text_alignment(s_card_title_layer, GTextAlignmentCenter);
  text_layer_set_text(s_card_title_layer, s_card_title);
  layer_add_child(window_layer, text_layer_get_layer(s_card_title_layer));

  s_card_body_layer = text_layer_create(GRect(6, 56, s_window_bounds.size.w - 12, s_window_bounds.size.h - 64));
  text_layer_set_font(s_card_body_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18));
  text_layer_set_text_alignment(s_card_body_layer, GTextAlignmentCenter);
  text_layer_set_overflow_mode(s_card_body_layer, GTextOverflowModeWordWrap);
  text_layer_set_text(s_card_body_layer, s_card_body);
  layer_add_child(window_layer, text_layer_get_layer(s_card_body_layer));

  prv_show_card();
}

static void prv_window_unload(Window *window) {
  menu_layer_destroy(s_menu_layer);
  text_layer_destroy(s_menu_body_layer);
  text_layer_destroy(s_card_title_layer);
  text_layer_destroy(s_card_body_layer);
}

static void prv_init(void) {
  s_window = window_create();
  window_set_click_config_provider(s_window, prv_click_config_provider);
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
