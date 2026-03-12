#include "input.h"

#include "protocol.h"
#include "state.h"

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

static void prv_send_selected_menu_action(void) {
  if (s_current_ui_type != UI_TYPE_MENU || s_menu_item_count == 0) {
    return;
  }

  if (s_selected_menu_row >= s_menu_item_count) {
    return;
  }

  MenuItem *selected = &s_menu_items[s_selected_menu_row];
  if (strcmp(selected->id, VOICE_INPUT_ITEM_ID) == 0) {
    stewie_start_dictation();
    return;
  }

  stewie_send_action(ACTION_TYPE_SELECT, s_selected_menu_row, selected->id, NULL);
}

static bool prv_send_card_action_for_button(ButtonId button_id) {
  if (s_current_ui_type != UI_TYPE_CARD) {
    return false;
  }

  CardAction *action = prv_get_card_action(button_id);
  if (!action) {
    return false;
  }

  stewie_send_action(ACTION_TYPE_SELECT, -1, action->id, NULL);
  return true;
}

void stewie_reset_card_actions(void) {
  memset(s_card_actions, 0, sizeof(s_card_actions));
  s_card_actions[0].button_id = BUTTON_ID_UP;
  s_card_actions[1].button_id = BUTTON_ID_SELECT;
  s_card_actions[2].button_id = BUTTON_ID_DOWN;
  s_card_action_count = 0;
}

void stewie_parse_card_actions(const char *encoded_actions) {
  stewie_reset_card_actions();

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
              stewie_copy_with_limit(action->id, sizeof(action->id), first_sep + 1, id_len);
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

void stewie_apply_card_actions(void) {
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

void stewie_select_click_handler(ClickRecognizerRef recognizer, void *context) {
  if (prv_send_card_action_for_button(BUTTON_ID_SELECT)) {
    return;
  }

  prv_send_selected_menu_action();
}

void stewie_up_click_handler(ClickRecognizerRef recognizer, void *context) {
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

void stewie_down_click_handler(ClickRecognizerRef recognizer, void *context) {
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

void stewie_back_click_handler(ClickRecognizerRef recognizer, void *context) {
  stewie_send_action(ACTION_TYPE_BACK, -1, NULL, NULL);
}

void stewie_window_click_config_provider(void *context) {
  window_single_click_subscribe(BUTTON_ID_BACK, stewie_back_click_handler);
  if (!s_action_bar_layer) {
    window_single_click_subscribe(BUTTON_ID_UP, stewie_up_click_handler);
    window_single_click_subscribe(BUTTON_ID_SELECT, stewie_select_click_handler);
    window_single_click_subscribe(BUTTON_ID_DOWN, stewie_down_click_handler);
  }
}

void stewie_action_bar_click_config_provider(void *context) {
  // Action bar click config can override window-level handlers, so register
  // back here too to preserve app-level navigation.
  window_single_click_subscribe(BUTTON_ID_BACK, stewie_back_click_handler);
  window_single_click_subscribe(BUTTON_ID_UP, stewie_up_click_handler);
  window_single_click_subscribe(BUTTON_ID_SELECT, stewie_select_click_handler);
  window_single_click_subscribe(BUTTON_ID_DOWN, stewie_down_click_handler);
}
