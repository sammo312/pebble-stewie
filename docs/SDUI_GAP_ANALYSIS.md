# SDUI Platform Gap Analysis

Comparing the [Pebble Foundation SDK](https://developer.repebble.com/docs/c/Foundation/) against the current SDUI contract (`pebble.sdui.v1`) to identify what's missing for building great apps.

## Current State

The SDUI platform today supports:
- **Screen types**: menu, card, scroll (partial)
- **Actions**: navigate, agent_prompt, agent_command
- **Effects**: vibe (short/long/double), light
- **Bindings**: `device.time` only (with live refresh)
- **Icons**: play, pause, check, x, plus, minus

Already planned (in existing docs): number_input, images/bitmap, action_menu, scroll completion, contract hardening.

---

## Critical Missing Features

### 1. Variables & Conditional Navigation

**Pebble SDK**: Full C logic — if/else, counters, state machines.
**SDUI today**: Navigation is purely static graph edges. No branching, no counters, no conditionals.

**Why critical**: Even simple apps need "if X then show screen A, else show screen B". A workout tracker needs a rep counter. A quiz needs a score. Without variables, the graph is a static flowchart.

**Proposed contract additions**:
- `run.type: "set_var"` — set/increment/toggle a named variable
  ```json
  { "type": "set_var", "key": "count", "value": "increment" }
  { "type": "set_var", "key": "name", "value": "literal:Sam" }
  ```
- Conditional navigation — `run.type: "navigate"` gains optional `condition`
  ```json
  { "type": "navigate", "screen": "win", "condition": { "var": "score", "op": "gte", "value": "10" } }
  ```
- Template access via `{{var.count}}` in title/body templates
- Phone-side variable map per session, reset on app restart

---

### 2. Persistent Storage

**Pebble SDK**: `persist_read_*` / `persist_write_*` — 4KB per app, bool/int/string/data types.
**SDUI today**: Zero app-level persistence. Every session starts blank.

**Why critical**: Without storage, apps can't remember preferences, scores, history, onboarding state, or any user data. This is the difference between a demo and a real app.

**Proposed contract additions**:
- `run.type: "store"` — persist a value
  ```json
  { "type": "store", "key": "high_score", "value": "{{var.score}}" }
  ```
- New binding source `storage.*`
  ```json
  { "source": "storage.high_score", "live": false }
  ```
- Phone-side implementation via `localStorage` keyed by app/graph ID
- Limits: 4KB total per graph, string values only

---

### 3. Screen Lifecycle Hooks

**Pebble SDK**: `window_set_window_handlers()` — load, appear, disappear, unload.
**SDUI today**: No on-enter/on-exit hooks. Screens are passive until button press.

**Why critical**: "Play a vibe when this alert screen appears", "start a timer on enter", "initialize a variable on load" — lifecycle hooks connect actions to navigation transitions, not just button presses.

**Proposed contract additions**:
- `screen.onEnter` — array of `run` actions fired when screen becomes visible
- `screen.onExit` — array of `run` actions fired when navigating away
  ```json
  "onEnter": [
    { "type": "set_var", "key": "viewed", "value": "true" },
    { "vibe": "short" }
  ]
  ```

---

### 4. Device & Sensor Bindings

**Pebble SDK**: Battery, BT connection, health/steps, accelerometer, compass services.
**SDUI today**: Only `device.time`. All other device state is invisible.

**Why critical**: Device-aware apps are the *reason* people use a smartwatch. Step counters, battery monitors, "connected?" indicators — table-stakes for useful watch apps.

**Proposed binding sources**:
| Source | Fields | Notes |
|--------|--------|-------|
| `device.battery` | `level`, `charging`, `plugged` | BatteryStateService |
| `device.connection` | `connected` | ConnectionService (BT state) |
| `device.health` | `steps`, `sleep`, `active` | HealthService daily totals |
| `device.accel` | `x`, `y`, `z` | AccelerometerService, use with `live: true` |
| `device.watch` | `model`, `color`, `firmware` | WatchInfo, static |

---

### 5. Timers & Delayed Actions

**Pebble SDK**: `app_timer_register()` for one-shot callbacks, `TickTimerService` for periodic.
**SDUI today**: Only live binding refresh. No way to say "after 5 seconds, navigate" or "countdown from 30".

**Why critical**: Pomodoro timers, alerts, splash screens, auto-dismiss notifications, game timeouts — timers are foundational for interactive apps.

**Proposed contract additions**:
- Screen-level `timer` field:
  ```json
  { "durationMs": 5000, "run": { "type": "navigate", "screen": "next" } }
  ```
- Countdown binding for display: `{{timer.remaining}}`
- Integrates with existing `run` action system

---

### 6. HTTP/Webhook Actions

**Pebble SDK**: `AppMessage` + companion JS with full `XMLHttpRequest`.
**SDUI today**: Only `agent_prompt` (OpenAI-specific). No general HTTP capability.

**Why critical**: Home automation (toggle lights), weather APIs, IoT control, any backend integration. The phone companion should be a general-purpose HTTP bridge, not just an AI gateway.

**Proposed contract addition**:
```json
{
  "type": "http",
  "url": "https://api.example.com/toggle",
  "method": "POST",
  "headers": { "Authorization": "Bearer {{storage.api_key}}" },
  "body": "{}",
  "onSuccess": { "type": "navigate", "screen": "done" },
  "onError": { "type": "navigate", "screen": "error" }
}
```
- Response values bound to variables for display
- Security: domain allowlist in app config, rate limiting

---

## Lower Priority Gaps

| Feature | Pebble SDK | Notes |
|---------|-----------|-------|
| Wakeup/scheduled launch | `wakeup_schedule()` | Schedule app to run at a specific time |
| Background workers | `AppWorker` | Run logic when app not in foreground |
| Data logging | `DataLogging` | Async data export to phone |
| Custom vibe patterns | `vibes_enqueue_custom_pattern()` | Beyond short/long/double |
| Internationalization | i18n APIs | Locale-aware formatting |
| App Glance | `app_glance_*` | Modify launcher appearance |
| Compass | `CompassService` | Heading data — useful but niche |
| Dictation | `DictationSession` | Already partially covered by voice input mode |

---

## Recommended Implementation Order

| Phase | Feature | Effort | What It Unlocks |
|-------|---------|--------|-----------------|
| 1 | Variables & conditional nav | Medium | Dynamic apps, counters, branching, quizzes, games |
| 2 | Persistent storage | Medium | Cross-session state, preferences, high scores |
| 3 | Screen lifecycle hooks | Low | Auto-effects on enter, init variables, timers |
| 4 | Device bindings | Medium | Battery, steps, connection — device-aware apps |
| 5 | Timers & delayed actions | Medium | Countdowns, auto-navigation, pomodoro, alerts |
| 6 | HTTP/webhook actions | High | IoT, weather, API-driven apps, home automation |

**Rationale**: Variables + storage come first because they transform the platform from "static flowchart renderer" to "stateful application runtime". Everything else builds on having state. Lifecycle hooks are low-effort and immediately useful once variables exist. Device bindings extend the existing binding system. Timers and HTTP are more complex but round out the platform.
