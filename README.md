# pebble-stewie (SDUI + Direct OpenAI)
<img width="300" height="300" alt="kawaistew" src="https://github.com/user-attachments/assets/d1275c0d-d4bb-41a9-9bb0-7a1b7b026958" />


Pebble app prototype where the watch is only a renderer.
Phone PKJS handles state, can call OpenAI directly, and sends compact UI schema to the watch.

## Loop

1. Phone sends screen (`menu` or `card`).
2. Watch renders it.
3. User clicks or dictates.
4. Watch sends action (`ready`, `select`, `back`, `voice`).
5. Phone calls OpenAI with user input + context.
6. OpenAI returns the next canonical screen graph.

## Architecture

- Watch entrypoint: [src/c/main.c](/Users/sam/dev/pebble/pebble-stewie/src/c/main.c)
- Watch runtime modules: [src/c/stewie](/Users/sam/dev/pebble/pebble-stewie/src/c/stewie)
- Phone brain: [src/pkjs/index.js](/Users/sam/dev/pebble/pebble-stewie/src/pkjs/index.js)
- Experimental legacy backend: [backend/legacy/openai-sdui-server.mjs](/Users/sam/dev/pebble/pebble-stewie/backend/legacy/openai-sdui-server.mjs)
- Message keys: [package.json](/Users/sam/dev/pebble/pebble-stewie/package.json)
- Screen authoring guide: [SCREEN_SCHEMA_GUIDE.md](/Users/sam/dev/pebble/pebble-stewie/docs/SCREEN_SCHEMA_GUIDE.md)
- SDUI import/export spec: [docs/SDUI_SCHEMA_SPEC.md](/Users/sam/dev/pebble/pebble-stewie/docs/SDUI_SCHEMA_SPEC.md)
- Pebble design-language notes: [docs/PEBBLE_DESIGN_LANGUAGE.md](/Users/sam/dev/pebble/pebble-stewie/docs/PEBBLE_DESIGN_LANGUAGE.md)
- UI support roadmap: [docs/UI_SUPPORT_PLAN.md](/Users/sam/dev/pebble/pebble-stewie/docs/UI_SUPPORT_PLAN.md)
- Shared schema contract: [packages/sdui-contract](/Users/sam/dev/pebble/pebble-stewie/packages/sdui-contract)
- Web builder scaffold: [apps/screen-builder-web](/Users/sam/dev/pebble/pebble-stewie/apps/screen-builder-web)

## Monorepo Layout

- `packages/sdui-contract`: canonical constants, normalizers, and builder element descriptors
- `src/pkjs/*.js`: thin wrappers importing shared contract modules
- `apps/screen-builder-web`: builder workspace that consumes the same contract package

Builder quick run:

```bash
pnpm install
pnpm --filter screen-builder-web dev
```

Legacy graph imports are supported, but the builder always normalizes and exports the latest canonical schema.

## Message Protocol

### Phone -> Watch (`msgType = 1`)

- `uiType`: `1` menu, `2` card
- `screenId`: stable ID
- `title`: title
- `items`: newline-delimited `id|label` for menu
- `body`: card body for card
- `actions`: newline-delimited `slot|id|icon` for card action bar (`up|select|down`)

### Watch -> Phone (`msgType = 2`)

- `actionType`: `1` ready, `2` select, `3` back, `4` voice transcript
- `actionScreenId`: current screen ID
- `actionItemId`: selected item ID
- `actionIndex`: selected row index
- `actionText`: transcript for voice action

## Direct OpenAI Contract

PKJS sends a `POST https://api.openai.com/v1/responses` request with your configured key:

```json
{
  "schemaVersion": "pebble.sdui.v1.2.0",
  "model": "gpt-4.1-mini",
  "input": "...system prompt plus watch context and user input..."
}
```

The runtime then extracts the first JSON object from the model response and normalizes it into the canonical Pebble graph schema.

## Experimental Legacy Backend

`backend/legacy/openai-sdui-server.mjs` is kept only as an unsupported legacy reference. It still targets the older turn-schema/backend transport and is not part of the supported production runtime path.

If you want to revive a backend-mediated transport later, do it behind an explicit transport switch rather than relying on stale settings keys.

Legacy backend response shape:

```json
{
  "conversationId": "thread-id",
  "graph": {
    "schemaVersion": "pebble.sdui.v1",
    "entryScreenId": "root",
    "screens": {
      "root": {
        "id": "root",
        "type": "card",
        "title": "Question",
        "body": "Choose one action",
        "actions": [
          { "slot": "select", "id": "confirm", "icon": "check", "label": "Confirm", "value": "confirm" }
        ]
      }
    }
  }
}
```

## Legacy Backend Run (unsupported)

```bash
# default key file used automatically: ~/.config/openai/key
export OPENAI_MODEL="gpt-4.1-mini"   # optional
export PORT=8787                       # optional
node backend/legacy/openai-sdui-server.mjs
```

Optional explicit key file path:

```bash
export OPENAI_API_KEY_FILE="$HOME/.config/openai/key"
node backend/legacy/openai-sdui-server.mjs
```

Optional direct key via env var (overrides key file):

```bash
export OPENAI_API_KEY="YOUR_KEY"
node backend/legacy/openai-sdui-server.mjs
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

## Build + Install

```bash
pebble clean
pebble build
pebble install --phone <PHONE_IP> --logs
```

## App Settings (Import + OpenAI Key)

- Settings are in the Pebble/Rebble **phone app**, not on the watch UI.
- Path: `My Pebble` -> `Watchapps` -> `pebble-stewie` -> `Settings`.
- If `Settings` is missing, reinstall the app after this manifest change (`"capabilities": ["configurable"]` in `package.json`).

## Notes

- Agent mode uses the canonical graph schema + your OpenAI key/model from app settings.
- Canonical graph authoring/export now targets `pebble.sdui.v1.2.0`; older imports are migrated on load.
- Voice input still works through watch dictation (`actionType = 4`).

## Future Schema Strategy

- The runtime now supports schema-defined `run` actions for user-triggered effects and `bindings` for native/live values such as `device.time`.
- Built-in screens, imported graphs, and agent responses now target the same graph schema.
- Next step is expanding schema coverage to more Pebble UI primitives, including first-class input screens, in a stable, versioned contract.
- Keep normalization strict in backend/PKJS so unsupported fields degrade safely instead of crashing render paths.
