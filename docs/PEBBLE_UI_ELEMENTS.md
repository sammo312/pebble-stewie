# Pebble UI Elements in SDUI

How the current `pebble.sdui.v1.2.0` contract maps onto the watch runtime in this repo.

Reference: [Pebble C SDK User Interface](https://developer.rebble.io/docs/c/User_Interface/)

## Currently supported

### MenuLayer (`screen.type: "menu"`)

Flat selectable list rendered with Pebble `MenuLayer`.

```json
{
  "id": "root",
  "type": "menu",
  "title": "Pick one",
  "body": "Optional text above the list",
  "items": [
    { "id": "opt-a", "label": "Option A", "run": { "type": "navigate", "screen": "a" } },
    { "id": "opt-b", "label": "Option B", "value": "b" }
  ]
}
```

Runtime notes:

- `title` renders as the menu header
- `body` renders in a text block above the list
- `items[].label` renders as the row title
- `input.mode` controls whether PKJS injects a voice row

Limits:

- title: 30 chars
- body: 180 chars
- row label: 20 chars
- items: 8

### TextLayer (`card` and `scroll` text)

The runtime uses `TextLayer` for card titles, card bodies, and scroll titles/bodies.

```json
{
  "id": "info",
  "type": "card",
  "title": "Status",
  "body": "Everything looks good."
}
```

Runtime notes:

- card title/body are separate `TextLayer` instances
- scroll screens reuse a title `TextLayer` above the scroll region
- templates are resolved on the phone before text reaches the watch

### ActionBarLayer (`card.actions`)

Three hardware button slots on the right side of a card.

```json
{
  "id": "confirm",
  "type": "card",
  "title": "Confirm?",
  "body": "Apply this change?",
  "actions": [
    { "slot": "up", "id": "cancel", "icon": "x", "label": "Cancel", "run": { "type": "navigate", "screen": "cancelled" } },
    { "slot": "select", "id": "ok", "icon": "check", "label": "OK", "run": { "type": "navigate", "screen": "done" } },
    { "slot": "down", "id": "skip", "icon": "minus", "label": "Skip", "value": "skip" }
  ]
}
```

Runtime notes:

- exactly one action per slot: `up`, `select`, `down`
- labels are phone/runtime metadata; the watch shows only the icon
- the action bar is hidden if there are no card actions

Supported icons:

- `play`
- `pause`
- `check`
- `x`
- `plus`
- `minus`

### ScrollLayer (`screen.type: "scroll"`)

Long-form text view rendered inside Pebble `ScrollLayer`.

```json
{
  "id": "notes",
  "type": "scroll",
  "title": "Notes",
  "body": "Longer text that needs vertical scrolling...",
  "actions": [
    { "id": "done", "label": "Done", "run": { "type": "navigate", "screen": "root" } }
  ]
}
```

Runtime notes:

- UP and DOWN scroll the body text
- the title stays above the scroll region
- if `actions` exist, Select opens an `ActionMenu`
- the small dot hint is the current watch affordance for that Select drawer

Limits:

- body: 1024 chars
- select-drawer actions: 6

### ActionMenu (`scroll.actions`)

`scroll.actions` do not use the card action bar. They map to a Pebble `ActionMenu` that opens from Select.

Each action contains:

- `id`
- `label`
- optional `value`
- optional `run`

### Custom draw layer (`screen.type: "draw"`)

Animated screens are rendered by the custom draw engine in `src/c/stewie/draw.c`.

```json
{
  "id": "splash",
  "type": "draw",
  "title": "Loading",
  "drawing": {
    "playMode": "loop",
    "background": "grid",
    "timelineMs": 1600,
    "steps": [
      {
        "id": "pulse",
        "kind": "circle",
        "label": "Pulse",
        "x": 18,
        "y": 28,
        "toX": 78,
        "toY": 52,
        "width": 26,
        "height": 26,
        "delayMs": 0,
        "durationMs": 900,
        "fromScale": 0.75,
        "toScale": 1.05,
        "fromOpacity": 0.2,
        "toOpacity": 1,
        "fill": false,
        "color": "accent"
      }
    ]
  }
}
```

Runtime notes:

- `motion` plus optional `canvas` is the higher-level authoring path
- the shared contract compiler produces raw `drawing.steps`
- the watch runtime ultimately consumes the encoded `drawing` payload

### Native effects (`run.vibe`, `run.light`)

These are not screen types, but they are first-class watch affordances already supported by the schema and transport.

- `vibe`: `short`, `long`, `double`
- `light`: trigger backlight interaction

Effects are carried in the next render payload and applied once on the watch.

## Not directly modeled today

These Pebble SDK surfaces are not first-class schema types in the current runtime:

- `BitmapLayer`
- `NumberWindow`
- wakeups and background workers
- broader device/sensor services beyond current bindings

See [SDUI_GAP_ANALYSIS.md](SDUI_GAP_ANALYSIS.md) for the current platform gap list.
