#!/usr/bin/env node

// Unsupported legacy backend. This path still targets the older turn-schema
// contract and is intentionally quarantined from the supported runtime surface.

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT || 8787);
const OPENAI_API_KEY_FILE = process.env.OPENAI_API_KEY_FILE || '~/.config/openai/key';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const BACKEND_TOKEN = process.env.BACKEND_TOKEN || '';
const MAX_BODY_BYTES = 64 * 1024;
const MAX_HISTORY_TURNS = 10;
const OPENAI_LOG_MAX_CHARS = Number(process.env.OPENAI_LOG_MAX_CHARS || 2000);
const OPENAI_DEBUG_LOG = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.OPENAI_DEBUG_LOG || '').trim().toLowerCase()
);
const VALID_ACTION_SLOTS = new Set(['up', 'select', 'down']);
const VALID_ACTION_ICONS = new Set(['play', 'pause', 'check', 'x', 'plus', 'minus']);

const sessions = new Map();

const SYSTEM_PROMPT = [
  'You are an SDUI turn engine for a Pebble watch app.',
  'Respond with exactly one JSON object and no markdown.',
  'JSON schema:',
  '{',
  '  "schemaVersion": "pebble.sdui.v1",',
  '  "screen": {',
  '    "type": "menu" | "card",',
  '    "title": "short title",',
  '    "body": "short body",',
  '    "actions": [',
  '      { "slot": "select", "id": "confirm", "icon": "check", "label": "Confirm", "value": "confirm" }',
  '    ],',
  '    "options": [',
  '      { "id": "yes", "label": "Yes", "value": "yes" }',
  '    ]',
  '  },',
  '  "input": {',
  '    "mode": "menu" | "voice" | "menu_or_voice",',
  '    "expectResponse": true | false',
  '  }',
  '}',
  'Constraints:',
  '- Keep title <= 24 chars.',
  '- Keep body <= 140 chars.',
  '- Use max 5 options with labels <= 18 chars.',
  '- actions are only for card screens; max 3 actions.',
  '- action slots must be unique and one of: up, select, down.',
  '- action icons must be one of: play, pause, check, x, plus, minus.',
  '- For yes/no, use option ids yes/no.',
  '- Use input.mode = menu_or_voice if user can answer by voice.',
  '- If no user response needed, return a card and input.expectResponse = false.'
].join('\n');

function expandHome(filePath) {
  if (!filePath) {
    return '';
  }
  if (filePath === '~') {
    return os.homedir();
  }
  if (filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

function resolveApiKey() {
  const envKey = (process.env.OPENAI_API_KEY || '').trim();
  if (envKey) {
    return envKey;
  }

  const keyFile = expandHome(OPENAI_API_KEY_FILE);
  if (!keyFile) {
    return '';
  }

  try {
    return fs.readFileSync(keyFile, 'utf8').trim();
  } catch (error) {
    return '';
  }
}

const OPENAI_API_KEY = resolveApiKey();

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  });
  res.end(body);
}

function sanitizeText(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function limitText(value, maxLen) {
  const text = sanitizeText(value);
  if (!text) {
    return '';
  }
  if (text.length <= maxLen) {
    return text;
  }
  return text.slice(0, Math.max(0, maxLen - 3)) + '...';
}

function clipForLog(value, maxLen = OPENAI_LOG_MAX_CHARS) {
  const text = sanitizeText(value);
  if (!text) {
    return '';
  }
  if (text.length <= maxLen) {
    return text;
  }
  return `${text.slice(0, maxLen)}...(truncated)`;
}

function messagesForLog(messages) {
  return (messages || []).map((message, index) => ({
    index,
    role: sanitizeText(message && message.role),
    content: clipForLog(message && message.content)
  }));
}

function debugLog(...args) {
  if (!OPENAI_DEBUG_LOG) {
    return;
  }
  console.log(...args);
}

function sanitizeOptionId(value, index) {
  const raw = sanitizeText(value).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  if (!raw) {
    return `option_${index}`;
  }
  return raw.slice(0, 22);
}

function sanitizeActionId(value, slot, index) {
  const base = sanitizeText(value).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const fallback = `${slot || 'action'}_${index}`;
  return (base || fallback).slice(0, 22);
}

function extractLooseText(rawTurn) {
  if (!rawTurn || typeof rawTurn !== 'object') {
    return '';
  }

  const candidates = [
    rawTurn.body,
    rawTurn.text,
    rawTurn.message,
    rawTurn.response,
    rawTurn.output_text,
    rawTurn.reply
  ];

  for (const candidate of candidates) {
    const text = sanitizeText(candidate);
    if (text) {
      return text;
    }
  }

  if (rawTurn.output && typeof rawTurn.output === 'string') {
    return sanitizeText(rawTurn.output);
  }

  return '';
}

function normalizeTurn(rawTurn) {
  if (!rawTurn || typeof rawTurn !== 'object') {
    return null;
  }

  const screen = rawTurn.screen || {};
  const input = rawTurn.input || {};

  let screenType = String(screen.type || rawTurn.type || 'card').toLowerCase();
  if (screenType !== 'menu' && screenType !== 'card') {
    screenType = 'card';
  }

  let mode = String(input.mode || 'menu').toLowerCase();
  if (mode !== 'menu' && mode !== 'voice' && mode !== 'menu_or_voice') {
    mode = 'menu';
  }

  const options = [];
  const seen = new Set();
  const sourceOptions = Array.isArray(screen.options)
    ? screen.options
    : (Array.isArray(rawTurn.options) ? rawTurn.options : []);
  for (let i = 0; i < sourceOptions.length && options.length < 5; i++) {
    const option = sourceOptions[i];
    if (!option || typeof option !== 'object') {
      continue;
    }

    let id = sanitizeOptionId(option.id, i + 1);
    if (seen.has(id)) {
      id = `${id}_${i + 1}`;
    }
    seen.add(id);

    const label = limitText(option.label || option.title || id, 18);
    if (!label) {
      continue;
    }

    options.push({
      id,
      label,
      value: sanitizeText(option.value || option.prompt || label)
    });
  }

  const actions = [];
  const actionIds = new Set();
  const actionSlots = new Set();
  const sourceActions = Array.isArray(screen.actions)
    ? screen.actions
    : (Array.isArray(rawTurn.actions) ? rawTurn.actions : []);
  for (let i = 0; i < sourceActions.length && actions.length < 3; i++) {
    const action = sourceActions[i];
    if (!action || typeof action !== 'object') {
      continue;
    }

    const slot = sanitizeText(action.slot || action.button).toLowerCase();
    if (!VALID_ACTION_SLOTS.has(slot) || actionSlots.has(slot)) {
      continue;
    }

    let id = sanitizeActionId(action.id, slot, i + 1);
    if (actionIds.has(id)) {
      id = sanitizeActionId(`${id}_${i + 1}`, slot, i + 1);
    }
    if (actionIds.has(id)) {
      continue;
    }

    const iconCandidate = sanitizeText(action.icon).toLowerCase();
    const icon = VALID_ACTION_ICONS.has(iconCandidate) ? iconCandidate : 'check';
    const label = limitText(action.label || action.title || id, 18);
    if (!label) {
      continue;
    }

    actionSlots.add(slot);
    actionIds.add(id);
    actions.push({
      slot,
      id,
      icon,
      label,
      value: sanitizeText(action.value || action.prompt || label)
    });
  }

  let expectResponse = Boolean(input.expectResponse);
  if (!Object.prototype.hasOwnProperty.call(input, 'expectResponse')) {
    expectResponse = options.length > 0 || actions.length > 0 || mode !== 'menu';
  }

  const looseBody = extractLooseText(rawTurn);
  const turn = {
    schemaVersion: 'pebble.sdui.v1',
    screen: {
      type: screenType,
      title: limitText(screen.title || rawTurn.title || 'Agent', 24),
      body: limitText(screen.body || rawTurn.body || looseBody || '', 140),
      options,
      actions: screenType === 'card' ? actions : []
    },
    input: {
      mode,
      expectResponse
    }
  };

  if (!turn.screen.body && turn.screen.type === 'card') {
    turn.screen.body = expectResponse ? 'Select or speak a response.' : 'Done.';
  }

  return turn;
}

async function readJsonBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on('data', chunk => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Request body too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(text));
      } catch (error) {
        reject(new Error('Invalid JSON body.'));
      }
    });

    req.on('error', reject);
  });
}

function getSession(conversationId) {
  const id = conversationId || randomUUID();
  if (!sessions.has(id)) {
    sessions.set(id, []);
  }
  return { id, history: sessions.get(id) };
}

function trimHistory(history) {
  const maxMessages = MAX_HISTORY_TURNS * 2;
  while (history.length > maxMessages) {
    history.shift();
  }
}

async function callOpenAI(messages) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set on the backend.');
  }

  const requestId = randomUUID().slice(0, 8);
  const requestBody = {
    model: OPENAI_MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages
  };

  if (OPENAI_DEBUG_LOG) {
    debugLog(`[openai:${requestId}] request payload`, JSON.stringify({
      model: requestBody.model,
      temperature: requestBody.temperature,
      response_format: requestBody.response_format,
      messages: messagesForLog(requestBody.messages)
    }, null, 2));
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  });

  const responseText = await response.text();
  debugLog(`[openai:${requestId}] response status=${response.status} ok=${response.ok}`);
  debugLog(`[openai:${requestId}] response body ${clipForLog(responseText, OPENAI_LOG_MAX_CHARS * 2)}`);

  if (!response.ok) {
    throw new Error(`OpenAI HTTP ${response.status}: ${responseText.slice(0, 300)}`);
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (error) {
    throw new Error(`OpenAI returned invalid JSON envelope: ${error.message}`);
  }
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';

  debugLog(`[openai:${requestId}] assistant content ${clipForLog(content, OPENAI_LOG_MAX_CHARS)}`);

  if (!content) {
    throw new Error('OpenAI returned an empty completion.');
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`OpenAI returned invalid JSON: ${error.message}`);
  }

  return { parsed, raw: content };
}

function buildUserPrompt(input) {
  const reason = sanitizeText(input.reason || 'user_input');
  const userInput = sanitizeText(input.input || '');
  const watch = input.watch && typeof input.watch === 'object' ? input.watch : {};
  const tzOffset = Number(input.tzOffset) || 0;

  return [
    `Turn reason: ${reason}`,
    `User input: ${userInput || '(empty)'}`,
    `Watch profile: ${JSON.stringify(watch)}`,
    `Timezone offset (mins): ${tzOffset}`
  ].join('\n');
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method !== 'POST' || req.url !== '/turn') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  if (BACKEND_TOKEN) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${BACKEND_TOKEN}`) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }
  }

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: error.message });
    return;
  }

  const session = getSession(sanitizeText(payload.conversationId));
  const userPrompt = buildUserPrompt(payload);

  const messages = [{ role: 'system', content: SYSTEM_PROMPT }]
    .concat(session.history)
    .concat([{ role: 'user', content: userPrompt }]);

  try {
    const result = await callOpenAI(messages);
    const turn = normalizeTurn(result.parsed) || {
      schemaVersion: 'pebble.sdui.v1',
      screen: {
        type: 'card',
        title: 'Agent',
        body: 'Model response did not match schema.',
        options: []
      },
      input: {
        mode: 'menu',
        expectResponse: false
      }
    };

    session.history.push({ role: 'user', content: userPrompt });
    session.history.push({ role: 'assistant', content: JSON.stringify(turn) });
    trimHistory(session.history);

    sendJson(res, 200, {
      conversationId: session.id,
      turn
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.warn('Warning: running unsupported legacy backend transport.');
  console.warn('This path is kept only as a reference and is not part of the supported runtime.');
  console.log(`Legacy OpenAI SDUI backend listening on http://0.0.0.0:${PORT}/turn`);
  if (OPENAI_DEBUG_LOG) {
    console.log(`OpenAI debug logging enabled (OPENAI_LOG_MAX_CHARS=${OPENAI_LOG_MAX_CHARS})`);
  }
  if (!OPENAI_API_KEY) {
    console.log('Warning: OPENAI_API_KEY is missing. Requests will fail until it is set.');
  }
});
