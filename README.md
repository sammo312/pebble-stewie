# pebble-stewie

Pebble watch app prototype where the watch mostly renders a canonical SDUI graph and the phone runtime owns graph state, storage, bindings, and optional OpenAI calls.

## Current capabilities

- Canonical schema: `pebble.sdui.v1.2.0`
- Screen types: `menu`, `card`, `scroll`, `draw`
- Run types: `navigate`, `set_var`, `store`, `agent_prompt`, `agent_command`, `effect`, `dictation`
- Runtime features: `onEnter`, `onExit`, screen timers, template rendering, live bindings, phone-side storage namespaces
- Shared contract package consumed by PKJS, the web builder, and tests

## Docs

- [Documentation index](docs/README.md)
- [Screen guide](docs/SCREEN_SCHEMA_GUIDE.md)
- [Canonical schema spec](docs/SDUI_SCHEMA_SPEC.md)
- [Pebble UI mapping](docs/PEBBLE_UI_ELEMENTS.md)
- [Design language notes](docs/PEBBLE_DESIGN_LANGUAGE.md)

## Monorepo layout

- `src/c`: Pebble watch runtime
- `src/pkjs`: phone runtime, transport, configuration, and OpenAI integration
- `packages/sdui-contract`: shared schema, normalizers, run helpers, motion compiler
- `apps/screen-builder-web`: Next.js builder and emulator-backed preview workspace
- `apps/pebble-qemu-wasm-main`: standalone browser QEMU/WASM emulator project

## Quick start

Install workspace dependencies:

```bash
pnpm install
```

Run the shared test suite:

```bash
pnpm test
```

Run the full validation set:

```bash
pnpm run check
pnpm run check:builder
pnpm run check:ci
```

Run the builder:

```bash
pnpm --filter screen-builder-web dev
```

Build and install the Pebble app:

```bash
pebble clean
pebble build
pebble install --phone <PHONE_IP> --logs
```

## Architecture

- Watch entrypoint: `src/c/main.c`
- Watch runtime modules: `src/c/stewie/`
- Phone runtime entrypoint: `src/pkjs/index.js`
- Shared schema/runtime package: `packages/sdui-contract/`
- Legacy backend reference: `backend/legacy/openai-sdui-server.mjs`

## App configuration

Pebble/Rebble phone app path:

`My Pebble -> Watchapps -> pebble-stewie -> Settings`

Settings currently support:

- `Schema JSON`: imported canonical graph JSON
- `OpenAI API Key`: optional Responses API key
- `OpenAI Model`: optional override of the default model

Imported graphs are normalized before activation. Invalid JSON renders an import error card instead of crashing the runtime.

## Direct OpenAI flow

If an OpenAI key is configured, PKJS can call `POST https://api.openai.com/v1/responses` and ask the model to return exactly one canonical graph object. The default model in this repo is `gpt-4.1-mini`.

The request body is the current Responses API shape, not a custom schema wrapper:

```json
{
  "model": "gpt-4.1-mini",
  "instructions": "...canonical graph system prompt...",
  "input": "Runtime context:\n{\"schemaVersion\":\"pebble.sdui.v1.2.0\",...}",
  "previous_response_id": "resp_..."
}
```

The supported runtime path is:

1. User acts on the watch.
2. PKJS resolves any local run behavior first.
3. If the action targets the agent, PKJS builds watch/runtime context.
4. OpenAI returns a canonical graph.
5. PKJS normalizes it to `pebble.sdui.v1.2.0` and sends the next screen to the watch.

## Wire protocol

### Phone -> Watch (`msgType = 1`)

- `uiType`: `1` menu, `2` card, `3` scroll, `4` draw, `5` voice
- `screenId`, `title`, `body`
- `items`: newline-delimited menu rows
- `actions`: newline-delimited card actions or scroll select-drawer actions
- `drawing`: encoded draw payload for `draw`
- `effectVibe`, `effectLight`: one-shot native effects applied on render

### Watch -> Phone (`msgType = 2`)

- `actionType`: `1` ready, `2` select, `3` back, `4` voice transcript
- `actionScreenId`: current screen id
- `actionItemId`: selected row or action id
- `actionIndex`: selected row index
- `actionText`: dictation transcript

## Legacy backend

`backend/legacy/openai-sdui-server.mjs` is kept as an unsupported reference for the older backend-mediated flow. The supported runtime path in this repo is the direct PKJS/OpenAI transport.
