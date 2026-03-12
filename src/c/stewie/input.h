#pragma once

#include <pebble.h>

void stewie_reset_card_actions(void);
void stewie_parse_card_actions(const char *encoded_actions);
void stewie_apply_card_actions(void);

void stewie_select_click_handler(ClickRecognizerRef recognizer, void *context);
void stewie_up_click_handler(ClickRecognizerRef recognizer, void *context);
void stewie_down_click_handler(ClickRecognizerRef recognizer, void *context);
void stewie_back_click_handler(ClickRecognizerRef recognizer, void *context);
void stewie_window_click_config_provider(void *context);
void stewie_action_bar_click_config_provider(void *context);
