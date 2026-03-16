# Motion Authoring Plan

## Goal

Keep the existing native draw engine and payload format, but stop making humans author raw draw steps directly.

The builder should expose motion intent:

- what animates
- when it animates
- how strong it feels
- how fast it moves

Historical reference: [PEBBLE_DESIGN_LANGUAGE.md](/Users/sam/dev/pebble/pebble-stewie/docs/PEBBLE_DESIGN_LANGUAGE.md). Pebble's native motion language grouped transitions by meaning:

- `stretch` for movement within a space
- `dot` for jumps between system areas or interrupting events
- `morph` for transitions between similar states

The authoring model here should preserve that semantic bias instead of starting from arbitrary low-level effects.

The compiler should convert that intent into the existing low-level `drawing.steps` model that the watch already knows how to render.

## Current Problem

The current authoring surface is too close to the runtime format.

Today the user edits:

- `x`, `y`
- `toX`, `toY`
- `width`, `height`
- `delayMs`, `durationMs`
- `fromScale`, `toScale`
- `fromOpacity`, `toOpacity`
- `kind`, `color`, `fill`

That is visible in:

- [draw-animation-inspector.jsx](/Users/sam/dev/pebble/pebble-stewie/apps/screen-builder-web/app/components/inspector/draw-animation-inspector.jsx)
- [draw-utils.js](/Users/sam/dev/pebble/pebble-stewie/apps/screen-builder-web/app/lib/draw-utils.js)
- [draw-codec.js](/Users/sam/dev/pebble/pebble-stewie/packages/sdui-contract/src/draw-codec.js)
- [draw.c](/Users/sam/dev/pebble/pebble-stewie/src/c/stewie/draw.c)

That format is fine for runtime. It is a bad primary authoring model.

## Design Principles

1. The builder should expose presets and semantic controls first.
2. Raw step editing should remain available, but only in an advanced mode.
3. The native runtime should stay simple and continue consuming compiled `drawing.steps`.
4. The same schema should support fast builder preview and native watch rendering.
5. Existing saved graphs must continue loading.

## Product Model

Split animation into two layers.

### 1. Authoring model

This is what the builder edits.

Example:

```json
{
  "motion": {
    "version": 1,
    "tracks": [
      {
        "id": "title_enter",
        "target": "title",
        "phase": "entrance",
        "preset": "slide_up",
        "speed": "normal",
        "intensity": "medium",
        "delayMs": 0,
        "repeat": "once"
      },
      {
        "id": "badge_idle",
        "target": "badge",
        "phase": "idle",
        "preset": "pulse",
        "speed": "slow",
        "intensity": "low",
        "delayMs": 200,
        "repeat": "loop"
      }
    ]
  }
}
```

### 2. Runtime model

This is what the watch uses.

```json
{
  "drawing": {
    "playMode": "loop",
    "background": "grid",
    "timelineMs": 1800,
    "steps": [ ... ]
  }
}
```

The runtime model stays close to the current implementation.

## First Supported Motion Concepts

Limit the first authoring pass to a small set of presets.

### Presets

- `fade`
- `slide_up`
- `slide_left`
- `pulse`
- `hover`
- `blink`
- `orbit`

### Phases

- `entrance`
- `idle`
- `feedback`
- `background`

### Speeds

- `fast`
- `normal`
- `slow`

### Intensity

- `low`
- `medium`
- `high`

### Repeat

- `once`
- `loop`
- `ping_pong`

## Scope by Screen Type

### Menu / Card / Scroll

These should eventually gain a `Motion` section for semantic animations on normal UI content.

Examples:

- title slides up on entrance
- body fades in
- action hint pulses on idle

This should not require a custom draw screen.

### Draw

`draw` should become an advanced `Canvas Screen`.

It is still useful, but it should be framed as:

- custom watch-canvas motion
- advanced composition
- optional raw-step editing

Not as the default path for basic animation needs.

## Schema Changes

### New authoring field

Add a new optional screen field:

```json
{
  "motion": {
    "version": 1,
    "tracks": []
  }
}
```

This belongs in:

- [packages/sdui-contract/src/versions/v1.js](/Users/sam/dev/pebble/pebble-stewie/packages/sdui-contract/src/versions/v1.js)
- [packages/sdui-contract/src/graph-schema.js](/Users/sam/dev/pebble/pebble-stewie/packages/sdui-contract/src/graph-schema.js)

### Keep `drawing`

Do not remove `drawing`.

For now:

- `motion` is the authoring source when present
- `drawing` is the compiled/renderable source

This keeps the native runtime unchanged.

### Compatibility rule

If an old graph has `drawing` but no `motion`:

- load it successfully
- mark it as `advanced/custom`
- allow editing in raw mode

## Compiler Layer

Add a builder/shared compiler that turns semantic motion into draw steps.

### Proposed file

- `packages/sdui-contract/src/motion-compiler.js`

### Responsibilities

- validate motion tracks
- choose preset generator
- expand semantic values into raw coordinates and timing
- emit `drawing.playMode`
- emit `drawing.timelineMs`
- emit `drawing.steps`

### Proposed API

```js
compileMotionToDrawing(screen, options)
```

Return shape:

```js
{
  drawing,
  warnings,
  mode
}
```

Where `mode` is one of:

- `compiled`
- `advanced_raw`
- `legacy_raw`

## Preset Generators

Each preset should compile through a small generator module.

### Proposed structure

- `packages/sdui-contract/src/motion-presets/fade.js`
- `packages/sdui-contract/src/motion-presets/slide-up.js`
- `packages/sdui-contract/src/motion-presets/slide-left.js`
- `packages/sdui-contract/src/motion-presets/pulse.js`
- `packages/sdui-contract/src/motion-presets/hover.js`
- `packages/sdui-contract/src/motion-presets/blink.js`
- `packages/sdui-contract/src/motion-presets/orbit.js`

Each generator should accept a semantic track and return one or more raw draw steps.

## Builder UX Changes

### Replace "Motion Steps" as the default

The default draw inspector should become:

1. Preview
2. Motion tracks
3. Stage settings
4. Advanced raw steps

### Motion track editor

Each track should expose:

- target
- phase
- preset
- speed
- intensity
- delay
- repeat

Optional advanced-per-track controls:

- color
- label
- text content for `text` targets

### Advanced mode

Raw step editing should move behind a collapsed section:

- `Advanced Raw Steps`

If the screen was loaded from legacy raw drawing only, that section opens automatically and shows a notice:

- `This animation was authored in raw mode. Semantic presets are unavailable until it is rebuilt.`

### Create flow

When the user adds a draw screen, the default should be:

- one preset-based demo track
- one clean stage
- no empty low-level step list

The current raw multi-step seed in [draw-utils.js](/Users/sam/dev/pebble/pebble-stewie/apps/screen-builder-web/app/lib/draw-utils.js) should be replaced with a preset-oriented starter.

## Preview Rules

The builder preview should always render from compiled `drawing`, not from a separate preview-only model.

That means:

1. user edits `motion`
2. builder compiles to `drawing`
3. preview renders compiled `drawing`
4. native runtime receives compiled `drawing`

This keeps preview and native behavior aligned.

## Migration Strategy

### Existing raw draw screens

If a screen has:

- `type: "draw"`
- `drawing.steps`
- no `motion`

Then:

- preserve it exactly
- classify it as `advanced_raw`
- do not auto-convert it on load

### Optional future conversion

Later we can add:

- `Convert to Preset Motion`

But that should be explicit, not automatic, because some raw compositions will not map cleanly back to presets.

## Concrete File Changes

### Phase 1: Schema + compiler foundation

Add or update:

- [packages/sdui-contract/src/versions/v1.js](/Users/sam/dev/pebble/pebble-stewie/packages/sdui-contract/src/versions/v1.js)
- [packages/sdui-contract/src/graph-schema.js](/Users/sam/dev/pebble/pebble-stewie/packages/sdui-contract/src/graph-schema.js)
- `packages/sdui-contract/src/motion-compiler.js`
- `packages/sdui-contract/src/motion-presets/*`
- [packages/sdui-contract/src/index.js](/Users/sam/dev/pebble/pebble-stewie/packages/sdui-contract/src/index.js)

Deliverables:

- `motion` schema
- normalized `motion`
- compiler to `drawing`
- tests for preset compilation

### Phase 2: Builder authoring UI

Add or update:

- [apps/screen-builder-web/app/components/inspector/draw-animation-inspector.jsx](/Users/sam/dev/pebble/pebble-stewie/apps/screen-builder-web/app/components/inspector/draw-animation-inspector.jsx)
- [apps/screen-builder-web/app/components/draw-animation-preview.jsx](/Users/sam/dev/pebble/pebble-stewie/apps/screen-builder-web/app/components/draw-animation-preview.jsx)
- [apps/screen-builder-web/app/lib/draw-utils.js](/Users/sam/dev/pebble/pebble-stewie/apps/screen-builder-web/app/lib/draw-utils.js)
- [apps/screen-builder-web/app/hooks/use-graph-editor.js](/Users/sam/dev/pebble/pebble-stewie/apps/screen-builder-web/app/hooks/use-graph-editor.js)

Deliverables:

- semantic motion track UI
- advanced raw mode collapse
- preset-based default draw screen
- builder preview driven by compiled `drawing`

### Phase 3: Normal screen motion

Extend:

- `menu`
- `card`
- `scroll`

Deliverables:

- `Motion` section on normal screens
- compiler mapping from normal UI targets to draw-backed or native-friendly motion
- limited preset set for screen-level animation

### Phase 4: Migration and polish

Deliverables:

- raw-mode notice
- optional conversion helpers
- docs
- better empty states and templates

## Validation and Tests

Add tests for:

- valid `motion` normalization
- preset compilation into bounded draw steps
- legacy raw draw screens staying unchanged
- preview using compiled `drawing`
- editor switching between semantic mode and advanced raw mode safely

Likely locations:

- contract tests beside [graph-schema.js](/Users/sam/dev/pebble/pebble-stewie/packages/sdui-contract/src/graph-schema.js)
- builder tests beside the draw inspector and draw preview components

## Recommended First Cut

Do not try to solve all animation authoring at once.

The first practical cut should be:

1. add `motion`
2. add 4 presets:
   - `fade`
   - `slide_up`
   - `pulse`
   - `hover`
3. support only:
   - `phase`
   - `preset`
   - `speed`
   - `intensity`
   - `delayMs`
   - `repeat`
4. keep raw steps behind `Advanced`
5. keep native runtime unchanged

That is enough to make the feature feel authored instead of engineered.
