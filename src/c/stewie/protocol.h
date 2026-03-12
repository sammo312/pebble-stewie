#pragma once

#include <pebble.h>

void stewie_send_action(uint8_t action_type, int32_t item_index, const char *item_id,
                        const char *action_text);
void stewie_start_dictation(void);
