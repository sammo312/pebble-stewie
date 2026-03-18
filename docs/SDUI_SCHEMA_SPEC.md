# Pebble Stewie Canonical Schema (`pebble.sdui.v1.2.0`)

This is the current canonical contract shared by the watch runtime, PKJS runtime, builder, and tests.

Older `pebble.sdui.v1` and `pebble.sdui.v1.1.0` graphs are accepted on import and normalized forward to `pebble.sdui.v1.2.0`.

## Top-level graph

```json
{
  "schemaVersion": "pebble.sdui.v1.2.0",
  "storageNamespace": "optional_graph_store",
  "entryScreenId": "root",
  "screens": {
    "root": {
      "id": "root",
      "type": "menu",
      "title": "Main Menu",
      "items": []
    }
  }
}
```

## Top-level fields

- `schemaVersion`
  - required
  - canonical output must be `pebble.sdui.v1.2.0`
- `entryScreenId`
  - required
  - must resolve to a screen in `screens`
- `screens`
  - required
  - object keyed by screen id
- `storageNamespace`
  - optional
  - used for persisted phone-side graph storage
  - sanitized to the runtime id format

## Shared screen fields

Every screen normalizes to:

- `id`
- `type`
- `title`
- `body`
- optional `titleTemplate`
- optional `bodyTemplate`
- optional `bindings`
- `input`
- optional `onEnter`
- optional `onExit`
- optional `timer`

### `screen.id`

- sanitized to `[a-z0-9_-]`
- max 31 chars in the shared contract

### `screen.type`

Current screen types:

- `menu`
- `card`
- `scroll`
- `draw`

Normalization is permissive today: unsupported screen types fall back to the schema default, which is `menu`.

### `screen.title`

- required
- max 30 chars

### `screen.body`

- max 180 chars for `menu`, `card`, and `draw`
- max 1024 chars for `scroll`

Defaults:

- empty `card` with no actions becomes `Done.`
- empty `scroll` becomes `No content.`
- empty `draw` becomes `Animated drawing`

### `titleTemplate` / `bodyTemplate`

Templates resolve at render time. Available sources:

- `{{var.key}}`
- `{{storage.key}}`
- `{{timer.remaining}}`
- binding aliases from `screen.bindings`

### `bindings`

Bindings create local aliases for runtime values.

Currently supported binding sources:

- `device.time`
- `storage.<key>`

Example:

```json
{
  "bindings": {
    "time": {
      "source": "device.time",
      "live": true,
      "refreshMs": 30000
    },
    "best": {
      "source": "storage.high_score",
      "live": false
    }
  }
}
```

### `input`

Normalized shape:

```json
{ "mode": "menu" }
```

Allowed values:

- `menu`
- `voice`
- `menu_or_voice`

Current runtime behavior:

- voice affordances are injected for menu screens
- non-menu screens still normalize this field, but the current watch UI only uses it for menu interaction paths

### `onEnter` / `onExit`

Optional arrays of hook runs. Hook runs only keep local-safe types:

- `navigate`
- `set_var`
- `store`
- `effect`

Each screen supports up to 6 hook runs per hook list.

### `timer`

Optional one-shot delayed run:

```json
{
  "durationMs": 5000,
  "run": { "type": "navigate", "screen": "next" }
}
```

- minimum `durationMs`: 100
- maximum `durationMs`: 86400000

## Screen-specific fields

### `menu`

Uses `items`.

```json
{
  "id": "root",
  "type": "menu",
  "title": "Main Menu",
  "items": [
    {
      "id": "status",
      "label": "Status",
      "run": { "type": "navigate", "screen": "status" }
    }
  ]
}
```

#### Menu item fields

- `id`
- `label`
- optional `labelTemplate`
- optional `value`
- optional `run`

Limits:

- max items: 8
- max label length: 20
- max id length: 22

### `card`

Uses `actions`.

```json
{
  "id": "status",
  "type": "card",
  "title": "Status",
  "body": "All systems nominal.",
  "actions": [
    {
      "slot": "select",
      "id": "home",
      "icon": "check",
      "label": "Home",
      "run": { "type": "navigate", "screen": "root" }
    }
  ]
}
```

#### Card action fields

- `slot`
- `id`
- `icon`
- optional `label`
- optional `labelTemplate`
- optional `value`
- optional `run`

Rules:

- `slot` must be `up`, `select`, or `down`
- slots must be unique per card
- max actions: 3
- invalid icons fall back to `check`

Supported icons:

- `play`
- `pause`
- `check`
- `x`
- `plus`
- `minus`

### `scroll`

Uses long `body` text plus optional Select drawer actions.

```json
{
  "id": "notes",
  "type": "scroll",
  "title": "Notes",
  "body": "Long text...",
  "actions": [
    {
      "id": "done",
      "label": "Done",
      "run": { "type": "navigate", "screen": "root" }
    }
  ]
}
```

#### Scroll action fields

- `id`
- `label`
- optional `labelTemplate`
- optional `value`
- optional `run`

Rules:

- max actions: 6
- Select opens an `ActionMenu` when actions exist

### `draw`

Uses custom animation data rendered by the watch draw engine.

Two authoring paths are supported:

1. `motion` with optional `canvas`
2. raw `drawing`

If `motion` is present, the shared compiler emits normalized `drawing` data automatically.

#### `canvas`

Current templates:

- `freeform`
- `header_list`

`header_list` also supports:

- `header`
- up to 4 `items`

#### `motion`

Normalized shape:

```json
{
  "version": 1,
  "playMode": "ping_pong",
  "background": "grid",
  "timelineMs": 1800,
  "tracks": []
}
```

Track fields:

- `id`
- `label`
- `target`
- `kind`
- `preset`
- `placement`
- `color`
- `fill`
- `speed`
- `intensity`
- `delayMs`
- `staggerMs`

Enums:

- `preset`: `fade`, `slide_up`, `slide_left`, `pulse`, `hover`, `blink`, `orbit`
- `placement`: `top`, `middle`, `bottom`
- `kind`: `circle`, `rect`, `text`
- `color`: `ink`, `accent`, `accent2`, `danger`
- `speed`: `fast`, `normal`, `slow`
- `intensity`: `low`, `medium`, `high`
- `playMode`: `loop`, `once`, `ping_pong`
- `background`: `grid`, `dark`, `light`

#### `drawing`

Raw draw payload fields:

- `playMode`
- `background`
- `timelineMs`
- `steps`

Each step contains:

- `id`
- `label`
- `kind`
- `color`
- `fill`
- `x`, `y`, `toX`, `toY`
- `width`, `height`
- `delayMs`, `durationMs`
- `fromScale`, `toScale`
- `fromOpacity`, `toOpacity`

Max draw steps: 6

## `run` object

Current run types:

- `navigate`
- `set_var`
- `store`
- `agent_prompt`
- `agent_command`
- `effect`
- `dictation`

Runs may also include optional native effects:

- `vibe`: `short`, `long`, `double`
- `light`: `true`

### `navigate`

```json
{
  "type": "navigate",
  "screen": "next",
  "condition": { "var": "count", "op": "gte", "value": "2" }
}
```

`condition.op` may be:

- `eq`
- `neq`
- `gt`
- `gte`
- `lt`
- `lte`

### `set_var`

```json
{
  "type": "set_var",
  "key": "count",
  "value": "increment"
}
```

Supported value forms:

- `increment`
- `decrement`
- `toggle`
- `true`
- `false`
- numeric strings
- `literal:<text>`

### `store`

```json
{
  "type": "store",
  "key": "best_score",
  "value": "{{var.count}}"
}
```

Stored values are resolved through the template engine, then persisted as strings in phone storage for the current graph namespace.

### `agent_prompt`

```json
{
  "type": "agent_prompt",
  "prompt": "Summarize today"
}
```

### `agent_command`

Current commands used by the runtime:

- `reset`
- `more_replies`

### `effect`

```json
{
  "type": "effect",
  "vibe": "short",
  "light": true
}
```

### `dictation`

```json
{
  "type": "dictation",
  "variable": "transcript",
  "screen": "optional_screen_after_capture",
  "then": {
    "type": "agent_prompt",
    "prompt": "{{var.transcript}}"
  }
}
```

Fields:

- `variable`: required session variable key
- `screen`: optional follow-up screen id
- `then`: optional nested run executed after the transcript is stored

## Limits summary

- title: 30
- body: 180
- scroll body: 1024
- menu items: 8
- card actions: 3
- scroll drawer actions: 6
- hooks per list: 6
- draw steps / motion tracks: 6
- action id: 22
- screen id: 31
