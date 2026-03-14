#include "ui.h"

#include "input.h"
#include "state.h"

void stewie_menu_action_hint_update_proc(Layer *layer, GContext *ctx) {
  if (!layer || s_current_ui_type != UI_TYPE_SCROLL || s_menu_action_count == 0) {
    return;
  }

  GRect bounds = layer_get_bounds(layer);
  GPoint center = GPoint(bounds.size.w / 2, bounds.size.h / 2);
  graphics_context_set_fill_color(ctx, GColorBlack);
  graphics_fill_circle(ctx, center, 4);
}

void stewie_layout_menu_layers(void) {
  if (!s_menu_layer || !s_menu_body_layer) {
    return;
  }

  int16_t right_padding = s_menu_action_count > 0 ? 16 : 0;
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
                    GRect(6, 2, s_window_bounds.size.w - 12 - right_padding, body_height));
    layer_set_hidden(text_layer_get_layer(s_menu_body_layer), false);
    top_offset = body_height + 4;
  } else {
    layer_set_hidden(text_layer_get_layer(s_menu_body_layer), true);
  }

  layer_set_frame(menu_layer_get_layer(s_menu_layer),
                  GRect(0, top_offset, s_window_bounds.size.w - right_padding, s_window_bounds.size.h - top_offset));

  if (s_menu_action_hint_layer) {
    int16_t hint_y = top_offset + ((s_window_bounds.size.h - top_offset) / 2) - 5;
    if (hint_y < top_offset + 8) {
      hint_y = top_offset + 8;
    }
    layer_set_frame(s_menu_action_hint_layer, GRect(s_window_bounds.size.w - 14, hint_y, 14, 14));
    layer_set_hidden(s_menu_action_hint_layer, s_menu_action_count == 0);
    layer_mark_dirty(s_menu_action_hint_layer);
  }
}

void stewie_show_menu(void) {
  if (!s_menu_layer || !s_menu_body_layer || !s_card_title_layer || !s_card_body_layer) {
    return;
  }

  // Restore window click config if coming from scroll mode
  window_set_click_config_provider(s_window, stewie_window_click_config_provider);
  s_current_ui_type = UI_TYPE_MENU;
  if (s_menu_item_count == 0) {
    s_selected_menu_row = 0;
  } else if (s_selected_menu_row >= s_menu_item_count) {
    s_selected_menu_row = s_menu_item_count - 1;
  }

  layer_set_hidden(menu_layer_get_layer(s_menu_layer), false);
  layer_set_hidden(text_layer_get_layer(s_card_title_layer), true);
  layer_set_hidden(text_layer_get_layer(s_card_body_layer), true);
  if (s_scroll_layer) {
    layer_set_hidden(scroll_layer_get_layer(s_scroll_layer), true);
  }
  if (s_action_bar_layer) {
    layer_set_hidden(action_bar_layer_get_layer(s_action_bar_layer), true);
  }
  stewie_layout_menu_layers();
  menu_layer_reload_data(s_menu_layer);

  if (s_menu_item_count > 0) {
    MenuIndex index = (MenuIndex){.section = 0, .row = s_selected_menu_row};
    menu_layer_set_selected_index(s_menu_layer, index, MenuRowAlignCenter, false);
  }
}

void stewie_show_card(void) {
  if (!s_menu_layer || !s_menu_body_layer || !s_card_title_layer || !s_card_body_layer) {
    return;
  }

  // Restore window click config if coming from scroll mode
  window_set_click_config_provider(s_window, stewie_window_click_config_provider);
  s_current_ui_type = UI_TYPE_CARD;
  text_layer_set_text(s_card_title_layer, s_card_title);
  text_layer_set_text(s_card_body_layer, s_card_body);

  layer_set_hidden(menu_layer_get_layer(s_menu_layer), true);
  layer_set_hidden(text_layer_get_layer(s_menu_body_layer), true);
  layer_set_hidden(text_layer_get_layer(s_card_title_layer), false);
  layer_set_hidden(text_layer_get_layer(s_card_body_layer), false);
  if (s_scroll_layer) {
    layer_set_hidden(scroll_layer_get_layer(s_scroll_layer), true);
  }
  if (s_action_bar_layer) {
    stewie_apply_card_actions();
    layer_set_hidden(action_bar_layer_get_layer(s_action_bar_layer), s_card_action_count == 0);
  }
  if (s_menu_action_hint_layer) {
    layer_set_hidden(s_menu_action_hint_layer, true);
  }
}

void stewie_show_scroll(void) {
  if (!s_scroll_layer || !s_scroll_body_layer) {
    return;
  }

  s_current_ui_type = UI_TYPE_SCROLL;

  // Hide other layers
  if (s_menu_layer) {
    layer_set_hidden(menu_layer_get_layer(s_menu_layer), true);
  }
  if (s_menu_body_layer) {
    layer_set_hidden(text_layer_get_layer(s_menu_body_layer), true);
  }
  if (s_card_body_layer) {
    layer_set_hidden(text_layer_get_layer(s_card_body_layer), true);
  }
  if (s_action_bar_layer) {
    layer_set_hidden(action_bar_layer_get_layer(s_action_bar_layer), true);
  }
  if (s_menu_action_hint_layer) {
    layer_set_hidden(s_menu_action_hint_layer, true);
  }

  // Show title above the scroll layer
  int16_t title_height = 28;
  if (s_card_title_layer) {
    text_layer_set_text(s_card_title_layer, s_card_title);
    layer_set_frame(text_layer_get_layer(s_card_title_layer),
                    GRect(6, 0, s_window_bounds.size.w - 12, title_height));
    layer_set_hidden(text_layer_get_layer(s_card_title_layer), false);
  }

  // Set up scroll layer click config (handles UP/DOWN for scrolling, adds BACK)
  scroll_layer_set_callbacks(s_scroll_layer, (ScrollLayerCallbacks){
    .click_config_provider = stewie_scroll_click_config_provider
  });
  scroll_layer_set_click_config_onto_window(s_scroll_layer, s_window);

  // Position scroll layer below the title
  layer_set_frame(scroll_layer_get_layer(s_scroll_layer),
                  GRect(0, title_height, s_window_bounds.size.w, s_window_bounds.size.h - title_height));

  // Set scroll body text and calculate content size
  text_layer_set_text(s_scroll_body_layer, s_scroll_body);

  int16_t content_width = s_window_bounds.size.w - 12;
  GSize max_size = GSize(content_width, 2000);
  GSize content_size = graphics_text_layout_get_content_size(
      s_scroll_body, fonts_get_system_font(FONT_KEY_GOTHIC_18),
      GRect(0, 0, max_size.w, max_size.h), GTextOverflowModeWordWrap, GTextAlignmentLeft);

  int16_t total_height = content_size.h + 16;
  layer_set_frame(text_layer_get_layer(s_scroll_body_layer),
                  GRect(6, 0, content_width, content_size.h + 8));

  scroll_layer_set_content_size(s_scroll_layer, GSize(s_window_bounds.size.w, total_height));
  scroll_layer_set_content_offset(s_scroll_layer, GPointZero, false);
  layer_set_hidden(scroll_layer_get_layer(s_scroll_layer), false);

  if (s_menu_action_hint_layer) {
    int16_t hint_y = title_height + ((s_window_bounds.size.h - title_height) / 2) - 5;
    layer_set_frame(s_menu_action_hint_layer, GRect(s_window_bounds.size.w - 14, hint_y, 14, 14));
    layer_set_hidden(s_menu_action_hint_layer, s_menu_action_count == 0);
    layer_mark_dirty(s_menu_action_hint_layer);
  }
}

void stewie_parse_menu_items(const char *encoded_items) {
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
        stewie_copy_with_limit(item->id, sizeof(item->id), cursor, id_len);
        stewie_copy_with_limit(item->label, sizeof(item->label), separator + 1, label_len);
      } else {
        stewie_copy_with_limit(item->id, sizeof(item->id), cursor, line_len);
        stewie_copy_with_limit(item->label, sizeof(item->label), cursor, line_len);
      }

      if (item->label[0] != '\0') {
        if (item->id[0] == '\0') {
          stewie_copy_with_limit(item->id, sizeof(item->id), item->label, strlen(item->label));
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

uint16_t stewie_menu_get_num_sections_callback(MenuLayer *menu_layer, void *context) {
  return 1;
}

uint16_t stewie_menu_get_num_rows_callback(MenuLayer *menu_layer, uint16_t section_index, void *context) {
  return s_menu_item_count;
}

int16_t stewie_menu_get_header_height_callback(MenuLayer *menu_layer, uint16_t section_index, void *context) {
  return MENU_CELL_BASIC_HEADER_HEIGHT;
}

void stewie_menu_draw_header_callback(GContext *ctx, const Layer *cell_layer, uint16_t section_index,
                                      void *context) {
  menu_cell_basic_header_draw(ctx, cell_layer, s_menu_title);
}

void stewie_menu_draw_row_callback(GContext *ctx, const Layer *cell_layer, MenuIndex *cell_index, void *context) {
  if (cell_index->row >= s_menu_item_count) {
    return;
  }

  menu_cell_basic_draw(ctx, cell_layer, s_menu_items[cell_index->row].label, NULL, NULL);
}
