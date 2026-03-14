#pragma once

#include <pebble.h>

void stewie_layout_menu_layers(void);
void stewie_show_menu(void);
void stewie_show_card(void);
void stewie_show_scroll(void);
void stewie_parse_menu_items(const char *encoded_items);
void stewie_menu_action_hint_update_proc(Layer *layer, GContext *ctx);

uint16_t stewie_menu_get_num_sections_callback(MenuLayer *menu_layer, void *context);
uint16_t stewie_menu_get_num_rows_callback(MenuLayer *menu_layer, uint16_t section_index, void *context);
int16_t stewie_menu_get_header_height_callback(MenuLayer *menu_layer, uint16_t section_index, void *context);
void stewie_menu_draw_header_callback(GContext *ctx, const Layer *cell_layer, uint16_t section_index,
                                      void *context);
void stewie_menu_draw_row_callback(GContext *ctx, const Layer *cell_layer, MenuIndex *cell_index,
                                   void *context);
