# Pebble Stewie Canonical Schema (`pebble.sdui.v1`)

This is the canonical schema for Pebble Stewie.

Everything should use this shape:

- built-in static screens
- imported JSON from app settings
- agent responses

There is no separate turn schema anymore.

## Canonical graph format

```json
{
  "schemaVersion": "pebble.sdui.v1",
  "entryScreenId": "root",
  "screens": {
    "root": {
      "id": "root",
      "type": "menu",
      "title": "Main Menu",
      "items": [
        {
          "id": "status",
          "label": "Status",
          "run": { "type": "navigate", "screen": "status-card" }
        }
      ]
    },
    "status-card": {
      "id": "status-card",
      "type": "card",
      "title": "Status",
      "body": "Everything looks good.",
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
  }
}
```

## Top-level fields

- `schemaVersion`
  - required
  - must be `pebble.sdui.v1`
- `entryScreenId`
  - required
  - must point to a screen in `screens`
- `screens`
  - required
  - object keyed by screen id

## Screen object

Each screen has:

- `id`
- `type`
- `title`
- optional `body`
- optional `titleTemplate`
- optional `bodyTemplate`
- optional `bindings`
- optional `input`

Depending on `type`, it also has:

- `items` for `menu`
- `actions` for `card`

### `screen.type`

Allowed values:

- `menu`
- `card`

### `screen.title`

- string
- hard-limited to 30 chars in PKJS

### `screen.body`

- string
- hard-limited to 180 chars in PKJS

### `screen.titleTemplate` / `screen.bodyTemplate`

- optional template strings
- use `{{binding.path}}`

Example:

```json
{
  "bodyTemplate": "{{time.localString}}"
}
```

### `screen.bindings`

Bindings inject native/live values into templates.

Current supported source:

- `device.time`

Binding shape:

```json
{
  "time": {
    "source": "device.time",
    "live": true,
    "refreshMs": 30000
  }
}
```

Available time fields:

- `time.localString`
- `time.localTime`
- `time.iso`
- `time.timestamp`

### `screen.input`

`input` is screen-local and currently only controls menu voice behavior.

Supported fields:

- `mode`
  - `menu`
  - `voice`
  - `menu_or_voice`

Default:

```json
{ "mode": "menu" }
```

Runtime behavior:

- `menu`: render items only
- `voice`: add `Speak response` row
- `menu_or_voice`: render items and add `Speak response`

## Menu screens

Menu screens use `items`.

```json
{
  "id": "root",
  "type": "menu",
  "title": "Main Menu",
  "items": [
    {
      "id": "controls",
      "label": "Controls",
      "run": { "type": "navigate", "screen": "controls" }
    }
  ]
}
```

### Menu item fields

- `id`
  - sanitized to `[a-z0-9_-]`
  - max 22 chars in PKJS
  - unique within the screen
- `label`
  - max 20 chars
- optional `labelTemplate`
- optional `value`
- optional `run`

### `value`

`value` is response data.

Runtime behavior:

- on agent-owned graphs, selecting an item with `value` and no `run` sends that value back to the agent
- on static/imported local graphs, `run` is the usual way to cause behavior

### `run`

`run` is the only effect hook.

Supported `run.type` values:

- `navigate`
- `agent_prompt`
- `agent_command`

Examples:

```json
{ "type": "navigate", "screen": "root" }
```

```json
{ "type": "agent_prompt", "prompt": "Start a short conversation." }
```

```json
{ "type": "agent_command", "command": "reset" }
```

## Card screens

Card screens use `actions`.

```json
{
  "id": "status-card",
  "type": "card",
  "title": "Status",
  "body": "Everything looks good.",
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

### Card action fields

- `slot`
  - one of `up`, `select`, `down`
  - unique per card
- `id`
  - sanitized to `[a-z0-9_-]`
  - max 22 chars
  - unique within the card
- `icon`
  - one of `play`, `pause`, `check`, `x`, `plus`, `minus`
  - invalid values default to `check`
- `label`
  - max 20 chars
- optional `value`
- optional `run`

Runtime behavior:

- on agent-owned graphs, selecting an action with `value` and no `run` sends that value back to the agent
- on local graphs, actions usually use `run`

## Runtime rules

- The app starts at `entryScreenId`.
- `run.type = "navigate"` changes screens within the same graph.
- Back navigation uses screen history.
- Menu screens render `items`.
- Card screens render `actions`.
- `voice` / `menu_or_voice` inject a `Speak response` row into menu screens.
- `bindings.live = true` causes periodic re-render of the current screen.

## Limits

Actual runtime limits:

- `title <= 30`
- `body <= 180`
- `items <= 8`
- `item.label <= 20`
- `actions <= 3`
- `action.label <= 20`

Recommended safe authoring limits:

- `title <= 24`
- `body <= 140`
- `label <= 18`

## Minimal examples

### Final card graph

```json
{
  "schemaVersion": "pebble.sdui.v1",
  "entryScreenId": "done",
  "screens": {
    "done": {
      "id": "done",
      "type": "card",
      "title": "Done",
      "body": "Your settings were saved."
    }
  }
}
```

### Menu graph with navigation

```json
{
  "schemaVersion": "pebble.sdui.v1",
  "entryScreenId": "root",
  "screens": {
    "root": {
      "id": "root",
      "type": "menu",
      "title": "Pick one",
      "items": [
        {
          "id": "yes",
          "label": "Yes",
          "run": { "type": "navigate", "screen": "yes-card" }
        },
        {
          "id": "no",
          "label": "No",
          "run": { "type": "navigate", "screen": "no-card" }
        }
      ]
    },
    "yes-card": {
      "id": "yes-card",
      "type": "card",
      "title": "Yes",
      "body": "You picked yes."
    },
    "no-card": {
      "id": "no-card",
      "type": "card",
      "title": "No",
      "body": "You picked no."
    }
  }
}
```

### Live time card

```json
{
  "schemaVersion": "pebble.sdui.v1",
  "entryScreenId": "time-card",
  "screens": {
    "time-card": {
      "id": "time-card",
      "type": "card",
      "title": "Phone Time",
      "bodyTemplate": "{{time.localString}}",
      "bindings": {
        "time": {
          "source": "device.time",
          "live": true,
          "refreshMs": 30000
        }
      }
    }
  }
}
```

## Not implemented yet

These are not part of the current runtime:

- first-class `input` screen type
- workflow patch protocol
- extra native bindings beyond `device.time`
- legacy `next` / `agentPrompt` / `agentCommand`
