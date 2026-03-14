# Stewie Screen Builder — Redesign Plan

**Goal**: Make the builder feel intuitive, fast, and approachable — like the best parts of Figma, Notion, and Lucidchart — while respecting that this is a specialized tool for building Pebble watch app flows.

---

## 0. Theme Foundation

Before more visual redesign work, the builder should adopt the **native shadcn theming model** documented at [shadcn/ui theming](https://ui.shadcn.com/docs/theming).

### Required baseline

- Keep `components.json` on `cssVariables: true` and use a neutral base color.
- Move all app colors in `app/globals.css` to the standard shadcn variable shape:
  - `:root { ... }`
  - `.dark { ... }`
  - `@theme inline { ... }`
- Stop hardcoding bespoke palette values in Tailwind theme tokens where shadcn semantic tokens already exist.
- Default the builder shell to `.dark` so the product has a single intentional dark theme instead of a custom "blue mode."

### Why this matters

- New shadcn components will drop in without visual mismatch.
- We stop maintaining a parallel hand-rolled token system.
- Future restyling becomes variable-driven instead of component-by-component repainting.
- The UI will look more stable and less improvised because spacing, borders, focus states, and muted surfaces come from one system.

### Immediate consequences for the builder

- `background`, `card`, `popover`, `border`, `muted`, `ring`, and `destructive` become the source of truth.
- Existing custom aliases such as `panel`, `panel-soft`, `line`, `ink`, and `ink-dim` should be derived from those semantic variables, not defined separately from scratch.
- Preview, inspector, toolbar, dialogs, and node cards should all read from the same semantic theme.

---

## 1. Current Pain Points

| Area | Problem |
|------|---------|
| **Layout** | Preview + Inspector are crammed into a fixed 22rem right column. On smaller screens this leaves almost no canvas space. |
| **Toolbar** | Five grouped card clusters with dropdowns + buttons. Visually noisy and hard to scan. |
| **Onboarding** | Users land on a minimal default graph with no explanation of what to do next. |
| **Persistence** | No save/load — only import/export JSON. Losing work is easy. |
| **Inspector** | Dense form fields, deeply nested collapsible sections. Editing menu items and actions requires many clicks. |
| **Emulator** | ~25s boot with only a pulsing dot. Users don't know if it's working. |
| **Undo/Redo** | None. Accidental deletions are permanent. |
| **Discoverability** | No keyboard shortcut hints, no contextual help, no tooltips on limits/validation. |
| **Search** | No way to find a screen by name in a complex graph. |
| **Graph readability** | Nodes are wide (300px), edges overlap, layout only resets globally. |

---

## 2. Layout Redesign

### Current
```
┌──────────────────────────────────────────────────────┐
│ Toolbar (full width, ~60px tall)                     │
├──────────────────────────────┬───────────────────────┤
│                              │ Preview (fixed 22rem) │
│   Canvas (flex-1)            ├───────────────────────┤
│                              │ Inspector (flex-1)    │
├──────────────────────────────┴───────────────────────┤
│ Status bar                                           │
└──────────────────────────────────────────────────────┘
```

### Proposed: Tab-Panel Sidebar
Take a cue from **Figma's right panel** — a single collapsible sidebar with tabs, plus a floating emulator that can be docked or minimized.

```
┌──────────────────────────────────────────────────────┐
│ Slim toolbar (actions + breadcrumb)                  │
├────┬─────────────────────────────────┬───────────────┤
│    │                                 │  [P] [I] [S]  │ ← tab icons
│ L  │        Canvas (flex-1)          │───────────────│
│ i  │                                 │  Tab content  │
│ s  │                                 │  (one panel   │
│ t  │                                 │   at a time)  │
│    │                                 │               │
├────┴─────────────────────────────────┴───────────────┤
│ Status bar                                           │
└──────────────────────────────────────────────────────┘
```

**Key changes:**

- **Left rail** (icon-only, ~48px): Screen list with type icons. Click to select + focus. Drag to reorder. Equivalent to Figma's layers panel. Always visible so users have an anchor.
- **Right sidebar** (~320px, collapsible): Three tabs:
  - **[P] Preview** — Emulator
  - **[I] Inspector** — Edit selected node
  - **[S] Schema** — Live JSON view of the current graph (replaces the export half of the dialog)
- **Canvas** gets all remaining space.
- Sidebar **auto-opens Inspector** when a node is selected (like Figma property panel) and remembers the last manual tab choice otherwise.
- `Cmd+\` toggles sidebar. `Cmd+P` opens Preview. `Cmd+I` opens Inspector.
- On narrow viewports (<1024px), sidebar becomes a **slide-over drawer** instead of an inline panel.

**Why this is better:** Users get more canvas room by default, and the tab model is familiar from every design tool they already use. The left rail gives spatial orientation even when the graph is zoomed out.

---

## 3. Toolbar Simplification

### Current toolbar (5 grouped cards, ~8 controls)
Entry Screen dropdown | Add Screen dropdown + button | Add Logic dropdown + button | Stats badges | Actions (delete, reset, import/export)

### Proposed: Two-tier slim header

```
┌──────────────────────────────────────────────────────┐
│ [logo] Stewie        [search]      [?] [undo] [redo]│
│────────────────────────────────────────────────────── │
│ + Screen  + Logic  |  Entry: [root ▼]  |  Export  ⋮  │
└──────────────────────────────────────────────────────┘
```

- **Row 1**: Brand, global search (Cmd+K), help toggle, undo/redo.
- **Row 2**: Primary actions (add screen, add logic — each a single button that opens a **small dropdown menu**, not a select+button pair), entry screen selector, export button, overflow menu (delete, reset layout, keyboard shortcuts).
- Stats (screen count, link count, unmapped) move to the **status bar** where they were already partially duplicated.
- **Valid/Invalid** badge becomes a small icon in the status bar — green check or red warning — with a tooltip explaining the issue.

**Inspiration**: Notion's minimal top bar + Figma's toolbar — actions are discoverable but not visually overwhelming.

---

## 4. Onboarding & Templates

### Empty state
When a user opens the app for the first time (no saved graph in localStorage):

```
┌───────────────────────────────────────────┐
│                                           │
│        Welcome to Stewie                  │
│   Build interactive Pebble watch apps     │
│                                           │
│   [Start from scratch]                    │
│                                           │
│   ── or pick a template ──               │
│                                           │
│   [Simple Menu]   [Card Flow]             │
│   [Voice Agent]   [Timer App]             │
│                                           │
│   [Import JSON]                           │
│                                           │
└───────────────────────────────────────────┘
```

### Templates (bundled JSON presets)
| Template | Description |
|----------|-------------|
| **Simple Menu** | Root menu with 3 items, each linking to a card. Good starting point. |
| **Card Flow** | Linear card-to-card flow with back navigation. Shows action wiring. |
| **Voice Agent** | Menu with voice input, agent_prompt target, response card. Shows the AI loop. |
| **Timer App** | Time-bound card with live bindings, effect (vibe) on completion. |

Each template loads a complete valid graph. Users can modify from there.

### Contextual tips
- On first load, show a brief **coach-mark overlay** (3 steps max):
  1. "This is your screen graph. Drag to connect screens."
  2. "Click a screen to edit it here." (points to sidebar)
  3. "Preview your app live." (points to emulator tab)
- Dismissible, with "Don't show again" saved to localStorage.

---

## 5. Inspector Redesign

### Problems
- Collapsible sections create vertical sprawl.
- Editing a menu item requires: find it in the list, expand section, modify field, repeat.
- Field labels are tiny (10px uppercase) and hard to read.
- No inline validation feedback beyond character counters.

### Proposed changes

#### 5a. Inline editing on canvas nodes
Instead of forcing everything through the inspector, let users **double-click a node title or item label** to edit it directly on the canvas — just like renaming a shape in Figma or Lucidchart.

- Double-click title text on a node card → inline text input with auto-save on blur/Enter.
- Double-click a menu item label → inline edit.
- Tab through fields within a node.
- This covers the 80% case (renaming things) without opening the inspector.

#### 5b. Streamlined inspector sections
Replace nested collapsibles with a **flat, scrollable form** using clear visual grouping (spacing + subtle dividers, no accordions by default):

```
Screen: root
──────────────
Type        [Menu ▼]
Title       [My App___________] 14/30
Body        [Welcome to...____] 42/180
Input       [menu ▼]

Items (3 of 8)
──────────────
 1. [Home_________]  → main_card    [×]
 2. [Settings_____]  → settings     [×]
 3. [Help_________]  → help         [×]
 [+ Add item]

Dynamic Content
──────────────
Template    [{{time.localString}}]
Bindings    [Edit JSON...]

Linked From
──────────────
 settings → back action
```

Key differences from current:
- **Items are editable inline** as a mini table — label + target visible in one row. Click the target pill to change it. Click [x] to remove.
- **Character counts** are right-aligned on the input field (like Twitter/X), not in a separate label.
- **Section headers** are bold text with a line, not interactive accordions. Everything is visible. Scrolling is fine — the panel is a scroll area anyway.
- **Add item** button is at the bottom of the list, not a separate toolbar action.

#### 5c. Quick-edit popover for items/actions
Clicking an item row in the inspector (or on the canvas node) opens a **small popover** with all fields for that item:

```
┌─────────────────────────┐
│ Label  [Home__________] │
│ Value  [home__________] │
│ Action [navigate ▼]     │
│ Target [main_card ▼]    │
│                         │
│         [Delete] [Done] │
└─────────────────────────┘
```

This is faster than expanding a list-card, scrolling through nested fields, and collapsing again.

---

## 6. Emulator Experience

### Problems
- 25-30 second boot with only a pulsing orange dot and status text.
- No progress bar or estimated time.
- If boot fails, error message is cryptic.

### Proposed changes

#### 6a. Progress indicator
Replace the dot + text with a **progress bar** showing named stages:

```
Downloading firmware... ████████░░░░ 65%
Booting PebbleOS...     ████░░░░░░░░ 35%
Launching Stewie...     ░░░░░░░░░░░░ waiting
```

The emulator already emits status messages — map them to progress percentage estimates.

#### 6b. Skeleton preview while booting
Show a **static mockup** of what the current screen will look like on the watch (rendered as HTML/CSS, not in the emulator) while QEMU boots. Label it "Static preview — emulator loading..."

This gives users immediate visual feedback and lets them verify their screen looks right without waiting for the full boot.

#### 6c. Minimizable emulator
Add a **minimize button** on the emulator card. When minimized, it collapses to a small pill in the status bar: `[Emulator: Ready ●]`. Click to re-expand. The emulator keeps running in the background either way.

This lets users reclaim sidebar space when they don't need the live preview.

#### 6d. Keep emulator warm
Cache the WASM instance in a **Web Worker** so it survives tab switches and sidebar tab changes. Currently re-entering the Preview tab might reset state.

---

## 7. Graph & Canvas Improvements

### 7a. Smarter auto-layout
Current `resetLayout` does a naive grid. Replace with a **Dagre or ELK layout** that respects the directed graph structure:
- Entry screen at the top/left.
- Screens flow left-to-right or top-to-bottom based on navigation edges.
- Minimize edge crossings.
- Run target nodes cluster near the screens that reference them.

Offer layout direction toggle: **horizontal** (like Lucidchart's default) or **vertical** (like a mobile flow).

### 7b. Minimap improvements
- Show screen names on minimap nodes (currently blank rectangles).
- Highlight the selected node and the preview node with distinct colors.

### 7c. Node sizing
Reduce default node width from 300px to **240px**. The current nodes are wider than they need to be, especially for simple menus.

### 7d. Quick-add from canvas
Right-click on the canvas → context menu:
- **Add Menu screen**
- **Add Card screen**
- **Add Logic node** (submenu for types)
- **Paste screen** (from clipboard)

This is how Lucidchart and Figma work — users expect to right-click and create.

### 7e. Drag-from-handle to create
When a user drags from a node handle into empty space (no target), auto-create a new screen and connect it. Show a small type picker:

```
Drop to create:
[Menu] [Card] [Logic]
```

This dramatically speeds up flow-building — it's the Lucidchart pattern of "drag to create connected shape."

---

## 8. Persistence & Undo

### 8a. Auto-save to localStorage
Save the current graph to `localStorage` on every change (debounced 500ms). On load, restore from localStorage if present. Show "Saved" indicator in the status bar.

This prevents accidental data loss and eliminates the need to manually export just to preserve work.

### 8b. Undo/Redo
Implement a simple **undo stack** (max 50 entries) on the graph state. Each mutation (add/remove/update screen, wire action, etc.) pushes a snapshot.

- `Cmd+Z` → undo
- `Cmd+Shift+Z` → redo
- Undo/redo buttons in the toolbar

This is table stakes for any editor. Without it, a misclick on "Delete" is catastrophic.

### 8c. Named saves (stretch goal)
Allow users to save named snapshots: `Save as... [my-app-v2]`. List saved snapshots in a dropdown. This is like Figma's version history but simpler.

---

## 9. Command Palette

Add a **Cmd+K command palette** (like Obsidian, Notion, Figma, VS Code):

```
┌──────────────────────────────────────┐
│ 🔍 Type a command or screen name...  │
├──────────────────────────────────────┤
│ > Add menu screen                    │
│ > Add card screen                    │
│ > Add logic node                     │
│ > Go to screen: root                 │
│ > Go to screen: settings             │
│ > Export JSON                        │
│ > Import JSON                        │
│ > Reset layout                       │
│ > Toggle emulator                    │
│ > Keyboard shortcuts                 │
└──────────────────────────────────────┘
```

- Fuzzy search across commands and screen IDs.
- Navigate to a screen by typing its name (pan + select).
- Execute any action without hunting through menus.

This is the single highest-leverage UX addition for power users.

---

## 10. Validation & Feedback

### Current
- Red "unmapped" badges and dots.
- "Invalid" badge in toolbar.
- Toast-style notices that appear and disappear.

### Proposed

#### 10a. Inline field validation
Show validation messages **under the field**, not as badges elsewhere:

```
Title  [This title is way too long for...]
       ↳ 42/30 characters — will be truncated
```

Use orange for warnings (soft limits) and red for errors (hard limits).

#### 10b. Error panel
Add an optional **Errors tab** in the right sidebar (alongside Preview, Inspector, Schema):

```
Errors (3)
──────────
⚠ screen "root" → item "help" has no value or run target
⚠ screen "settings" → title exceeds 30 chars
✕ screen "broken" → references non-existent screen "ghost"
```

Clicking an error selects the relevant node and opens the inspector. This is how VS Code's Problems panel works.

#### 10c. Contextual warnings on nodes
On the canvas, show a small **warning icon** on nodes that have issues (instead of just red dots on individual items). Hovering the icon shows a tooltip with the specific problem.

---

## 11. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Command palette |
| `Cmd+Z` / `Cmd+Shift+Z` | Undo / Redo |
| `Cmd+S` | Force save (with visual confirmation) |
| `Cmd+\` | Toggle right sidebar |
| `Cmd+E` | Toggle emulator |
| `Cmd+I` | Focus inspector |
| `Delete` / `Backspace` | Delete selected node (with confirmation) |
| `Cmd+D` | Duplicate selected screen |
| `Cmd+Enter` | Preview selected screen in emulator |
| `N` | Add new screen (opens type picker) |
| `1` / `2` / `3` | Quick-add Menu / Card / Logic |
| `Escape` | Deselect / close popover |
| Arrow keys | Pan canvas (already works) |
| `?` | Show keyboard shortcut overlay |

Show a **shortcut hint overlay** (`?` key) — a Figma-style translucent modal listing all shortcuts.

---

## 12. Visual Polish

### 12a. Reduce visual noise
- Remove the double-border card-in-toolbar pattern. Use flat grouped buttons instead.
- Reduce the number of uppercase tracking-widened micro-labels. Reserve uppercase for section headers only.
- Unify shadow depths — currently there are 3+ different shadow values.
- Stay within the native shadcn dark theme instead of layering a custom brand palette over it.

### 12b. Improve contrast hierarchy
- **Primary content** (titles, node labels): full white `#eaf2ff`
- **Secondary content** (IDs, metadata): muted `#9eb2d1`
- **Tertiary content** (hints, counts): dim `#6b82a8`
- Currently secondary and tertiary are too similar.

### 12c. Responsive nodes
Node cards should adapt their height to content — currently `min-height: 240px` creates wasted space for simple cards with 1 action.

### 12d. Animation
- Sidebar open/close: 150ms ease-out slide.
- Node selection: subtle scale pulse (1.0 → 1.02 → 1.0, 200ms).
- New node added: fade-in from 0 opacity (150ms).
- Notices: slide-down from toolbar (200ms) instead of hard appearing.

---

## 13. Implementation Priority

### Phase 1 — Foundations (high impact, moderate effort)
1. **Auto-save to localStorage** — prevents data loss, enables everything else.
2. **Undo/redo** — table stakes for an editor.
3. **Toolbar simplification** — declutter the top of the screen.
4. **Left rail (screen list)** — spatial orientation.
5. **Inline editing on nodes** — double-click to rename.

### Phase 2 — Layout & Navigation (high impact, higher effort)
6. **Tabbed right sidebar** — unify preview + inspector + schema.
7. **Cmd+K command palette** — power user accelerator.
8. **Smarter auto-layout** (Dagre/ELK) — readable graphs.
9. **Right-click context menu** on canvas.
10. **Emulator progress bar + skeleton preview**.

### Phase 3 — Polish & Delight (medium impact, moderate effort)
11. **Templates + empty state onboarding**.
12. **Inspector streamlining** (flat form, inline item editing, popovers).
13. **Error panel** in sidebar.
14. **Keyboard shortcut overlay**.
15. **Drag-from-handle to create** new connected screen.

### Phase 4 — Stretch Goals
16. **Named saves / version history**.
17. **Responsive / narrow viewport support**.
18. **Coach-mark walkthrough**.
19. **Node minimap labels**.
20. **Animations and transitions**.

---

## 14. Design Reference Analogues

| Our concept | Figma equivalent | Notion equivalent | Lucidchart equivalent |
|-------------|-----------------|-------------------|----------------------|
| Screen list (left rail) | Layers panel | Page sidebar | Shape library |
| Inspector (right panel) | Design panel | Block properties | Format panel |
| Canvas | Canvas | Page body | Diagram canvas |
| Command palette | Quick actions (`Cmd+/`) | Slash commands / search | Find shapes |
| Node cards | Frames / components | Database cards | Shapes |
| Edge wiring | Prototype connections | Relation properties | Connectors |
| Templates | Community files | Template gallery | Template library |
| Emulator | Prototype preview | — | — |
| Import/Export | Export / Figma file | Export markdown | Export PNG/PDF |

---

## Appendix: Files to Modify

| File | Changes |
|------|---------|
| `app/layout.js` | Default the builder into shadcn dark mode |
| `app/page.js` | New layout structure (left rail, tabbed sidebar) |
| `app/components/toolbar.jsx` | Simplify to slim two-row header |
| `app/components/preview-panel.jsx` | Add progress bar, skeleton preview, minimize |
| `app/components/inspector/inspector-panel.jsx` | Flat form, remove accordions, add popovers |
| `app/components/inspector/screen-inspector.jsx` | Inline item editing, character counters |
| `app/components/canvas-panel.jsx` | Right-click menu, drag-to-create, inline editing |
| `app/components/canvas/pebble-node.jsx` | Reduce width, double-click editing, warning icons |
| `app/hooks/use-graph-editor.js` | Add undo/redo stack, auto-save, command palette state |
| `app/globals.css` | Native shadcn theme variables, updated tokens, animations, responsive breakpoints |
| `app/pebble-emulator.js` | Progress mapping, skeleton mode, minimize state |
| `components.json` | Use shadcn-compatible base color and css variable theming |
| **New**: `app/components/left-rail.jsx` | Screen list panel |
| **New**: `app/components/command-palette.jsx` | Cmd+K dialog |
| **New**: `app/components/sidebar-tabs.jsx` | Tabbed right panel container |
| **New**: `app/components/error-panel.jsx` | Validation error list |
| **New**: `app/lib/undo.js` | Undo/redo stack utility |
| **New**: `app/lib/templates.js` | Bundled starter graphs |
