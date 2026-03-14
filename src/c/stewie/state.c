#include "state.h"

Window *s_window = NULL;
MenuLayer *s_menu_layer = NULL;
TextLayer *s_menu_body_layer = NULL;
TextLayer *s_card_title_layer = NULL;
TextLayer *s_card_body_layer = NULL;
ActionBarLayer *s_action_bar_layer = NULL;
Layer *s_menu_action_hint_layer = NULL;
ActionMenu *s_menu_action_menu = NULL;
ActionMenuLevel *s_menu_action_root_level = NULL;
ScrollLayer *s_scroll_layer = NULL;
TextLayer *s_scroll_body_layer = NULL;
Layer *s_draw_layer = NULL;
AppTimer *s_draw_timer = NULL;
DictationSession *s_dictation_session = NULL;
GBitmap *s_icon_play = NULL;
GBitmap *s_icon_pause = NULL;
GBitmap *s_icon_check = NULL;
GBitmap *s_icon_x = NULL;
GBitmap *s_icon_plus = NULL;
GBitmap *s_icon_minus = NULL;
GRect s_window_bounds;

MenuItem s_menu_items[MAX_MENU_ITEMS];
uint16_t s_menu_item_count = 0;
MenuAction s_menu_actions[MAX_MENU_ACTIONS];
uint16_t s_menu_action_count = 0;
CardAction s_card_actions[MAX_CARD_ACTIONS];
uint16_t s_card_action_count = 0;
DrawStep s_draw_steps[MAX_DRAW_STEPS];
uint8_t s_draw_step_count = 0;
char s_draw_payload_buffer[MAX_DRAW_PAYLOAD_LEN];

char s_menu_title[MAX_TITLE_LEN] = "Menu";
char s_menu_body[MAX_BODY_LEN] = "";
char s_card_title[MAX_TITLE_LEN] = "Loading";
char s_card_body[MAX_BODY_LEN] = "Waiting for phone...";
char s_scroll_body[MAX_SCROLL_BODY_LEN] = "";
char s_current_screen_id[MAX_SCREEN_ID_LEN] = "";
uint8_t s_current_ui_type = UI_TYPE_CARD;
uint16_t s_selected_menu_row = 0;
uint8_t s_draw_play_mode = DRAW_PLAY_MODE_LOOP;
uint8_t s_draw_background = DRAW_BACKGROUND_GRID;
uint16_t s_draw_timeline_ms = 1600;
uint16_t s_draw_cycle_ms = 1600;
uint32_t s_draw_elapsed_ms = 0;

void stewie_copy_with_limit(char *dest, size_t dest_size, const char *src, size_t src_len) {
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
