# SDUI Platform Gap Analysis

Comparing the Pebble Foundation SDK against the current SDUI contract (`pebble.sdui.v1.2.0`) and the builder/runtime that ship in this repo to identify what is still missing for building great apps.

## Current State

The SDUI platform today supports:
- **Screen types**: menu, card, scroll, draw
- **Run types**: navigate, set_var, store, agent_prompt, agent_command, effect, dictation
- **Conditional navigation**: `navigate.condition` against session variables
- **State**: per-session variables via `{{var.key}}`
- **Persistence**: phone-side graph storage via `{{storage.key}}`
- **Lifecycle hooks**: `screen.onEnter`, `screen.onExit`
- **Timers**: screen-level one-shot `timer { durationMs, run }`
- **Templates**: `{{var.*}}`, `{{storage.*}}`, `{{timer.remaining}}`, plus screen bindings
- **Bindings**: `device.time` and `storage.*`
- **Builder support**: intents for navigate, variables, store, effects, agent actions, and dictation; unified data catalog for session/persistent/device items
- **Icons**: play, pause, check, x, plus, minus

Still not implemented from older planning threads:
- images / bitmap rendering
- broader device and sensor bindings
- general HTTP / webhook actions
- wakeups / background execution

---

## Shipped Since The Original Draft

### 1. Variables & Conditional Navigation

This is implemented.

What exists now:
- `run.type: "set_var"` for increment, decrement, toggle, numeric, boolean, and literal values
- `run.type: "navigate"` with optional `condition`
- template access via `{{var.key}}`
- builder intents for increment, decrement, toggle, set-to, and conditional navigate

Impact:
- The graph is no longer a static flowchart. Counters, branching, score checks, and stateful flows are already possible.

---

### 2. Persistent Storage

This is implemented.

What exists now:
- `run.type: "store"`
- template and binding access via `{{storage.key}}` and `storage.*`
- phone-side persistence keyed by graph storage namespace
- builder support for declaring persistent keys

Impact:
- Apps can already remember scores, settings, onboarding state, and simple saved values across sessions.

---

### 3. Screen Lifecycle Hooks

This is implemented.

What exists now:
- `screen.onEnter`
- `screen.onExit`
- builder support for editing both hook lists

Impact:
- Screens can initialize state, fire effects, or redirect as part of navigation transitions.

---

### 4. Timers & Delayed Actions

This is implemented.

What exists now:
- screen-level `timer`
- one-shot delayed `run`
- template access via `{{timer.remaining}}`
- builder support for timer editing and preview countdown

Impact:
- Countdown, splash, auto-advance, and timeout-style flows are already supported.

---

## Critical Remaining Gaps

### 1. Device & Sensor Bindings Beyond Time

**Pebble SDK**: Battery, BT connection, health/steps, accelerometer, compass services.

**SDUI today**: The binding system is extensible in shape, and the builder already has a place to declare device data aliases, but the runtime only resolves `device.time` today.

**Why critical**: Device-aware apps are a core smartwatch use case. Battery monitors, connection status, and step-driven experiences still require custom native work instead of staying inside the SDUI model.

**Proposed binding sources**:

| Source | Fields | Notes |
|--------|--------|-------|
| `device.battery` | `level`, `charging`, `plugged` | BatteryStateService |
| `device.connection` | `connected` | ConnectionService |
| `device.health` | `steps`, `sleep`, `active` | HealthService daily totals |
| `device.accel` | `x`, `y`, `z` | AccelerometerService, likely `live: true` |
| `device.watch` | `model`, `color`, `firmware` | Static watch metadata |

**Implementation notes**:
- extend runtime binding resolution, not the templating model
- reuse existing binding aliases in screens and builder data items
- wire live refresh rules for sources that change frequently

---

### 2. HTTP / Webhook Actions

**Pebble SDK**: `AppMessage` plus companion JS with general `XMLHttpRequest`.

**SDUI today**: The phone companion can already make network calls, but only the OpenAI path is wired into the runtime. There is no general-purpose `http` or `webhook` run type exposed through the contract or builder.

**Why critical**: Home automation, weather, REST backends, IoT control, and custom app APIs all depend on this. The companion should be a general HTTP bridge, not just an AI gateway.

**Recommended minimal contract addition**:

```json
{
  "type": "http",
  "method": "GET",
  "url": "https://api.example.com/weather?zip={{storage.zip}}",
  "headers": {
    "Authorization": "Bearer {{storage.api_key}}"
  },
  "body": "",
  "assign": [
    { "scope": "session", "key": "temp_f", "path": "current.temp_f" },
    { "scope": "session", "key": "condition", "path": "current.condition.text" }
  ],
  "onSuccess": { "type": "navigate", "screen": "forecast" },
  "onError": { "type": "navigate", "screen": "error" }
}
```

**Why this shape fits the current system**:
- request fields can reuse existing template resolution with `{{var.*}}` and `{{storage.*}}`
- response data should map into existing `session` or `persistent` keys instead of inventing a new remote-template namespace first
- success/error can reuse the existing run system

**Security requirements**:
- domain allowlist per graph or app config
- request timeout and rate limiting
- header templating should prefer stored secrets over hardcoded credentials
- clear failure surfaces for DNS, auth, and bad JSON

---

### 3. Builder Support For API-Backed Data

This is the builder-specific gap behind "webhook actions should grab data from APIs somehow."

**Builder today**:
- can declare session, persistent, and device data items
- can wire actions, hooks, and timers to existing run types
- cannot model a request, map response fields, test a webhook, or preview remote state

**Why critical**: Even if runtime HTTP exists, authors still need a usable way to configure it. Raw JSON editing is not enough for non-trivial flows.

**Needed builder additions**:
- new run target / intent: `Fetch API / Webhook`
- request editor: method, URL, headers, body, timeout
- response mapper: assign JSON paths into session or persistent keys
- success and error follow-up actions
- preview tooling: paste mock JSON or inspect last response
- clear credential strategy: reference storage keys for secrets instead of pasting tokens into graphs

**Recommended design choice**:
- keep builder data targets in the existing `session` and `persistent` catalogs
- do not add a separate "remote" state scope unless polling and caching requirements justify it later

---

## Lower Priority Gaps

| Feature | Pebble SDK | Notes |
|---------|-----------|-------|
| Wakeup / scheduled launch | `wakeup_schedule()` | Schedule app work for a future time |
| Background workers | `AppWorker` | Run logic when app is not foregrounded |
| Data logging | `DataLogging` | Export batched data to the phone |
| Custom vibe patterns | `vibes_enqueue_custom_pattern()` | More expressive haptics |
| Internationalization | i18n APIs | Locale-aware formatting and strings |
| App Glance | `app_glance_*` | Launcher / glance surface integration |
| Compass | `CompassService` | Heading data, likely via binding source |
| Images / bitmap | Pebble bitmap APIs | Already noted in older planning docs |

---

## Recommended Implementation Order

| Phase | Feature | Effort | What It Unlocks |
|-------|---------|--------|-----------------|
| 1 | HTTP / webhook run type | High | API-driven apps, webhooks, home automation, weather |
| 2 | Builder request + response mapping UI | Medium | Makes API flows usable without hand-editing JSON |
| 3 | Device / sensor bindings | Medium | Battery, BT, steps, motion-aware apps |
| 4 | HTTP hardening | Medium | Allowlists, timeouts, credentials, error handling |
| 5 | Wakeups / background work | High | Scheduled sync, delayed refresh, offline-friendly flows |

**Rationale**:
- Variables, storage, hooks, and timers are already in place.
- That means HTTP can land directly into `var.*` and `storage.*` without needing a separate state system first.
- Builder support should follow immediately after runtime support so the feature is actually authorable.
- Device bindings are still important, but general HTTP now unlocks a wider class of apps faster.
