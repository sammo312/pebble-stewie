# pebble-stewie (SDUI + OpenAI Backend)

Pebble app prototype where the watch is only a renderer.
Phone PKJS handles state, calls a backend, and sends compact UI schema to the watch.

## Loop

1. Phone sends screen (`menu` or `card`).
2. Watch renders it.
3. User clicks or dictates.
4. Watch sends action (`ready`, `select`, `back`, `voice`).
5. Phone calls backend with user input + context.
6. Backend returns next SDUI turn.

## Architecture

- Watch renderer: [src/c/pebble-stewie.c](/Users/sam/dev/pebble/pebble-stewie/src/c/pebble-stewie.c)
- Phone brain: [src/pkjs/index.js](/Users/sam/dev/pebble/pebble-stewie/src/pkjs/index.js)
- OpenAI backend: [backend/openai-sdui-server.mjs](/Users/sam/dev/pebble/pebble-stewie/backend/openai-sdui-server.mjs)
- Message keys: [package.json](/Users/sam/dev/pebble/pebble-stewie/package.json)

## Message Protocol

### Phone -> Watch (`msgType = 1`)

- `uiType`: `1` menu, `2` card
- `screenId`: stable ID
- `title`: title
- `items`: newline-delimited `id|label` for menu
- `body`: card body for card

### Watch -> Phone (`msgType = 2`)

- `actionType`: `1` ready, `2` select, `3` back, `4` voice transcript
- `actionScreenId`: current screen ID
- `actionItemId`: selected item ID
- `actionIndex`: selected row index
- `actionText`: transcript for voice action

## Backend Contract

`POST /turn` request:

```json
{
  "schemaVersion": "pebble.sdui.v1",
  "conversationId": "optional-thread-id",
  "reason": "preset_prompt|menu_option|voice_transcript|...",
  "input": "user input text",
  "tzOffset": -360,
  "watch": {
    "platform": "basalt",
    "supportsColour": true,
    "screenWidth": 144,
    "screenHeight": 168
  }
}
```

Response:

```json
{
  "conversationId": "thread-id",
  "turn": {
    "schemaVersion": "pebble.sdui.v1",
    "screen": {
      "type": "menu",
      "title": "Question",
      "body": "Choose one",
      "options": [
        { "id": "yes", "label": "Yes", "value": "yes" },
        { "id": "no", "label": "No", "value": "no" }
      ]
    },
    "input": {
      "mode": "menu_or_voice",
      "expectResponse": true
    }
  }
}
```

## Run Backend

```bash
# default key file used automatically: ~/.config/openai/key
export OPENAI_MODEL="gpt-4.1-mini"   # optional
export PORT=8787                       # optional
node backend/openai-sdui-server.mjs
```

Optional explicit key file path:

```bash
export OPENAI_API_KEY_FILE="$HOME/.config/openai/key"
node backend/openai-sdui-server.mjs
```

Optional direct key via env var (overrides key file):

```bash
export OPENAI_API_KEY="YOUR_KEY"
node backend/openai-sdui-server.mjs
```

Optional backend auth token:

```bash
export BACKEND_TOKEN="some-shared-secret"
```

Optional verbose OpenAI wire logs (off by default):

```bash
export OPENAI_DEBUG_LOG=1
export OPENAI_LOG_MAX_CHARS=2000   # optional truncation limit
```

Then set in PKJS localStorage:

- `openai-backend-url`: your backend URL, e.g. `http://192.168.12.10:8787/turn`
- `openai-backend-token`: optional, must match `BACKEND_TOKEN`

## Build + Install

```bash
pebble clean
pebble build
pebble install --phone <PHONE_IP> --logs
```

## Notes

- Agent mode now depends only on your configured backend URL.
- Voice input still works through watch dictation (`actionType = 4`).
