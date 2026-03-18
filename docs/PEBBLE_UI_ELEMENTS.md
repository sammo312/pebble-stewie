# Pebble UI Elements in SDUI

How every native Pebble UI element maps (or will map) to `pebble.sdui.v1.2.0`.

Reference: [Pebble C SDK User Interface](https://developer.rebble.io/docs/c/User_Interface/)

---

## Currently supported

These are the Pebble UI primitives the SDUI runtime already uses on the watch.

### MenuLayer (`screen.type: "menu"`)

The native Pebble `MenuLayer` — a scrollable list of selectable rows with an optional header.

**SDK behavior**: Section/row hierarchy, callback-driven data, variable cell heights, highlight colors. Supports `menu_cell_basic_draw()` for title+subtitle+icon cells.

**SDUI mapping**: Flat list (no sections). Each item is a row drawn with `menu_cell_basic_draw()`.

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

| Field | Pebble native equivalent | Limit |
|-------|--------------------------|-------|
| `title` | Section header via `menu_cell_basic_header_draw()` | 30 chars |
| `body` | `TextLayer` above the menu (50px wrap area) | 180 chars |
| `items[].label` | Row title via `menu_cell_basic_draw()` | 20 chars |
| `items[].id` | Used in action response `actionItemId` | 22 chars |
| `items` count | `MAX_MENU_ITEMS` | 8 |

**Input**: UP/DOWN scroll rows. SELECT sends the item back to the phone (or fires `run`). BACK pops the screen.

### TextLayer (card title + body)

The native Pebble `TextLayer` — renders a formatted text string in a rectangle.

**SDK behavior**: Configurable font, color, alignment, overflow mode, text flow for round screens.

**SDUI mapping**: Two `TextLayer` instances on every card screen:
- **Title layer** — 24pt bold, top of screen
- **Body layer** — 18pt, below title, word-wrapped

```json
{
  "id": "info",
  "type": "card",
  "title": "Status",
  "body": "Everything looks good."
}
```

| Field | Pebble native equivalent | Limit |
|-------|--------------------------|-------|
| `title` | `TextLayer` (Gothic 24 Bold) | 30 chars |
| `body` | `TextLayer` (Gothic 18), overflow word-wrap | 180 chars |
| `titleTemplate` | Template resolved before setting text | — |
| `bodyTemplate` | Template resolved before setting text | — |

Templates use `{{binding.path}}` syntax and are resolved on the phone before each render.

### ActionBarLayer (`screen.actions`)

The native Pebble `ActionBarLayer` — a 30px vertical bar on the right edge with up to 3 icon buttons. This is what card `actions` render. It is **not** the same as `ActionMenu` (a separate full-screen picker component — see planned section).

**SDK behavior**: Three icon slots (UP, SELECT, DOWN), 28x18px max icons, configurable background color, press animations.

**SDUI mapping**: Each `action` maps to one hardware button slot with an icon.

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

| Field | Pebble native equivalent | Limit |
|-------|--------------------------|-------|
| `slot` | `BUTTON_ID_UP / SELECT / DOWN` | one per slot |
| `icon` | `GBitmap` icon set on the slot | see below |
| `actions` count | `NUM_ACTION_BAR_ITEMS` | 3 |
| `label` | Not rendered on watch (phone-side only) | 20 chars |

**Available icons**: `play`, `pause`, `check`, `x`, `plus`, `minus`. Invalid values fall back to `check`.

The action bar is hidden when a card has zero actions.

### StatusBarLayer

**SDK behavior**: Fixed-height bar at top of screen showing time. Configurable foreground/background colors and dotted separator.

**SDUI mapping**: Not directly exposed in the schema. The watch app manages its own status bar at the window level. No schema field needed — it's always present.

### Window / Window Stack

**SDK behavior**: Full-screen container; the window stack manages push/pop with back-button navigation.

**SDUI mapping**: Each `screen` in the graph is a logical window. The watch uses a single `Window` and swaps layer visibility between menu and card modes. Back navigation is handled by the phone sending the previous screen's render message. The `run.type: "navigate"` action and BACK button map to window stack semantics.

---

## Not yet supported (planned)

These Pebble UI elements have clear SDUI mappings but aren't wired up yet.

### ScrollLayer

**SDK behavior**: Animated vertical scrolling of child layers. Shadow indicators show more content. Supports paging mode (scroll by frame height per button press).

**Proposed screen type**: `scroll`

```json
{
  "id": "long-text",
  "type": "scroll",
  "title": "Release Notes",
  "body": "A much longer body that exceeds the visible area. The ScrollLayer handles vertical panning with UP/DOWN buttons and shadow indicators at top and bottom edges."
}
```

**What it adds**: Cards are currently limited to 180 chars because there's no scroll. A `scroll` screen type would wrap the body `TextLayer` inside a `ScrollLayer`, allowing much longer text. The title could live in a `StatusBarLayer` or be the first line of scrollable content.

**Proposed limits**:
- `body`: 1024 chars (watch-side buffer permitting)
- Paging mode on by default (each button press scrolls one screen height)

### BitmapLayer

**SDK behavior**: Displays a `GBitmap` within its frame. Configurable alignment, background color, and compositing mode. Transparency via `GCompOpSet`.

**Proposed screen type**: `image` (or field on existing types)

```json
{
  "id": "weather-icon",
  "type": "card",
  "title": "Weather",
  "body": "Sunny, 72F",
  "image": {
    "resource": "WEATHER_SUNNY",
    "alignment": "center"
  }
}
```

**Open questions**:
- Images must be compiled into the watch app as resources — they can't be streamed over Bluetooth. This means the set of available images is fixed at build time.
- A practical approach: define a built-in icon set (weather, status, arrows, etc.) and reference them by name in the schema.
- Alternatively, support a small pixel buffer sent as base64 (very constrained by AppMessage size limits ~2KB).

### NumberWindow

**SDK behavior**: Pre-built number picker. UP/DOWN change value by step size, SELECT confirms. Has min, max, step, label, and callbacks for incremented/decremented/selected.

**Proposed screen type**: `number_input`

```json
{
  "id": "set-timer",
  "type": "number_input",
  "title": "Set Timer",
  "label": "Minutes",
  "min": 1,
  "max": 60,
  "step": 5,
  "value": 10
}
```

| Field | Pebble native equivalent |
|-------|--------------------------|
| `label` | `number_window_set_label()` |
| `min` | `number_window_set_min()` |
| `max` | `number_window_set_max()` |
| `step` | `number_window_set_step_size()` |
| `value` | `number_window_set_value()` (initial) |

**Runtime**: SELECT confirms and sends the value back (as `actionText` or a new `actionValue` field). UP/DOWN are handled natively.

### ActionMenu

**SDK behavior**: Full-screen hierarchical action picker — a separate component from `ActionBarLayer`. Items organized in levels. Supports wide (one item per row) and thin (grid) display modes. Can freeze during async operations.

**Not to be confused with**: Card `actions` in the current schema, which use `ActionBarLayer` (the 3-button sidebar). `ActionMenu` is a completely different SDK component — it takes over the full screen and supports arbitrarily many items in a scrollable list.

**Proposed screen type**: `action_menu`

```json
{
  "id": "share-menu",
  "type": "action_menu",
  "title": "Share",
  "alignment": "center",
  "items": [
    { "id": "email", "label": "Email", "value": "email" },
    { "id": "sms", "label": "SMS", "value": "sms" },
    { "id": "copy", "label": "Copy Link", "value": "copy" }
  ]
}
```

**What it adds over `menu`**: Native Pebble action-picking look and feel (animated, fills screen from the right). Single-level is the practical starting point — nested levels add complexity for little SDUI gain. In practice, the existing `menu` screen type already covers most of this use case.

---

## Supported as run effects (not screen types)

These SDK features map to `run` actions or side effects rather than screen types.

### Vibes (vibration motor)

**SDK behavior**: `vibes_short_pulse()`, `vibes_long_pulse()`, `vibes_double_pulse()`, and custom patterns via `vibes_enqueue_custom_pattern()` (up to 10s per segment).

**Proposed `run` extension**:

```json
{
  "run": {
    "type": "navigate",
    "screen": "alert",
    "vibe": "double"
  }
}
```

| `vibe` value | Pebble function |
|-------------|-----------------|
| `short` | `vibes_short_pulse()` |
| `long` | `vibes_long_pulse()` |
| `double` | `vibes_double_pulse()` |
| `none` | no vibration (default) |

Custom patterns are possible but would need a duration array field. Start with the three presets.

### Light (backlight)

**SDK behavior**: `light_enable_interaction()` triggers the backlight as if the user pressed a button. Useful for drawing attention.

**Proposed `run` extension**:

```json
{
  "run": {
    "type": "navigate",
    "screen": "alert",
    "light": true
  }
}
```

A simple boolean — trigger the backlight on transition. No need to expose `light_enable()` (keeps backlight on permanently) as that drains battery.

---

## Not applicable to SDUI

These SDK features exist for native C apps but don't map well to server-driven UI.

### RotBitmapLayer

Renders bitmaps with rotation. Useful for analog watchfaces (rotating hands). Not practical for SDUI — rotation angles would need continuous updates that don't fit the message-based render model.

### Animation / PropertyAnimation

The SDK's animation framework interpolates layer properties over time (position, size, etc.). SDUI screens are static snapshots — animations would require a fundamentally different protocol (streaming property updates at 30fps). The existing implicit animations in `ScrollLayer` and `ActionBarLayer` press animations are handled natively.

### Clicks (raw click handling)

Low-level button event subscriptions (single, repeating, multi-click, long press, raw up/down). SDUI already maps the three buttons to menu selection and card actions. Exposing raw click handlers would break the declarative model.

### UnobstructedArea

API for handling timeline quick-view obstructions on the screen. This is a watchface concern, not relevant to watchapp SDUI.

### Preferences

Native user preference storage. SDUI state lives on the phone side in the graph — no need to duplicate into the watch's persistent storage.

---

## Implementation priority

Rough ordering by value and effort:

| Priority | Element | Effort | Value |
|----------|---------|--------|-------|
| 1 | ScrollLayer (`scroll` type) | Low — wraps existing TextLayer | Unlocks long-form content |
| 2 | Vibes (`run.vibe`) | Low — one-liner on watch side | Haptic feedback for alerts |
| 3 | Light (`run.light`) | Trivial | Attention for important screens |
| 4 | NumberWindow (`number_input`) | Medium — new window type on watch | Numeric input without voice |
| 5 | BitmapLayer (icon field) | Medium — resource management | Visual richness |
| 6 | ActionMenu (`action_menu`) | Medium — new window type | Better action picking UX |

---

## Current watch-side rendering summary

For reference, this is what the C code does today with the two supported types:

**Menu render** (`UI_TYPE_MENU = 1`):
1. Parse `items` string: `id|label\nid|label...` (max 8)
2. Show `MenuLayer` with header drawn from `title`
3. Optional `TextLayer` body above the menu (50px)
4. Hide `ActionBarLayer`

**Card render** (`UI_TYPE_CARD = 2`):
1. Show title `TextLayer` (Gothic 24 Bold)
2. Show body `TextLayer` (Gothic 18, word-wrap)
3. Parse `actions` string: `slot|id|icon\nslot|id|icon...` (max 3)
4. Show `ActionBarLayer` if actions exist, hide if not
5. Card body width adjusts for action bar presence

**Wire format** (AppMessage):
- `msgType`: 1 = render, 2 = action
- `uiType`: 1 = menu, 2 = card
- `screenId`: current screen identifier
- `title`, `body`: text content
- `items` / `actions`: pipe-delimited, newline-separated strings
