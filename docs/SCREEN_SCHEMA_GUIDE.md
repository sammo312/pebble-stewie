# Pebble Stewie Screen Guide

Use this guide when you want to make your own screens quickly.

This guide matches the real runtime now: one canonical graph schema for built-in screens, imported JSON, and agent responses.
The canonical authoring/export target is `pebble.sdui.v1.2.0`; older imports are normalized forward when loaded.

For the strict contract, see [SDUI_SCHEMA_SPEC.md](/Users/sam/dev/pebble/pebble-stewie/docs/SDUI_SCHEMA_SPEC.md).

## The shape to remember

Everything is a graph:

```json
{
  "schemaVersion": "pebble.sdui.v1.2.0",
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

Think of it like this:

1. `entryScreenId` tells the app where to start
2. `screens` contains all screens in the graph
3. each screen is either a `menu` or a `card`
4. menu screens use `items`
5. card screens use `actions`

## Fast recipes

### 1. One final card

```json
{
  "schemaVersion": "pebble.sdui.v1.2.0",
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

### 2. A simple menu

```json
{
  "schemaVersion": "pebble.sdui.v1.2.0",
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

### 3. A card with Pebble action buttons

```json
{
  "schemaVersion": "pebble.sdui.v1.2.0",
  "entryScreenId": "confirm",
  "screens": {
    "confirm": {
      "id": "confirm",
      "type": "card",
      "title": "Confirm",
      "body": "Apply this change?",
      "actions": [
        {
          "slot": "up",
          "id": "cancel",
          "icon": "x",
          "label": "Cancel",
          "run": { "type": "navigate", "screen": "cancelled" }
        },
        {
          "slot": "select",
          "id": "ok",
          "icon": "check",
          "label": "OK",
          "run": { "type": "navigate", "screen": "done" }
        }
      ]
    },
    "cancelled": {
      "id": "cancelled",
      "type": "card",
      "title": "Cancelled",
      "body": "Nothing changed."
    },
    "done": {
      "id": "done",
      "type": "card",
      "title": "Done",
      "body": "Change applied."
    }
  }
}
```

### 4. A voice-enabled menu

```json
{
  "schemaVersion": "pebble.sdui.v1.2.0",
  "entryScreenId": "reply",
  "screens": {
    "reply": {
      "id": "reply",
      "type": "menu",
      "title": "Reply",
      "input": {
        "mode": "menu_or_voice"
      },
      "items": [
        { "id": "yes", "label": "Yes", "value": "yes" },
        { "id": "later", "label": "Later", "value": "later" }
      ]
    }
  }
}
```

The runtime adds `Speak response` automatically when `input.mode` is `voice` or `menu_or_voice`.

### 5. A live time card

```json
{
  "schemaVersion": "pebble.sdui.v1.2.0",
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

## Menu screens

Menu screens use `items`.

Each item can have:

- `id`
- `label`
- optional `labelTemplate`
- optional `value`
- optional `run`

Typical local navigation item:

```json
{
  "id": "controls",
  "label": "Controls",
  "run": { "type": "navigate", "screen": "controls" }
}
```

Typical agent-response item:

```json
{
  "id": "yes",
  "label": "Yes",
  "value": "yes"
}
```

Meaning:

- use `run` when you want the app to do something locally
- use `value` when the selection should be sent back to the agent

## Card screens

Card screens use `actions`.

Each action can have:

- `slot`
- `id`
- `icon`
- `label`
- optional `value`
- optional `run`

Typical local card action:

```json
{
  "slot": "select",
  "id": "home",
  "icon": "check",
  "label": "Home",
  "run": { "type": "navigate", "screen": "root" }
}
```

Typical agent-response card action:

```json
{
  "slot": "select",
  "id": "ok",
  "icon": "check",
  "label": "OK",
  "value": "ok"
}
```

## `run` actions

`run` is the only effect hook.

Supported types right now:

### `navigate`

```json
{ "type": "navigate", "screen": "root" }
```

### `agent_prompt`

```json
{ "type": "agent_prompt", "prompt": "Start a short conversation." }
```

### `agent_command`

```json
{ "type": "agent_command", "command": "reset" }
```

## Bindings

Bindings inject native values into templates.

Current supported source:

- `device.time`

Available fields:

- `time.localString`
- `time.localTime`
- `time.iso`
- `time.timestamp`

## Good defaults

Use these unless you have a reason not to:

- `entryScreenId`: `"root"`
- first screen id: `"root"`
- short titles
- short labels
- `run.navigate` for local screen-to-screen movement
- `value` only when you want agent follow-up

## Limits

Hard limits:

- `title <= 30`
- `body <= 180`
- `items <= 8`
- `item.label <= 20`
- `actions <= 3`
- `action.label <= 20`

Safer limits:

- `title <= 24`
- `body <= 140`
- `label <= 18`

## Easy mistakes

- using `options` instead of `items`
- using a single-turn wrapper instead of a graph
- forgetting `entryScreenId`
- using `next` instead of `run`
- putting `actions` on a menu screen
- putting `items` on a card screen
- expecting first-class `input` screens to work yet

## Minimal checklist

Before you paste JSON into the app settings page:

1. `schemaVersion` is `pebble.sdui.v1.2.0`
2. `entryScreenId` exists in `screens`
3. each screen has an `id`
4. menu screens use `items`
5. card screens use `actions`
6. local behavior uses `run`
7. agent responses use `value`

## Real reference

The built-in graph uses the same schema:

- [static-screens.js](/Users/sam/dev/pebble/pebble-stewie/src/pkjs/static-screens.js)
