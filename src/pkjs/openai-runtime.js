'use strict';

var textUtils = require('./text-utils');

var sanitizeText = textUtils.sanitizeText;

function buildSystemPrompt(latestSchemaVersion) {
  return [
    'You are a canonical graph engine for a Pebble watch app.',
    'Respond with exactly one JSON object and no markdown.',
    'Schema:',
    '{',
    '  "schemaVersion": "' + latestSchemaVersion + '",',
    '  "storageNamespace": "optional_persist_id",',
    '  "entryScreenId": "root",',
    '  "screens": {',
    '    "root": {',
    '      "id": "root",',
    '      "type": "menu" | "card" | "scroll" | "draw",',
    '      "title": "short title",',
    '      "body": "short body",',
    '      "bodyTemplate": "optional {{binding.path}}",',
    '      "titleTemplate": "optional {{var.key}} or {{binding.path}}",',
    '      "bindings": {',
    '        "time": { "source": "device.time", "live": true, "refreshMs": 30000 }',
    '      },',
    '      "input": {',
    '        "mode": "menu" | "voice" | "menu_or_voice"',
    '      },',
    '      "items": [',
    '        { "id": "yes", "label": "Yes", "value": "yes" }',
    '      ],',
    '      "actions": [',
    '        { "slot": "select", "id": "confirm", "icon": "check", "label": "Confirm", "value": "confirm" }',
    '      ],',
    '      "onEnter": [{ "type": "effect", "vibe": "short" }],',
    '      "onExit": [{ "type": "set_var", "key": "seen", "value": "true" }],',
    '      "timer": { "durationMs": 5000, "run": { "type": "navigate", "screen": "next" } }',
    '    }',
    '  }',
    '}',
    'Constraints:',
    '- schemaVersion must be ' + latestSchemaVersion,
    '- always return entryScreenId and screens',
    '- title <= 24 chars, body <= 140 chars (scroll body <= 1024 chars)',
    '- items <= 8, item labels <= 18 chars',
    '- scroll screens may include optional select action-menu items, max 6',
    '- card actions are only for card screens, max 3',
    '- action slot in up/select/down, unique per action list',
    '- action icon in play/pause/check/x/plus/minus',
    '- use items for menu screens, never options',
    '- action-menu items do not need slot or icon',
    '- screens may include onEnter and onExit arrays of run actions',
    '- screens may include timer { durationMs, run } for one-shot delayed actions',
    '- use run for effects, not next/agentPrompt/agentCommand',
    '- run.type may be navigate, set_var, store, agent_prompt, agent_command, or effect',
    '- run.type set_var requires key and value; value supports increment, decrement, toggle, true/false, numbers, or literal:text',
    '- run.type store requires key and value; value may be plain text or templates like {{var.count}}',
    '- run.type navigate may include condition { var, op, value }',
    '- run can include optional vibe (short/long/double) and light (true) for effects',
    '- templates may reference {{var.name}} for session variables and {{storage.key}} for persisted strings',
    '- templates may reference {{timer.remaining}} for timer countdown seconds',
    '- use scroll type for long text content that needs vertical scrolling',
    '- draw screens require a drawing object with playMode, background, timelineMs, and 1-6 steps',
    '- return valid JSON only'
  ].join('\n');
}

function buildOpenAIContext(options) {
  var settings = options || {};
  var currentTime = settings.now instanceof Date ? settings.now : new Date();

  return {
    schemaVersion: settings.schemaVersion || '',
    conversationId: sanitizeText(settings.conversationId || ''),
    reason: sanitizeText(settings.reason || 'user_input'),
    input: sanitizeText(settings.userText || ''),
    tzOffset: -currentTime.getTimezoneOffset(),
    vars: settings.vars && typeof settings.vars === 'object' ? settings.vars : {},
    storage: settings.storage && typeof settings.storage === 'object' ? settings.storage : {},
    watch: settings.watch && typeof settings.watch === 'object' ? settings.watch : {}
  };
}

function buildOpenAIRequestBody(options) {
  var settings = options || {};
  var prompt = [
    'Runtime context:',
    JSON.stringify(settings.context || {}),
    '',
    'Return one JSON object that follows the schema in instructions.'
  ].join('\n');

  var body = {
    model: settings.model,
    instructions: settings.instructions || '',
    input: prompt
  };

  if (settings.previousResponseId) {
    body.previous_response_id = settings.previousResponseId;
  }

  return body;
}

function extractFirstJsonObject(text) {
  if (!text) {
    return '';
  }

  var start = text.indexOf('{');
  if (start < 0) {
    return '';
  }

  var depth = 0;
  var inString = false;
  var escaped = false;

  for (var i = start; i < text.length; i++) {
    var ch = text.charAt(i);

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      depth++;
      continue;
    }

    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.substring(start, i + 1);
      }
    }
  }

  return '';
}

function extractOpenAIOutputText(response) {
  if (!response || typeof response !== 'object') {
    return '';
  }

  if (typeof response.output_text === 'string' && response.output_text) {
    return response.output_text;
  }

  if (Array.isArray(response.output)) {
    for (var i = 0; i < response.output.length; i++) {
      var item = response.output[i];
      if (!item || !Array.isArray(item.content)) {
        continue;
      }
      for (var j = 0; j < item.content.length; j++) {
        var chunk = item.content[j];
        if (!chunk) {
          continue;
        }
        if (typeof chunk.text === 'string' && chunk.text) {
          return chunk.text;
        }
      }
    }
  }

  if (response.message && typeof response.message === 'string') {
    return response.message;
  }

  return '';
}

function postJson(requestFactory, url, token, body, onDone) {
  var xhr = requestFactory();
  var done = false;

  function finish(error, value) {
    if (done) {
      return;
    }
    done = true;
    onDone(error, value);
  }

  xhr.open('POST', url, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  if (token) {
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
  }
  xhr.timeout = 25000;

  xhr.onload = function() {
    if (xhr.status < 200 || xhr.status >= 300) {
      finish('HTTP ' + xhr.status + ': ' + (xhr.responseText || '').substring(0, 120), null);
      return;
    }

    var parsed;
    try {
      parsed = JSON.parse(xhr.responseText || '{}');
    } catch (error) {
      var textBody = sanitizeText(xhr.responseText || '');
      if (textBody) {
        finish(null, { message: textBody });
        return;
      }

      finish('Response returned invalid JSON: ' + error.message, null);
      return;
    }

    finish(null, parsed);
  };

  xhr.onerror = function() {
    finish('Network request failed.', null);
  };

  xhr.ontimeout = function() {
    finish('Request timed out.', null);
  };

  xhr.send(JSON.stringify(body));
  return xhr;
}

module.exports = {
  buildSystemPrompt: buildSystemPrompt,
  buildOpenAIContext: buildOpenAIContext,
  buildOpenAIRequestBody: buildOpenAIRequestBody,
  extractFirstJsonObject: extractFirstJsonObject,
  extractOpenAIOutputText: extractOpenAIOutputText,
  postJson: postJson
};
