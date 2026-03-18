# Pebble Stewie Screen Guide

Use this when you want to author graphs quickly without memorizing every field in the full spec.

This guide matches the current runtime and builder target: `pebble.sdui.v1.2.0`.

For the strict contract, see [SDUI_SCHEMA_SPEC.md](SDUI_SCHEMA_SPEC.md).

## Base shape

Everything is a graph:

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

Remember:

1. `entryScreenId` is the first screen shown.
2. `screens` contains every addressable screen in the graph.
3. The current runtime supports `menu`, `card`, `scroll`, and `draw`.
4. `run` drives local behavior.
5. `value` is response data for agent-owned or data-driven flows.

## Screen types

### `menu`

Use for short lists of selectable rows.

```json
{
  "id": "root",
  "type": "menu",
  "title": "Pick one",
  "items": [
    {
      "id": "status",
      "label": "Status",
      "run": { "type": "navigate", "screen": "status" }
    },
    {
      "id": "reply",
      "label": "Reply",
      "value": "Reply"
    }
  ]
}
```

### `card`

Use for a title, body text, and up to three action-bar buttons.

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

### `scroll`

Use for long text that needs button scrolling. `scroll.actions` open a Pebble `ActionMenu` from Select.

```json
{
  "id": "notes",
  "type": "scroll",
  "title": "Release Notes",
  "body": "Longer content goes here...",
  "actions": [
    {
      "id": "done",
      "label": "Done",
      "run": { "type": "navigate", "screen": "root" }
    }
  ]
}
```

### `draw`

Use for animated custom screens. The current authoring model supports either semantic `motion` or raw `drawing`.

```json
{
  "id": "splash",
  "type": "draw",
  "title": "Loading",
  "canvas": {
    "template": "header_list",
    "header": "Loading",
    "items": [
      { "id": "one", "label": "Sync" },
      { "id": "two", "label": "Prepare" }
    ]
  },
  "motion": {
    "playMode": "once",
    "background": "grid",
    "timelineMs": 1600,
    "tracks": [
      {
        "id": "header",
        "label": "Header In",
        "target": "header",
        "kind": "text",
        "preset": "slide_up",
        "placement": "top",
        "color": "accent",
        "speed": "normal",
        "intensity": "medium"
      }
    ]
  }
}
```

## Common patterns

### Live bindings and templates

Templates can read:

- `{{var.key}}`
- `{{storage.key}}`
- `{{timer.remaining}}`
- binding aliases from `screen.bindings`

Example:

```json
{
  "id": "clock",
  "type": "card",
  "title": "Clock",
  "bodyTemplate": "{{time.localString}}",
  "bindings": {
    "time": {
      "source": "device.time",
      "live": true,
      "refreshMs": 30000
    }
  }
}
```

### Variables and storage

Use `set_var` for session-only state and `store` for persisted phone-side state.

```json
{
  "type": "set_var",
  "key": "count",
  "value": "increment"
}
```

```json
{
  "type": "store",
  "key": "best_score",
  "value": "{{var.count}}"
}
```

### Screen lifecycle and timers

Screens can fire local behavior on enter, on exit, or after a delay.

```json
{
  "id": "timer-demo",
  "type": "card",
  "title": "Wait",
  "timer": {
    "durationMs": 5000,
    "run": { "type": "navigate", "screen": "done" }
  },
  "onEnter": [
    { "type": "effect", "vibe": "short" }
  ]
}
```

### Dictation into an agent prompt

Use `dictation` when you want the watch to capture speech and optionally chain into another run.

```json
{
  "id": "ask",
  "label": "Speak",
  "run": {
    "type": "dictation",
    "variable": "transcript",
    "then": {
      "type": "agent_prompt",
      "prompt": "{{var.transcript}}"
    }
  }
}
```

## `value` vs `run`

Use `run` when the runtime should do something locally:

- navigate
- update variables
- persist state
- trigger dictation
- call the agent
- fire a native effect

Use `value` when a selection should be treated as user response data instead of an immediate local action.

## Practical limits

- title: 30 chars
- card body: 180 chars
- scroll body: 1024 chars
- menu items: 8
- card actions: 3
- scroll select-drawer actions: 6
- draw steps / motion tracks: 6

When in doubt, keep labels short and title/body closer to the builder's recommended lengths.
