#include "stewie/input.h"
#include "stewie/protocol.h"
#include "stewie/state.h"
#include "stewie/ui.h"

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
    stewie_copy_with_limit(s_current_screen_id, sizeof(s_current_screen_id), screen_id_tuple->value->cstring,
                           strlen(screen_id_tuple->value->cstring));
  }

  const uint8_t ui_type = ui_type_tuple->value->uint8;

  if (ui_type == UI_TYPE_MENU) {
    Tuple *title_tuple = dict_find(iter, MESSAGE_KEY_title);
    Tuple *items_tuple = dict_find(iter, MESSAGE_KEY_items);
    Tuple *body_tuple = dict_find(iter, MESSAGE_KEY_body);

    if (title_tuple && title_tuple->type == TUPLE_CSTRING) {
      stewie_copy_with_limit(s_menu_title, sizeof(s_menu_title), title_tuple->value->cstring,
                             strlen(title_tuple->value->cstring));
    } else {
      stewie_copy_with_limit(s_menu_title, sizeof(s_menu_title), "Menu", 4);
    }

    if (items_tuple && items_tuple->type == TUPLE_CSTRING) {
      stewie_parse_menu_items(items_tuple->value->cstring);
    } else {
      s_menu_item_count = 0;
    }

    stewie_reset_menu_actions();

    if (body_tuple && body_tuple->type == TUPLE_CSTRING) {
      stewie_copy_with_limit(s_menu_body, sizeof(s_menu_body), body_tuple->value->cstring,
                             strlen(body_tuple->value->cstring));
    } else {
      s_menu_body[0] = '\0';
    }

    stewie_reset_card_actions();
    s_selected_menu_row = 0;
    stewie_show_menu();
  }

  if (ui_type == UI_TYPE_CARD) {
    Tuple *title_tuple = dict_find(iter, MESSAGE_KEY_title);
    Tuple *body_tuple = dict_find(iter, MESSAGE_KEY_body);
    Tuple *actions_tuple = dict_find(iter, MESSAGE_KEY_actions);

    stewie_reset_menu_actions();
    if (title_tuple && title_tuple->type == TUPLE_CSTRING) {
      stewie_copy_with_limit(s_card_title, sizeof(s_card_title), title_tuple->value->cstring,
                             strlen(title_tuple->value->cstring));
    } else {
      stewie_copy_with_limit(s_card_title, sizeof(s_card_title), "Card", 4);
    }

    if (body_tuple && body_tuple->type == TUPLE_CSTRING) {
      stewie_copy_with_limit(s_card_body, sizeof(s_card_body), body_tuple->value->cstring,
                             strlen(body_tuple->value->cstring));
    } else {
      s_card_body[0] = '\0';
    }

    if (actions_tuple && actions_tuple->type == TUPLE_CSTRING) {
      stewie_parse_card_actions(actions_tuple->value->cstring);
    } else {
      stewie_reset_card_actions();
    }

    stewie_show_card();
  }

  if (ui_type == UI_TYPE_SCROLL) {
    Tuple *title_tuple = dict_find(iter, MESSAGE_KEY_title);
    Tuple *body_tuple = dict_find(iter, MESSAGE_KEY_body);
    Tuple *actions_tuple = dict_find(iter, MESSAGE_KEY_actions);

    stewie_reset_menu_actions();
    if (title_tuple && title_tuple->type == TUPLE_CSTRING) {
      stewie_copy_with_limit(s_card_title, sizeof(s_card_title), title_tuple->value->cstring,
                             strlen(title_tuple->value->cstring));
    } else {
      stewie_copy_with_limit(s_card_title, sizeof(s_card_title), "Scroll", 6);
    }

    if (body_tuple && body_tuple->type == TUPLE_CSTRING) {
      stewie_copy_with_limit(s_scroll_body, sizeof(s_scroll_body), body_tuple->value->cstring,
                             strlen(body_tuple->value->cstring));
    } else {
      s_scroll_body[0] = '\0';
    }

    stewie_reset_menu_actions();
    if (actions_tuple && actions_tuple->type == TUPLE_CSTRING) {
      stewie_parse_menu_actions(actions_tuple->value->cstring);
    }

    stewie_reset_card_actions();
    stewie_show_scroll();
  }

  // Handle run effects
  Tuple *vibe_tuple = dict_find(iter, MESSAGE_KEY_effectVibe);
  if (vibe_tuple && vibe_tuple->type == TUPLE_CSTRING) {
    const char *vibe = vibe_tuple->value->cstring;
    if (strcmp(vibe, "short") == 0) {
      vibes_short_pulse();
    } else if (strcmp(vibe, "long") == 0) {
      vibes_long_pulse();
    } else if (strcmp(vibe, "double") == 0) {
      vibes_double_pulse();
    }
  }

  Tuple *light_tuple = dict_find(iter, MESSAGE_KEY_effectLight);
  if (light_tuple) {
    light_enable_interaction();
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
  int16_t card_width = s_window_bounds.size.w - ACTION_BAR_WIDTH - 12;
  if (card_width < 40) {
    card_width = s_window_bounds.size.w - 12;
  }

  s_menu_layer = menu_layer_create(s_window_bounds);
  menu_layer_set_callbacks(s_menu_layer, NULL,
                           (MenuLayerCallbacks){
                               .get_num_sections = stewie_menu_get_num_sections_callback,
                               .get_num_rows = stewie_menu_get_num_rows_callback,
                               .get_header_height = stewie_menu_get_header_height_callback,
                               .draw_header = stewie_menu_draw_header_callback,
                               .draw_row = stewie_menu_draw_row_callback,
                           });
  layer_add_child(window_layer, menu_layer_get_layer(s_menu_layer));

  s_menu_body_layer = text_layer_create(GRect(6, 2, s_window_bounds.size.w - 12, 32));
  text_layer_set_font(s_menu_body_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_text_alignment(s_menu_body_layer, GTextAlignmentCenter);
  text_layer_set_overflow_mode(s_menu_body_layer, GTextOverflowModeWordWrap);
  text_layer_set_text(s_menu_body_layer, s_menu_body);
  layer_add_child(window_layer, text_layer_get_layer(s_menu_body_layer));

  s_menu_action_hint_layer = layer_create(GRect(s_window_bounds.size.w - 14, s_window_bounds.size.h / 2, 14, 14));
  if (s_menu_action_hint_layer) {
    layer_set_update_proc(s_menu_action_hint_layer, stewie_menu_action_hint_update_proc);
    layer_set_hidden(s_menu_action_hint_layer, true);
    layer_add_child(window_layer, s_menu_action_hint_layer);
  }

  s_action_bar_layer = action_bar_layer_create();
  if (s_action_bar_layer) {
    action_bar_layer_add_to_window(s_action_bar_layer, window);
    action_bar_layer_set_click_config_provider(s_action_bar_layer, stewie_action_bar_click_config_provider);
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

  s_card_body_layer = text_layer_create(GRect(6, 56, card_width, s_window_bounds.size.h - 64));
  text_layer_set_font(s_card_body_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18));
  text_layer_set_text_alignment(s_card_body_layer, GTextAlignmentCenter);
  text_layer_set_overflow_mode(s_card_body_layer, GTextOverflowModeWordWrap);
  text_layer_set_text(s_card_body_layer, s_card_body);
  layer_add_child(window_layer, text_layer_get_layer(s_card_body_layer));

  // ScrollLayer for long-form text
  int16_t scroll_content_width = s_window_bounds.size.w - 12;
  s_scroll_layer = scroll_layer_create(s_window_bounds);
  scroll_layer_set_paging(s_scroll_layer, true);

  s_scroll_body_layer = text_layer_create(GRect(6, 0, scroll_content_width, s_window_bounds.size.h));
  text_layer_set_font(s_scroll_body_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18));
  text_layer_set_text_alignment(s_scroll_body_layer, GTextAlignmentLeft);
  text_layer_set_overflow_mode(s_scroll_body_layer, GTextOverflowModeWordWrap);
  scroll_layer_add_child(s_scroll_layer, text_layer_get_layer(s_scroll_body_layer));

  layer_add_child(window_layer, scroll_layer_get_layer(s_scroll_layer));
  layer_set_hidden(scroll_layer_get_layer(s_scroll_layer), true);

  if (s_menu_action_hint_layer) {
    layer_remove_from_parent(s_menu_action_hint_layer);
    layer_add_child(window_layer, s_menu_action_hint_layer);
  }

  stewie_reset_card_actions();
  stewie_show_card();
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
  if (s_menu_body_layer) {
    text_layer_destroy(s_menu_body_layer);
    s_menu_body_layer = NULL;
  }
  if (s_menu_action_hint_layer) {
    layer_destroy(s_menu_action_hint_layer);
    s_menu_action_hint_layer = NULL;
  }
  if (s_card_title_layer) {
    text_layer_destroy(s_card_title_layer);
    s_card_title_layer = NULL;
  }
  if (s_card_body_layer) {
    text_layer_destroy(s_card_body_layer);
    s_card_body_layer = NULL;
  }
  if (s_scroll_body_layer) {
    text_layer_destroy(s_scroll_body_layer);
    s_scroll_body_layer = NULL;
  }
  if (s_scroll_layer) {
    scroll_layer_destroy(s_scroll_layer);
    s_scroll_layer = NULL;
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
  window_set_click_config_provider(s_window, stewie_window_click_config_provider);
  window_set_window_handlers(s_window, (WindowHandlers){
                                           .load = prv_window_load,
                                           .unload = prv_window_unload,
                                       });

  window_stack_push(s_window, true);

  app_message_register_inbox_received(prv_inbox_received_handler);
  app_message_register_inbox_dropped(prv_inbox_dropped_handler);
  app_message_register_outbox_failed(prv_outbox_failed_handler);

  const uint32_t inbox_size = 2048;
  const uint32_t outbox_size = 256;
  AppMessageResult open_result = app_message_open(inbox_size, outbox_size);
  if (open_result != APP_MSG_OK) {
    APP_LOG(APP_LOG_LEVEL_ERROR, "app_message_open failed: %d", open_result);
  }

  if (open_result == APP_MSG_OK) {
    stewie_send_action(ACTION_TYPE_READY, -1, NULL, NULL);
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
