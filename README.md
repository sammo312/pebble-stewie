# pebble-stewie (SDUI)

Pebble app prototype where the watch is a renderer and the phone side is the brain.

The phone sends a compact UI schema to the watch.
The watch renders that schema and sends user actions back.

## Loop

1. Phone sends a screen (`menu` or `card`).
2. Watch renders it.
3. User presses buttons.
4. Watch sends an action (`ready`, `select`, `back`).
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

### Watch -> Phone (`msgType = 2`)

- `actionType`: `1` ready, `2` select, `3` back
- `actionScreenId`: current rendered screen ID
- `actionItemId`: selected item ID (for select)
- `actionIndex`: selected row index (for select)

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

## Current Demo Graph

Defined in `src/pkjs/index.js`:

- `root` menu
- `controls` menu
- `status-card`, `about-card`, `start-card`, `stop-card`, `diag-card`
- `time-card` is generated dynamically from phone time

## Notes and Troubleshooting

- Repeated `Render sent: root` on startup is expected with current startup handling.
- `[PHONESIM] Exception decoding QemuInboundPacket.footer` is emulator/tooling noise.
- `WebSocketConnectionClosedException` at the end of logs is usually the CLI log stream disconnecting, not an app crash.
- Real app crashes show an `App fault!` line in logs.

## Extending

- Add screens and transitions in `staticScreens` in `src/pkjs/index.js`.
- Keep payloads compact to fit AppMessage limits.
- If you add new keys, update `pebble.messageKeys` in `package.json` and rebuild.
