#pragma once

#include <pebble.h>
#include <string.h>

#define MAX_TITLE_LEN 32
#define MAX_BODY_LEN 192
#define MAX_SCROLL_BODY_LEN 1040
#define MAX_SCREEN_ID_LEN 32
#define MAX_MENU_ITEMS 8
#define MAX_MENU_ACTIONS 6
#define MAX_DRAW_STEPS 6
#define MAX_ITEM_ID_LEN 24
#define MAX_ITEM_LABEL_LEN 32
#define MAX_CARD_ACTIONS NUM_ACTION_BAR_ITEMS
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
  UI_TYPE_SCROLL = 3,
  UI_TYPE_DRAW = 4,
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
  char id[MAX_ITEM_ID_LEN];
  char label[MAX_ITEM_LABEL_LEN];
} MenuAction;

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

enum DrawStepKind {
  DRAW_STEP_KIND_CIRCLE = 1,
  DRAW_STEP_KIND_RECT = 2,
  DRAW_STEP_KIND_TEXT = 3,
};

enum DrawColorType {
  DRAW_COLOR_INK = 1,
  DRAW_COLOR_ACCENT = 2,
  DRAW_COLOR_ACCENT2 = 3,
  DRAW_COLOR_DANGER = 4,
};

enum DrawPlayMode {
  DRAW_PLAY_MODE_LOOP = 1,
  DRAW_PLAY_MODE_ONCE = 2,
  DRAW_PLAY_MODE_PING_PONG = 3,
};

enum DrawBackgroundType {
  DRAW_BACKGROUND_GRID = 1,
  DRAW_BACKGROUND_DARK = 2,
  DRAW_BACKGROUND_LIGHT = 3,
};

typedef struct {
  char id[MAX_ITEM_ID_LEN];
  char label[MAX_ITEM_LABEL_LEN];
  uint8_t kind;
  uint8_t color;
  bool fill;
  int16_t x;
  int16_t y;
  int16_t to_x;
  int16_t to_y;
  int16_t width;
  int16_t height;
  uint16_t delay_ms;
  uint16_t duration_ms;
  uint16_t from_scale_pct;
  uint16_t to_scale_pct;
  uint8_t from_opacity_pct;
  uint8_t to_opacity_pct;
} DrawStep;

extern Window *s_window;
extern MenuLayer *s_menu_layer;
extern TextLayer *s_menu_body_layer;
extern TextLayer *s_card_title_layer;
extern TextLayer *s_card_body_layer;
extern ActionBarLayer *s_action_bar_layer;
extern Layer *s_menu_action_hint_layer;
extern ActionMenu *s_menu_action_menu;
extern ActionMenuLevel *s_menu_action_root_level;
extern ScrollLayer *s_scroll_layer;
extern TextLayer *s_scroll_body_layer;
extern Layer *s_draw_layer;
extern AppTimer *s_draw_timer;
extern DictationSession *s_dictation_session;
extern GBitmap *s_icon_play;
extern GBitmap *s_icon_pause;
extern GBitmap *s_icon_check;
extern GBitmap *s_icon_x;
extern GBitmap *s_icon_plus;
extern GBitmap *s_icon_minus;
extern GRect s_window_bounds;

extern MenuItem s_menu_items[MAX_MENU_ITEMS];
extern uint16_t s_menu_item_count;
extern MenuAction s_menu_actions[MAX_MENU_ACTIONS];
extern uint16_t s_menu_action_count;
extern CardAction s_card_actions[MAX_CARD_ACTIONS];
extern uint16_t s_card_action_count;
extern DrawStep s_draw_steps[MAX_DRAW_STEPS];
extern uint8_t s_draw_step_count;

extern char s_menu_title[MAX_TITLE_LEN];
extern char s_menu_body[MAX_BODY_LEN];
extern char s_card_title[MAX_TITLE_LEN];
extern char s_card_body[MAX_BODY_LEN];
extern char s_scroll_body[MAX_SCROLL_BODY_LEN];
extern char s_current_screen_id[MAX_SCREEN_ID_LEN];
extern uint8_t s_current_ui_type;
extern uint16_t s_selected_menu_row;
extern uint8_t s_draw_play_mode;
extern uint8_t s_draw_background;
extern uint16_t s_draw_timeline_ms;
extern uint16_t s_draw_cycle_ms;
extern uint32_t s_draw_elapsed_ms;

void stewie_copy_with_limit(char *dest, size_t dest_size, const char *src, size_t src_len);
