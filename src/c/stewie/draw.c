#include "ui.h"

#include "input.h"
#include "state.h"

#define DRAW_TOKEN_COUNT 18
#define DRAW_TOKEN_SIZE 32
#define DRAW_TICK_MS 33

static int16_t prv_clamp_int16(int32_t value, int16_t min, int16_t max) {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return (int16_t)value;
}

static uint16_t prv_clamp_uint16(int32_t value, uint16_t min, uint16_t max) {
  if (value < (int32_t)min) {
    return min;
  }
  if (value > (int32_t)max) {
    return max;
  }
  return (uint16_t)value;
}

static uint8_t prv_clamp_uint8(int32_t value, uint8_t min, uint8_t max) {
  if (value < (int32_t)min) {
    return min;
  }
  if (value > (int32_t)max) {
    return max;
  }
  return (uint8_t)value;
}

static int32_t prv_parse_int(const char *token, int32_t fallback) {
  if (!token || token[0] == '\0') {
    return fallback;
  }
  return (int32_t)strtol(token, NULL, 10);
}

static uint8_t prv_tokenize_line(const char *line, size_t line_len,
                                 char tokens[DRAW_TOKEN_COUNT][DRAW_TOKEN_SIZE]) {
  uint8_t count = 0;
  const char *cursor = line;
  const char *line_end = line + line_len;

  while (cursor <= line_end && count < DRAW_TOKEN_COUNT) {
    const char *separator = memchr(cursor, '|', (size_t)(line_end - cursor));
    const char *token_end = separator ? separator : line_end;
    stewie_copy_with_limit(tokens[count], DRAW_TOKEN_SIZE, cursor, (size_t)(token_end - cursor));
    count++;
    if (!separator) {
      break;
    }
    cursor = separator + 1;
  }

  return count;
}

static uint8_t prv_parse_play_mode(const char *token) {
  if (token && strcmp(token, "o") == 0) {
    return DRAW_PLAY_MODE_ONCE;
  }
  if (token && strcmp(token, "p") == 0) {
    return DRAW_PLAY_MODE_PING_PONG;
  }
  return DRAW_PLAY_MODE_LOOP;
}

static uint8_t prv_parse_background(const char *token) {
  if (token && strcmp(token, "d") == 0) {
    return DRAW_BACKGROUND_DARK;
  }
  if (token && strcmp(token, "l") == 0) {
    return DRAW_BACKGROUND_LIGHT;
  }
  return DRAW_BACKGROUND_GRID;
}

static uint8_t prv_parse_step_kind(const char *token) {
  if (token && strcmp(token, "r") == 0) {
    return DRAW_STEP_KIND_RECT;
  }
  if (token && strcmp(token, "t") == 0) {
    return DRAW_STEP_KIND_TEXT;
  }
  return DRAW_STEP_KIND_CIRCLE;
}

static uint8_t prv_parse_step_color(const char *token) {
  if (token && strcmp(token, "a") == 0) {
    return DRAW_COLOR_ACCENT;
  }
  if (token && strcmp(token, "b") == 0) {
    return DRAW_COLOR_ACCENT2;
  }
  if (token && strcmp(token, "d") == 0) {
    return DRAW_COLOR_DANGER;
  }
  return DRAW_COLOR_INK;
}

static uint32_t prv_get_draw_phase_ms(void) {
  if (s_draw_cycle_ms == 0) {
    return 0;
  }

  if (s_draw_play_mode == DRAW_PLAY_MODE_ONCE) {
    return s_draw_elapsed_ms > s_draw_cycle_ms ? s_draw_cycle_ms : s_draw_elapsed_ms;
  }

  if (s_draw_play_mode == DRAW_PLAY_MODE_PING_PONG) {
    uint32_t full_cycle = (uint32_t)s_draw_cycle_ms * 2;
    uint32_t phase = full_cycle > 0 ? (s_draw_elapsed_ms % full_cycle) : 0;
    return phase <= s_draw_cycle_ms ? phase : (full_cycle - phase);
  }

  return s_draw_elapsed_ms % s_draw_cycle_ms;
}

static int16_t prv_lerp_int16(int16_t start, int16_t end, uint16_t progress_bp) {
  return (int16_t)(start + (((int32_t)(end - start) * progress_bp) / 1000));
}

static uint16_t prv_lerp_uint16(uint16_t start, uint16_t end, uint16_t progress_bp) {
  return (uint16_t)(start + (((int32_t)(end - start) * progress_bp) / 1000));
}

static uint16_t prv_step_progress_bp(const DrawStep *step, uint32_t phase_ms) {
  if (!step) {
    return 0;
  }

  if (phase_ms <= step->delay_ms) {
    return 0;
  }

  uint32_t elapsed = phase_ms - step->delay_ms;
  if (elapsed >= step->duration_ms) {
    return 1000;
  }

  if (step->duration_ms == 0) {
    return 1000;
  }

  return (uint16_t)((elapsed * 1000) / step->duration_ms);
}

static bool prv_step_visible(const DrawStep *step, uint32_t phase_ms) {
  if (!step) {
    return false;
  }

  if (s_draw_play_mode == DRAW_PLAY_MODE_ONCE && s_draw_elapsed_ms > s_draw_cycle_ms &&
      phase_ms >= s_draw_cycle_ms) {
    return true;
  }

  return phase_ms >= step->delay_ms;
}

static GColor prv_get_background_color(void) {
#if defined(PBL_COLOR)
  if (s_draw_background == DRAW_BACKGROUND_LIGHT) {
    return GColorWhite;
  }
  if (s_draw_background == DRAW_BACKGROUND_DARK) {
    return GColorOxfordBlue;
  }
  return GColorBlack;
#else
  return s_draw_background == DRAW_BACKGROUND_LIGHT ? GColorWhite : GColorBlack;
#endif
}

static GColor prv_get_grid_color(void) {
#if defined(PBL_COLOR)
  if (s_draw_background == DRAW_BACKGROUND_LIGHT) {
    return GColorLightGray;
  }
  return GColorDarkGray;
#else
  return s_draw_background == DRAW_BACKGROUND_LIGHT ? GColorBlack : GColorWhite;
#endif
}

static GColor prv_get_step_color(uint8_t color_type) {
#if defined(PBL_COLOR)
  if (color_type == DRAW_COLOR_ACCENT) {
    return GColorMalachite;
  }
  if (color_type == DRAW_COLOR_ACCENT2) {
    return GColorRajah;
  }
  if (color_type == DRAW_COLOR_DANGER) {
    return GColorRed;
  }
  return s_draw_background == DRAW_BACKGROUND_LIGHT ? GColorBlack : GColorWhite;
#else
  return s_draw_background == DRAW_BACKGROUND_LIGHT ? GColorBlack : GColorWhite;
#endif
}

static void prv_draw_grid(GContext *ctx, GRect bounds) {
  graphics_context_set_stroke_color(ctx, prv_get_grid_color());
  for (int16_t x = 0; x < bounds.size.w; x += 12) {
    graphics_draw_line(ctx, GPoint(x, 0), GPoint(x, bounds.size.h));
  }
  for (int16_t y = 0; y < bounds.size.h; y += 12) {
    graphics_draw_line(ctx, GPoint(0, y), GPoint(bounds.size.w, y));
  }
}

static void prv_schedule_draw_timer(void);

static void prv_draw_timer_callback(void *context) {
  s_draw_timer = NULL;

  if (s_current_ui_type != UI_TYPE_DRAW || !s_draw_layer) {
    return;
  }

  s_draw_elapsed_ms += DRAW_TICK_MS;
  layer_mark_dirty(s_draw_layer);

  if (s_draw_play_mode == DRAW_PLAY_MODE_ONCE && s_draw_elapsed_ms >= s_draw_cycle_ms) {
    s_draw_elapsed_ms = s_draw_cycle_ms;
    return;
  }

  prv_schedule_draw_timer();
}

static void prv_schedule_draw_timer(void) {
  if (s_draw_timer || s_draw_step_count == 0 || s_current_ui_type != UI_TYPE_DRAW) {
    return;
  }

  s_draw_timer = app_timer_register(DRAW_TICK_MS, prv_draw_timer_callback, NULL);
}

void stewie_stop_draw_animation(void) {
  if (s_draw_timer) {
    app_timer_cancel(s_draw_timer);
    s_draw_timer = NULL;
  }
}

void stewie_reset_draw(void) {
  stewie_stop_draw_animation();
  memset(s_draw_steps, 0, sizeof(s_draw_steps));
  s_draw_step_count = 0;
  s_draw_play_mode = DRAW_PLAY_MODE_LOOP;
  s_draw_background = DRAW_BACKGROUND_GRID;
  s_draw_timeline_ms = 1600;
  s_draw_cycle_ms = 1600;
  s_draw_elapsed_ms = 0;
}

static void prv_parse_config_line(char tokens[DRAW_TOKEN_COUNT][DRAW_TOKEN_SIZE], uint8_t token_count) {
  if (token_count < 4 || strcmp(tokens[0], "cfg") != 0) {
    return;
  }

  s_draw_play_mode = prv_parse_play_mode(tokens[1]);
  s_draw_background = prv_parse_background(tokens[2]);
  s_draw_timeline_ms = prv_clamp_uint16(prv_parse_int(tokens[3], 1600), 240, 20000);
  s_draw_cycle_ms = s_draw_timeline_ms;
}

static void prv_parse_step_line(char tokens[DRAW_TOKEN_COUNT][DRAW_TOKEN_SIZE], uint8_t token_count) {
  if (token_count < 18 || strcmp(tokens[0], "s") != 0 || s_draw_step_count >= MAX_DRAW_STEPS) {
    return;
  }

  DrawStep *step = &s_draw_steps[s_draw_step_count];
  memset(step, 0, sizeof(DrawStep));

  stewie_copy_with_limit(step->id, sizeof(step->id), tokens[1], strlen(tokens[1]));
  stewie_copy_with_limit(step->label, sizeof(step->label), tokens[17], strlen(tokens[17]));
  if (step->label[0] == '\0') {
    stewie_copy_with_limit(step->label, sizeof(step->label), step->id, strlen(step->id));
  }

  step->kind = prv_parse_step_kind(tokens[2]);
  step->color = prv_parse_step_color(tokens[3]);
  step->fill = strcmp(tokens[4], "1") == 0;
  step->x = prv_clamp_int16(prv_parse_int(tokens[5], 0), 0, 144);
  step->y = prv_clamp_int16(prv_parse_int(tokens[6], 0), 0, 168);
  step->to_x = prv_clamp_int16(prv_parse_int(tokens[7], step->x), 0, 144);
  step->to_y = prv_clamp_int16(prv_parse_int(tokens[8], step->y), 0, 168);
  step->width = prv_clamp_int16(prv_parse_int(tokens[9], 24), 4, 96);
  step->height = prv_clamp_int16(prv_parse_int(tokens[10], 24), 4, 96);
  step->delay_ms = prv_clamp_uint16(prv_parse_int(tokens[11], 0), 0, 20000);
  step->duration_ms = prv_clamp_uint16(prv_parse_int(tokens[12], 720), 120, 20000);
  step->from_scale_pct = prv_clamp_uint16(prv_parse_int(tokens[13], 75), 10, 400);
  step->to_scale_pct = prv_clamp_uint16(prv_parse_int(tokens[14], 100), 10, 400);
  step->from_opacity_pct = prv_clamp_uint8(prv_parse_int(tokens[15], 30), 0, 100);
  step->to_opacity_pct = prv_clamp_uint8(prv_parse_int(tokens[16], 100), 0, 100);

  uint16_t step_end = step->delay_ms + step->duration_ms;
  if (step_end > s_draw_cycle_ms) {
    s_draw_cycle_ms = step_end;
  }

  s_draw_step_count++;
}

void stewie_parse_drawing(const char *encoded_drawing, size_t encoded_drawing_len) {
  stewie_reset_draw();

  if (!encoded_drawing || encoded_drawing_len == 0) {
    return;
  }

  if (encoded_drawing[encoded_drawing_len - 1] == '\0') {
    encoded_drawing_len -= 1;
    if (encoded_drawing_len == 0) {
      return;
    }
  }

  const char *cursor = encoded_drawing;
  const char *drawing_end = encoded_drawing + encoded_drawing_len;
  while (cursor < drawing_end) {
    const char *line_end = memchr(cursor, '\n', (size_t)(drawing_end - cursor));
    if (!line_end) {
      line_end = drawing_end;
    }

    size_t line_len = (size_t)(line_end - cursor);
    if (line_len > 0) {
      char tokens[DRAW_TOKEN_COUNT][DRAW_TOKEN_SIZE];
      memset(tokens, 0, sizeof(tokens));
      uint8_t token_count = prv_tokenize_line(cursor, line_len, tokens);
      if (token_count > 0 && strcmp(tokens[0], "cfg") == 0) {
        prv_parse_config_line(tokens, token_count);
      } else if (token_count > 0 && strcmp(tokens[0], "s") == 0) {
        prv_parse_step_line(tokens, token_count);
      }
    }

    if (line_end >= drawing_end) {
      break;
    }
    cursor = line_end + 1;
  }
}

void stewie_draw_update_proc(Layer *layer, GContext *ctx) {
  if (!layer) {
    return;
  }

  GRect bounds = layer_get_bounds(layer);
  graphics_context_set_fill_color(ctx, prv_get_background_color());
  graphics_fill_rect(ctx, bounds, 0, GCornerNone);

  if (s_draw_background == DRAW_BACKGROUND_GRID) {
    prv_draw_grid(ctx, bounds);
  }

  uint32_t phase_ms = prv_get_draw_phase_ms();

  for (uint8_t i = 0; i < s_draw_step_count; i++) {
    DrawStep *step = &s_draw_steps[i];
    if (!prv_step_visible(step, phase_ms)) {
      continue;
    }

    uint16_t progress_bp = prv_step_progress_bp(step, phase_ms);
    uint16_t scale_pct = prv_lerp_uint16(step->from_scale_pct, step->to_scale_pct, progress_bp);
    uint8_t opacity_pct = (uint8_t)prv_lerp_uint16(step->from_opacity_pct, step->to_opacity_pct, progress_bp);
    if (opacity_pct < 15) {
      continue;
    }

    int16_t x = prv_lerp_int16(step->x, step->to_x, progress_bp);
    int16_t y = prv_lerp_int16(step->y, step->to_y, progress_bp);
    int16_t width = (int16_t)((step->width * scale_pct) / 100);
    int16_t height = (int16_t)((step->height * scale_pct) / 100);
    if (width < 4) {
      width = 4;
    }
    if (height < 4) {
      height = 4;
    }

    GColor step_color = prv_get_step_color(step->color);
    graphics_context_set_stroke_color(ctx, step_color);
    graphics_context_set_fill_color(ctx, step_color);
    graphics_context_set_text_color(ctx, step_color);

    if (step->kind == DRAW_STEP_KIND_RECT) {
      GRect rect = GRect(x, y, width, height);
      if (step->fill) {
        graphics_fill_rect(ctx, rect, 3, GCornerNone);
      } else {
        graphics_draw_rect(ctx, rect);
      }
      continue;
    }

    if (step->kind == DRAW_STEP_KIND_TEXT) {
      const char *font_key = height >= 18 ? FONT_KEY_GOTHIC_18_BOLD : FONT_KEY_GOTHIC_14_BOLD;
      GFont font = fonts_get_system_font(font_key);
      GRect text_rect = GRect(x, y - 8, width + 40, height + 16);
      graphics_draw_text(ctx, step->label, font, text_rect, GTextOverflowModeTrailingEllipsis,
                         GTextAlignmentLeft, NULL);
      continue;
    }

    int16_t radius = width < height ? width / 2 : height / 2;
    if (radius < 2) {
      radius = 2;
    }
    GPoint center = GPoint(x + (width / 2), y + (height / 2));
    if (step->fill) {
      graphics_fill_circle(ctx, center, radius);
    } else {
      graphics_draw_circle(ctx, center, radius);
    }
  }
}

void stewie_show_draw(void) {
  if (!s_draw_layer || !s_card_title_layer) {
    return;
  }

  window_set_click_config_provider(s_window, stewie_window_click_config_provider);
  s_current_ui_type = UI_TYPE_DRAW;
  s_draw_elapsed_ms = 0;

  if (s_menu_layer) {
    layer_set_hidden(menu_layer_get_layer(s_menu_layer), true);
  }
  if (s_menu_body_layer) {
    layer_set_hidden(text_layer_get_layer(s_menu_body_layer), true);
  }
  if (s_card_body_layer) {
    layer_set_hidden(text_layer_get_layer(s_card_body_layer), true);
  }
  if (s_scroll_layer) {
    layer_set_hidden(scroll_layer_get_layer(s_scroll_layer), true);
  }
  if (s_action_bar_layer) {
    layer_set_hidden(action_bar_layer_get_layer(s_action_bar_layer), true);
  }
  if (s_menu_action_hint_layer) {
    layer_set_hidden(s_menu_action_hint_layer, true);
  }

  text_layer_set_text(s_card_title_layer, s_card_title);
  layer_set_frame(text_layer_get_layer(s_card_title_layer), GRect(6, 0, s_window_bounds.size.w - 12, 28));
  layer_set_hidden(text_layer_get_layer(s_card_title_layer), false);

  layer_set_frame(s_draw_layer, GRect(0, 28, s_window_bounds.size.w, s_window_bounds.size.h - 28));
  layer_set_hidden(s_draw_layer, false);
  layer_mark_dirty(s_draw_layer);

  if (s_draw_step_count > 0) {
    prv_schedule_draw_timer();
  }
}
