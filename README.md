# pebble-stewie (SDUI)

Pebble app prototype where the watch is a renderer and the phone side is the brain.

The phone sends a compact UI schema to the watch.
The watch renders that schema and sends user actions back.

## Loop

1. Phone sends a screen (`menu` or `card`).
2. Watch renders it.
3. User presses buttons.
4. Watch sends an action (`ready`, `select`, `back`, `voice`).
5. Phone computes next state and sends the next screen.

## Architecture

- Watch renderer: [src/c/pebble-stewie.c](/Users/sam/dev/pebble/pebble-stewie/src/c/pebble-stewie.c)
- Phone brain/state machine: [src/pkjs/index.js](/Users/sam/dev/pebble/pebble-stewie/src/pkjs/index.js)
- AppMessage keys: [package.json](/Users/sam/dev/pebble/pebble-stewie/package.json)

The watch only handles rendering and button events.
Navigation/state logic lives in `pkjs`.

## Message Protocol

All messages use Pebble `AppMessage`.

### Phone -> Watch (`msgType = 1`)

- `uiType`: `1` menu, `2` card
- `screenId`: stable ID for current screen
- `title`: screen title
- `items`: menu rows encoded as newline-delimited `id|label` (menu only)
- `body`: card text (card only)
- `actions`: card action buttons encoded as newline-delimited `slot|id|icon` (card only)
  - `slot`: `up`, `select`, or `down`
  - `icon`: `play`, `pause`, `check`, `x`, `plus`, `minus`

### Watch -> Phone (`msgType = 2`)

- `actionType`: `1` ready, `2` select, `3` back, `4` voice transcript
- `actionScreenId`: current rendered screen ID
- `actionItemId`: selected item ID (menu row ID or card action ID for select)
- `actionIndex`: selected row index (menu select only)
- `actionText`: voice transcript (for `actionType = 4`)

## Local Run

```bash
pebble clean
pebble build
pebble install --emulator basalt --logs
```

## Emulator Controls

- `up`/`down`: move menu selection
- `select`: submit selected menu row to phone brain
- `back`: send back action to phone brain
- On cards with actions: `up`/`select`/`down` trigger configured action IDs

## Current Demo Graph

Defined in `src/pkjs/index.js`:

- `root` menu
- `controls` menu
- `agent-home` (Bobby SDUI entry points)
- `status-card`, `about-card`, `start-card`, `stop-card`, `diag-card`
- `time-card` is generated dynamically from phone time

## Bobby Agent Mode (Turn Schema)

This project includes a Bobby-compatible SDUI turn loop in `pkjs`:

- Sends each user turn to Bobby over websocket (`/query` protocol).
- Instructs Bobby to return strict JSON only.
- Parses Bobby response into SDUI menu/card.
- Renders menu options on watch and sends selected option back as next turn input.
- Supports watch dictation with reserved menu item id `__voice__`.

Expected response shape:

```json
{
  "schemaVersion": "pebble.sdui.v1",
  "screen": {
    "type": "menu",
    "title": "Question",
    "body": "Do you want this?",
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
```

Card-only action buttons example:

```json
{
  "screen": {
    "type": "card",
    "title": "Confirm",
    "body": "Start task now?",
    "actions": [
      { "slot": "select", "id": "start", "icon": "play" },
      { "slot": "down", "id": "cancel", "icon": "x" }
    ]
  }
}
```

### Required config (in phone JS localStorage)

- `bobby-token`: optional override token.
  - real-device default is your Rebble token from `Pebble.getTimelineToken()` (fallback: `Pebble.getAccountToken()`)
  - this is **not** a Gemini/OpenAI API key
- `bobby-query-url`: optional override for query websocket URL.
  - default: `wss://bobby-api.rebble.io/query`

Without a usable token, the agent mode will render a setup error card.

## Notes and Troubleshooting

- Repeated `Render sent: root` on startup is expected with current startup handling.
- `[PHONESIM] Exception decoding QemuInboundPacket.footer` is emulator/tooling noise.
- `WebSocketConnectionClosedException` at the end of logs is usually the CLI log stream disconnecting, not an app crash.
- Real app crashes show an `App fault!` line in logs.
- If you see `get user info failed` on device:
  1. Open the Rebble mobile app and re-login.
  2. Confirm your Rebble subscription is active.
  3. Retry from `Agent SDUI` (the app now clears stale token and retries once automatically).

## Extending

- Add screens and transitions in `staticScreens` in `src/pkjs/index.js`.
- Keep payloads compact to fit AppMessage limits.
- If you add new keys, update `pebble.messageKeys` in `package.json` and rebuild.
