#include "protocol.h"

#include "state.h"

#if defined(PBL_MICROPHONE)
static void prv_dictation_result_handler(DictationSession *session, DictationSessionStatus status,
                                         char *transcription, void *context) {
  if (status == DictationSessionStatusSuccess && transcription && transcription[0] != '\0') {
    char clipped[96];
    stewie_copy_with_limit(clipped, sizeof(clipped), transcription, strlen(transcription));
    stewie_send_action(ACTION_TYPE_VOICE, -1, VOICE_INPUT_ITEM_ID, clipped);
    return;
  }

  stewie_send_action(ACTION_TYPE_VOICE, -1, VOICE_ERROR_ITEM_ID, NULL);
}
#endif

void stewie_start_dictation(void) {
#if defined(PBL_MICROPHONE)
  if (!s_dictation_session) {
    s_dictation_session =
        dictation_session_create(DICTATION_BUFFER_SIZE, prv_dictation_result_handler, NULL);
  }
  if (!s_dictation_session) {
    APP_LOG(APP_LOG_LEVEL_ERROR, "Failed to create dictation session");
    stewie_send_action(ACTION_TYPE_VOICE, -1, VOICE_ERROR_ITEM_ID, NULL);
    return;
  }
  dictation_session_start(s_dictation_session);
#else
  stewie_send_action(ACTION_TYPE_VOICE, -1, VOICE_NOT_SUPPORTED_ITEM_ID, NULL);
#endif
}

void stewie_send_action(uint8_t action_type, int32_t item_index, const char *item_id,
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
