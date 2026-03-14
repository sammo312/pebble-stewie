# Pebble UI Support Plan

Implementation plan for expanding `pebble.sdui.v1` beyond current `menu`/`card` support.

Reference doc: [PEBBLE_UI_ELEMENTS.md](/Users/sam/dev/pebble/pebble-stewie/docs/PEBBLE_UI_ELEMENTS.md)

## Goals

- Keep one canonical schema contract shared by:
  - Watch runtime (C)
  - Phone runtime (PKJS)
  - Web builder
- Add high-value UI features in low-risk increments.
- Avoid silent schema degradation (unknown types quietly becoming cards).

## Scope and ordering

1. Contract hardening + docs alignment
2. Run effects (`run.vibe`, `run.light`)
3. `scroll` screen type
4. `number_input` screen type
5. `image` support via precompiled resources
6. `action_menu` (deferred backlog)

## Phase 0: Contract Hardening

### Decisions to lock first

- [ ] Unknown `screen.type` handling:
  - Recommended: reject with validation error instead of coercing to `card`.
- [ ] Status bar behavior:
  - Recommended: update docs to "not explicitly mounted today" unless implemented.
- [ ] Long body limit strategy:
  - Keep current transport-safe limit until chunking protocol exists.

### File checklist

- [ ] [packages/sdui-contract/src/graph-schema.js](/Users/sam/dev/pebble/pebble-stewie/packages/sdui-contract/src/graph-schema.js)
  - Stop silently coercing unknown `screen.type` to `card`.
  - Return `null` (validation failure) for unknown types.
- [ ] [docs/PEBBLE_UI_ELEMENTS.md](/Users/sam/dev/pebble/pebble-stewie/docs/PEBBLE_UI_ELEMENTS.md)
  - Align "StatusBarLayer" section with actual implementation state.
  - Clarify body-length constraints are transport/runtime bound.
- [ ] [docs/SDUI_SCHEMA_SPEC.md](/Users/sam/dev/pebble/pebble-stewie/docs/SDUI_SCHEMA_SPEC.md)
  - Add explicit unknown type behavior and validation expectations.
- [ ] [apps/screen-builder-web/app/page.js](/Users/sam/dev/pebble/pebble-stewie/apps/screen-builder-web/app/page.js)
  - Surface contract validation failures clearly in import/export panel.

## Phase 1: Run Effects (`vibe`, `light`)

### Schema contract

- [ ] [packages/sdui-contract/src/graph-schema.js](/Users/sam/dev/pebble/pebble-stewie/packages/sdui-contract/src/graph-schema.js)
  - Extend `normalizeRun()` to support optional:
    - `vibe`: `none|short|long|double`
    - `light`: boolean
- [ ] [packages/sdui-contract/src/builder-elements.js](/Users/sam/dev/pebble/pebble-stewie/packages/sdui-contract/src/builder-elements.js)
  - Add run-effect fields to item/action builder definitions.

### Wire protocol

- [ ] [package.json](/Users/sam/dev/pebble/pebble-stewie/package.json)
  - Add new message keys:
    - `effectVibe`
    - `effectLight`
- [ ] [packages/sdui-contract/src/constants.js](/Users/sam/dev/pebble/pebble-stewie/packages/sdui-contract/src/constants.js)
  - Add shared constants/enums for effect values.

### PKJS runtime

- [ ] [src/pkjs/index.js](/Users/sam/dev/pebble/pebble-stewie/src/pkjs/index.js)
  - Capture pending effects from executed `run`.
  - Attach `effectVibe/effectLight` to next render payload.
  - Clear effect fields after one render.

### Watch runtime

- [ ] [src/c/main.c](/Users/sam/dev/pebble/pebble-stewie/src/c/main.c)
  - Parse optional effect fields in incoming render message.
  - Trigger `vibes_*` and `light_enable_interaction()` accordingly.
- [ ] [src/c/stewie/state.h](/Users/sam/dev/pebble/pebble-stewie/src/c/stewie/state.h)
  - Add effect enums/constants as needed.

### Validation

- [ ] `pebble build`
- [ ] Manual test: menu item with `run.vibe=double`
- [ ] Manual test: card action with `run.light=true`

## Phase 2: `scroll` Screen Type

### Schema contract

- [ ] [packages/sdui-contract/src/graph-schema.js](/Users/sam/dev/pebble/pebble-stewie/packages/sdui-contract/src/graph-schema.js)
  - Add `screen.type = "scroll"` support.
  - Add conservative `body` limit for first release (no chunking).
- [ ] [packages/sdui-contract/src/builder-elements.js](/Users/sam/dev/pebble/pebble-stewie/packages/sdui-contract/src/builder-elements.js)
  - Include `scroll` in `SCREEN_TYPES`.
  - Define scroll-specific editable fields if needed.

### Wire protocol

- [ ] [packages/sdui-contract/src/constants.js](/Users/sam/dev/pebble/pebble-stewie/packages/sdui-contract/src/constants.js)
  - Add `UI_TYPE_SCROLL`.
- [ ] [package.json](/Users/sam/dev/pebble/pebble-stewie/package.json)
  - Add message key for any additional scroll payload fields if introduced.

### PKJS runtime

- [ ] [src/pkjs/index.js](/Users/sam/dev/pebble/pebble-stewie/src/pkjs/index.js)
  - Map `screen.type=scroll` to `uiType=UI_TYPE_SCROLL`.
  - Send scroll body/title payload.

### Watch runtime

- [ ] [src/c/stewie/state.h](/Users/sam/dev/pebble/pebble-stewie/src/c/stewie/state.h)
  - Add `UI_TYPE_SCROLL`.
  - Add buffers/state for scroll content.
- [ ] [src/c/main.c](/Users/sam/dev/pebble/pebble-stewie/src/c/main.c)
  - Parse and route `UI_TYPE_SCROLL`.
- [ ] [src/c/stewie/ui.c](/Users/sam/dev/pebble/pebble-stewie/src/c/stewie/ui.c)
  - Create/show scroll UI mode.
- [ ] [src/c/stewie/input.c](/Users/sam/dev/pebble/pebble-stewie/src/c/stewie/input.c)
  - Route UP/DOWN/SELECT/BACK correctly when scroll is active.

### Validation

- [ ] `pebble build`
- [ ] Manual test: long text scroll with button paging

## Phase 3: `number_input` Screen Type

### Schema contract

- [ ] [packages/sdui-contract/src/graph-schema.js](/Users/sam/dev/pebble/pebble-stewie/packages/sdui-contract/src/graph-schema.js)
  - Add `number_input` screen fields:
    - `label`, `min`, `max`, `step`, `value`
  - Validate ranges and defaults.
- [ ] [packages/sdui-contract/src/builder-elements.js](/Users/sam/dev/pebble/pebble-stewie/packages/sdui-contract/src/builder-elements.js)
  - Add number-input field descriptors.

### Wire protocol

- [ ] [package.json](/Users/sam/dev/pebble/pebble-stewie/package.json)
  - Add message keys for numeric config and selected value, e.g.:
    - `numLabel`, `numMin`, `numMax`, `numStep`, `numValue`, `actionValue`

### Watch runtime

- [ ] [src/c/main.c](/Users/sam/dev/pebble/pebble-stewie/src/c/main.c)
  - Parse `UI_TYPE_NUMBER_INPUT`.
  - Open/configure Pebble `NumberWindow`.
- [ ] [src/c/stewie/protocol.c](/Users/sam/dev/pebble/pebble-stewie/src/c/stewie/protocol.c)
  - Send confirmed numeric result via new key.
- [ ] [src/c/stewie/state.h](/Users/sam/dev/pebble/pebble-stewie/src/c/stewie/state.h)
  - Add constants/state for number input mode.

### PKJS runtime

- [ ] [src/pkjs/index.js](/Users/sam/dev/pebble/pebble-stewie/src/pkjs/index.js)
  - Emit number-input render payload.
  - Read numeric confirmation (`actionValue`) in action handler.
  - Feed value into `run` or agent prompt path.

### Validation

- [ ] `pebble build`
- [ ] Manual test: min/max/step behavior and value roundtrip

## Phase 4: `image` Support (Resource-Based)

### Schema contract

- [ ] [packages/sdui-contract/src/graph-schema.js](/Users/sam/dev/pebble/pebble-stewie/packages/sdui-contract/src/graph-schema.js)
  - Add optional `image.resource` and `image.alignment`.
- [ ] [packages/sdui-contract/src/builder-elements.js](/Users/sam/dev/pebble/pebble-stewie/packages/sdui-contract/src/builder-elements.js)
  - Add image field descriptors and resource enum source.

### Resources + watch rendering

- [ ] [package.json](/Users/sam/dev/pebble/pebble-stewie/package.json)
  - Register additional bitmap resources.
- [ ] [src/c/main.c](/Users/sam/dev/pebble/pebble-stewie/src/c/main.c)
  - Parse image payload fields.
- [ ] [src/c/stewie/ui.c](/Users/sam/dev/pebble/pebble-stewie/src/c/stewie/ui.c)
  - Mount and render `BitmapLayer` in card/image mode.

### Validation

- [ ] `pebble build`
- [ ] Manual test: valid resource, invalid fallback behavior

## Backlog: `action_menu`

- [ ] Decide if incremental UX value exceeds added complexity over existing `menu`.
- [ ] If yes, start with single-level `action_menu` only (no nested hierarchy).

## Cross-cutting checks per phase

- [ ] Update [docs/SCREEN_SCHEMA_GUIDE.md](/Users/sam/dev/pebble/pebble-stewie/docs/SCREEN_SCHEMA_GUIDE.md) examples.
- [ ] Update [docs/SDUI_SCHEMA_SPEC.md](/Users/sam/dev/pebble/pebble-stewie/docs/SDUI_SCHEMA_SPEC.md) with new canonical fields.
- [ ] Update [apps/screen-builder-web/app/page.js](/Users/sam/dev/pebble/pebble-stewie/apps/screen-builder-web/app/page.js) UI controls for new schema pieces.
- [ ] Keep old schemas backward-compatible where feasible.

## Definition of done for each new element

- [ ] Contract validation supports the new shape.
- [ ] Builder can author + import/export it.
- [ ] PKJS can transport + execute it.
- [ ] Watch C runtime renders/handles it.
- [ ] One manual end-to-end scenario documented and verified.
