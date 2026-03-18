# Agent Flow Redesign Plan

> Status: proposal only. The current runtime still asks the model for canonical graph JSON directly.

## Goal

Turn the current "LLM generates the per-turn Pebble UI payload" demo into a deterministic, useful agent product that still works on constrained watches.

The current agent flow proves an interesting point:
- SDUI lets the agent answer using Pebble-native affordances instead of plain text alone.
- Suggested replies are one especially useful case, because they let a watch without a mic still continue the conversation.
- More broadly, SDUI lets the agent choose watch-native response shapes like short menus, button actions, voice entry modes, and lightweight local transitions.

But the current architecture makes the model responsible for too much:
- screen structure
- screen type choice
- action layout
- button semantics
- whether the user can reply at all

That is why the experience often degenerates into awkward one-off graphs and generic confirmations.

## Current Problems

### 1. The model owns the per-turn UI payload

There are two agent response shapes in this repo today:
- the current direct PKJS/OpenAI path asks the model to return a canonical graph object for the turn, including `entryScreenId` and `screens`; see [src/pkjs/index.js:90](/Users/sam/dev/pebble/pebble-stewie/src/pkjs/index.js#L90)
- the legacy backend uses an older one-screen turn schema with `screen` plus `input`; see [backend/legacy/openai-sdui-server.mjs](/Users/sam/dev/pebble/pebble-stewie/backend/legacy/openai-sdui-server.mjs)

So "the model generates a graph" is true for the current direct runtime path, but "the model generates the per-turn UI payload" is the more accurate umbrella description across the repo.

Effects:
- responses are nondeterministic
- the agent invents UI structures instead of staying inside a product flow
- button semantics drift turn to turn
- the model can accidentally remove the user's way to continue or reply

### 2. Reply capability is not system-owned

The runtime can inject `Speak response` for `voice` and `menu_or_voice`, but that is still dependent on the returned screen shape and input mode. See [src/pkjs/index.js:485](/Users/sam/dev/pebble/pebble-stewie/src/pkjs/index.js#L485) and [docs/SCREEN_SCHEMA_GUIDE.md:164](/Users/sam/dev/pebble/pebble-stewie/docs/SCREEN_SCHEMA_GUIDE.md#L164).

Effects:
- the user can lose the primary conversational affordance
- no-mic watches do not have a strong system fallback

### 3. The builder only models "send text to agent"

The builder template and run targets currently treat agent flows as just `dictation -> agent_prompt` or button -> `agent_prompt`. See [apps/screen-builder-web/app/lib/graph-templates.js:17](/Users/sam/dev/pebble/pebble-stewie/apps/screen-builder-web/app/lib/graph-templates.js#L17).

Effects:
- there is no authorable concept of allowed agent states
- there is no steering model
- there is no stable shell around agent turns

### 4. The scroll action affordance is unclear

The "action menu dot" is literally a black circle drawn in the native layer when drawer actions exist. See [src/c/stewie/ui.c:6](/Users/sam/dev/pebble/pebble-stewie/src/c/stewie/ui.c#L6).

Effects:
- it looks like decoration, not an action
- users cannot infer what pressing Select will do

### 5. Card action icons are too weak to carry semantics

The watch only exposes six bitmap icons: play, pause, check, x, plus, minus. See [src/c/stewie/input.c:7](/Users/sam/dev/pebble/pebble-stewie/src/c/stewie/input.c#L7) and [resources/icons/action_check.png](/Users/sam/dev/pebble/pebble-stewie/resources/icons/action_check.png).

Effects:
- icons are overloaded
- actions feel arbitrary
- model-generated button bars become visually strange fast

## Product Direction

The useful product is:

- the system owns the watch chrome
- the model fills a constrained turn object
- the runtime compiles that turn object into canonical graph screens
- the builder defines the shell, state machine, and allowed transitions

The key shift is:

`agent -> constrained turn data -> runtime compiler -> Pebble UI`

not:

`agent -> arbitrary per-turn UI payload`

## Design Principles

### 1. The model should choose content, not UI structure

The agent can decide:
- what it wants to say
- whether it is asking, answering, confirming, or offering choices
- which suggested replies are relevant
- which builder-defined state should come next

This still preserves the real advantage of SDUI:
- the agent can respond with Pebble-native affordances
- it just should do so through a constrained vocabulary of affordances rather than arbitrary screen authorship

The agent should not decide:
- card vs menu vs scroll in the general case
- whether the reply affordance exists
- button slots or icons
- whether system navigation is present

### 2. Reply must always exist

Every agent-owned turn must provide a system-owned reply path independent of model output.

Reply policy:
- if dictation is supported, offer `Reply`
- if dictation is not supported, offer a deterministic reply composer or canned reply set
- if watch-side text entry is too weak, offer `Reply on Phone`

### 3. Builder authors should define the rails

The builder should define:
- allowed turn kinds
- allowed state ids / transitions
- which canned actions are always shown
- whether freeform reply is allowed
- whether phone handoff is allowed

### 4. Agent flows should default to explicit text affordances

For agent experiences, prefer labeled menu items over icon-only action bars.

## Proposed Architecture

### A. Introduce a constrained agent turn schema

Add a new response format for agent turns that is smaller than canonical graph JSON.

Example:

```json
{
  "kind": "choose_one",
  "title": "Coffee Run",
  "body": "Want your usual order?",
  "suggestions": [
    { "id": "yes", "label": "Yes" },
    { "id": "change", "label": "Change It" },
    { "id": "later", "label": "Later" }
  ],
  "allowReply": true,
  "nextState": "confirm_order"
}
```

Supported `kind` values in v1:
- `answer`
- `ask`
- `choose_one`
- `confirm`
- `loading`
- `error`

Optional fields:
- `title`
- `body`
- `suggestions`
- `allowReply`
- `nextState`
- `meta` for future server-side tool use, not watch rendering

Non-goals for v1:
- arbitrary nested screens
- arbitrary action bars
- arbitrary timers/hooks from the model
- arbitrary draw screens

### B. Compile constrained turns into canonical graphs

Do not replace the existing renderer. Add a small compiler in PKJS that converts an agent turn into a canonical graph before render.

Why:
- preserves the current watch runtime surface
- keeps the transport small and deterministic
- allows gradual rollout while leaving imported/builder-authored graphs intact

Compilation policy:
- `answer` -> card or scroll, depending on body length
- `ask` -> menu with system `Reply`
- `choose_one` -> menu with suggestions plus system `Reply`
- `confirm` -> menu or card with fixed confirm/cancel semantics
- `error` -> card with retry/back
- `loading` -> deterministic loading card

### C. Make system controls non-negotiable

Every agent-owned compiled graph should get fixed system controls as policy, not model output.

Required controls:
- `Reply`
- `Back`

Optional controls:
- `More`
- `Reset`
- `Open on Phone`

Rules:
- system controls are injected after model output
- system controls use reserved ids
- system controls are rendered consistently every turn
- agent suggestions never overwrite them

### D. Builder-defined agent shells

Add an "Agent Flow" concept to the builder instead of only `agent_prompt`.

The builder should define:
- entry prompt
- allowed turn kinds
- allowed `nextState` ids
- system controls policy
- reply capture policy
- fallback behavior when agent output is invalid

Initial mental model:
- agent flow = deterministic shell + model-authored content slots

### E. State steering instead of raw graph generation

Builder authors should be able to define named states such as:
- `intro`
- `question`
- `confirm`
- `result`
- `handoff`
- `error`

The model can suggest `nextState`, but only from an allowlist. The runtime validates it before use.

This gives us:
- deterministic product structure
- easier testing
- easier analytics
- less UI drift

### F. Normalize tool, web, and webhook results into typed blocks

If the agent gains web search or future webhook / `http` capability, it should not return raw JSON or arbitrary UI structure to the watch.

Instead:
- tools return structured result data
- the runtime or backend normalizes that data into a small set of typed blocks
- the watch renders those typed blocks in a known way

Recommended block types:
- `highlight`
- `status`
- `fact_list`
- `choice_list`
- `weather`
- `timer`
- `map`
- `link_handoff`

Example future turn shape:

```json
{
  "kind": "answer",
  "title": "Weather",
  "body": "It will rain this afternoon.",
  "blocks": [
    { "type": "weather", "location": "Chicago", "temp": 52, "condition": "Rain" },
    { "type": "fact_list", "items": ["Rain starts at 3 PM", "Wind 12 mph"] }
  ],
  "allowReply": true
}
```

This is the key rule for future web search:
- the model or tool layer may discover arbitrary data
- the watch only renders normalized result blocks

This is also the right fit for future webhook support:
- use webhook / `http` calls to gather data
- map the response into typed blocks or existing `var.*` / `storage.*`
- do not attempt generic JSON-to-watch rendering

### G. Consider a constrained flow mode for multi-stage tasks

The strongest case for graph-like agent output is multi-stage input.

Examples:
- set a reminder
- collect several fields before submit
- branch based on an earlier answer
- confirm before taking an action

For those cases, a small temporary interaction graph can be useful.

But the useful version is not:
- arbitrary model-authored UI graphs

It is:
- a constrained interaction flow plan that the runtime compiles into canonical SDUI

Recommended split:
- normal answer turns use constrained single-turn payloads
- multi-stage tasks may use a constrained `flow` mode

Recommended `flow` constraints:
- small max node count
- fixed node kinds such as `ask_text`, `ask_choice`, `confirm`, `error`, `done`
- system-owned navigation and reply controls
- runtime validation of allowed transitions
- builder-defined or runtime-defined node templates

So graph generation can still exist as a targeted capability for multi-step collection and branching, but it should be treated as constrained interaction planning, not freeform screen authorship.

## Reply Strategy

### Always-available reply

Agent turns should never depend on the model to expose user input.

System reply behavior:
- if watch supports dictation: `Reply` opens dictation
- if watch does not support dictation: `Reply` opens a deterministic canned-reply screen
- if phone companion is available and configured: `Reply on Phone` can be offered as a stronger fallback

### Suggested replies stay valuable

Suggested replies are still a differentiator, especially for no-mic devices.

But they should be framed as:
- agent suggestions layered on top of a guaranteed reply path

not:
- the only way to continue

## Visual / Interaction Changes

### 1. Remove the scroll drawer dot

The current scroll action hint is not self-explanatory. See [src/c/stewie/ui.c:6](/Users/sam/dev/pebble/pebble-stewie/src/c/stewie/ui.c#L6).

Replace it with one of:
- explicit final row: `More Actions`
- explicit footer text: `Select: More`
- long-press Select for secondary actions, with visible label in body copy

Recommendation:
- for agent flows, avoid hidden action drawers entirely
- prefer visible menu rows

### 2. Reduce icon dependence in agent flows

For agent-owned screens:
- prefer menu items with text
- avoid card action bars by default

For non-agent local flows:
- keep action bar support, but refresh the six bitmap resources with a cleaner 1-bit icon set

Recommendation:
- ship a new icon pack, but do not rely on icons to make agent conversations usable

### 3. Normalize conversational screen patterns

Agent turns should feel like a product, not improvised watch apps.

Default patterns:
- short answer -> card
- long answer -> scroll
- choice -> menu
- confirmation -> menu with `Confirm` and `Cancel`

## Bobby Cues Worth Borrowing

The `bobby-assistant` repo suggests a few patterns that are stronger than our current agent SDUI loop.

### 1. Stable conversation surface

Bobby keeps a dedicated conversation session window instead of replacing the whole interaction with a fresh one-off UI every turn. See [session_window.c:129](/Users/sam/dev/pebble/bobby-assistant/app/src/c/converse/session_window.c#L129) and [message_layer.c:38](/Users/sam/dev/pebble/bobby-assistant/app/src/c/converse/segments/message_layer.c#L38).

Useful takeaway:
- for agent-heavy experiences, a transcript shell may feel more natural than full-screen replacement every turn

### 2. Typed widgets for tool results

Bobby does not treat tool results as freeform UI generation. Its conversation manager appends typed widgets such as weather, timer, highlight, and map. See [conversation_manager.c:156](/Users/sam/dev/pebble/bobby-assistant/app/src/c/converse/conversation_manager.c#L156).

Useful takeaway:
- future web search and webhook results here should probably become typed blocks/widgets, not raw SDUI authored by the model

### 3. Explicit but lightweight edge cues

Bobby uses content indicators plus a dedicated button bitmap on the edge of the screen rather than a mystery dot inside the content area. See [session_window.c:152](/Users/sam/dev/pebble/bobby-assistant/app/src/c/converse/session_window.c#L152) and [session_window.c:185](/Users/sam/dev/pebble/bobby-assistant/app/src/c/converse/session_window.c#L185).

Useful takeaway:
- if we need a secondary-action cue, it should read like watch chrome, not content decoration

### 4. Tool honesty in the prompt

Bobby explicitly tells the model not to claim actions unless tools actually ran. See [system_prompt.go:128](/Users/sam/dev/pebble/bobby-assistant/service/assistant/system_prompt.go#L128).

Useful takeaway:
- our constrained agent mode should carry the same rule, especially once tool calls or webhook actions exist

## Runtime Validation Rules

When agent output is invalid, do not drop into arbitrary fallback prose if avoidable.

Validation rules:
- reject unknown `kind`
- reject `nextState` outside the allowlist
- clamp suggestion count and label length
- ensure system reply controls are still present

Failure behavior:
- compile a deterministic error card
- keep `Reply` and `Back`

## Builder Changes

### New concepts

Add:
- `Agent Flow` template
- `Agent State` definitions
- `Turn Kind` policy
- `System Controls` policy
- `Reply Mode` policy

Keep:
- `agent_prompt` as a low-level escape hatch

But de-emphasize it in the main UX.

### Preview changes

Builder preview should support:
- mocking an agent turn payload
- toggling dictation availability on/off
- previewing system-injected controls
- previewing invalid-turn fallback

## Migration Strategy

### Phase 1: Constrained agent mode beside current graph mode

Add a new agent mode without deleting the old one yet.

Implementation:
- keep canonical graph rendering
- add turn compiler
- add new prompt/instructions for constrained turns
- gate behind a config flag or separate start path

### Phase 2: Make constrained mode the default

Once stable:
- use constrained turns for `agent_prompt`
- keep arbitrary graph generation as experimental / debug only

### Phase 3: Add typed tool-result blocks

Before we add broad web search or webhook UX, add typed result blocks that the runtime can render deterministically.

Targets:
- highlight / status
- fact list
- weather
- timer
- map or phone handoff

Consideration:
- keep a constrained `flow` mode on the roadmap for multi-stage agent tasks, but do not make it the default answer path

### Phase 4: Builder-first agent authoring

Add builder support for:
- agent flow template
- states
- allowed transitions
- reply policy

### Phase 5: Remove hidden scroll affordances from agent flows

For agent-generated or agent-compiled screens:
- no drawer dot
- no hidden menu actions
- no icon-first card bars

## Concrete File Touchpoints

Likely implementation areas:

- [src/pkjs/index.js](/Users/sam/dev/pebble/pebble-stewie/src/pkjs/index.js)
  - replace full-graph prompt with constrained turn prompt
  - add turn compiler
  - inject system reply controls
  - validate `nextState`

- [backend/legacy/openai-sdui-server.mjs](/Users/sam/dev/pebble/pebble-stewie/backend/legacy/openai-sdui-server.mjs)
  - if kept, move it to the same constrained turn contract

- [apps/screen-builder-web/app/lib/graph-templates.js](/Users/sam/dev/pebble/pebble-stewie/apps/screen-builder-web/app/lib/graph-templates.js)
  - replace the current "Voice Agent" starter with an agent-shell template

- [apps/screen-builder-web/app/hooks/use-graph-editor.js](/Users/sam/dev/pebble/pebble-stewie/apps/screen-builder-web/app/hooks/use-graph-editor.js)
  - add builder editing support for agent flow configuration

- [src/c/stewie/ui.c](/Users/sam/dev/pebble/pebble-stewie/src/c/stewie/ui.c)
  - remove or replace the scroll dot affordance

- [src/c/stewie/input.c](/Users/sam/dev/pebble/pebble-stewie/src/c/stewie/input.c)
  - keep action bar support for local flows, but do not rely on it for agent UX

- [resources/icons](/Users/sam/dev/pebble/pebble-stewie/resources/icons)
  - redraw the six icon bitmaps if action bars remain in use

## Recommended First Milestone

The first milestone should not be webhooks or tool calling.

It should be:
- constrained `Agent Turn v1`
- system-owned `Reply`
- deterministic compiler to canonical graph
- no hidden action drawer in agent flows

The second milestone should be:
- typed tool-result blocks for web search and future webhook / `http` data
- prompt rules that prevent fake tool claims

That would immediately make the product more coherent without needing a full builder rewrite first.

## Success Criteria

We should consider this redesign successful when:
- every agent turn preserves a reply path
- agent UI no longer changes structure unpredictably turn to turn
- builders can define allowed conversational rails
- no-mic watches still feel conversational
- web and tool results render as typed blocks, not arbitrary graphs
- users understand secondary actions without discovering a mystery dot
- agent flows rely on readable text controls more than ambiguous icons
