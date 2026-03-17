# Screen Presentation Plan

## Goal

Stop treating `draw` as a separate universe.

Long term, `menu`, `card`, and `scroll` should stay the canonical screen types, while presentation becomes a renderer choice:

- `native`
- `custom`

That lets a screen keep its real semantics:

- menu items
- card actions
- scroll content
- navigation rules
- bindings

while choosing how it is visually rendered.

## Core Idea

Instead of:

- native screens for real app behavior
- draw screens for custom visuals

use:

- native semantics as the source of truth
- draw/canvas as an optional presentation layer

Example:

```json
{
  "type": "menu",
  "presentation": "custom",
  "canvas": {
    "template": "header_list"
  },
  "motion": {
    "tracks": [
      { "target": "header", "preset": "slide_up" },
      { "target": "items", "preset": "slide_left", "staggerMs": 100 }
    ]
  },
  "items": [
    { "id": "play", "label": "Play" },
    { "id": "settings", "label": "Settings" }
  ]
}
```

This is still a menu logically.

It just renders through a custom animated template instead of a native `MenuLayer`.

## Why This Is Better

- no split brain between "real screens" and "draw screens"
- navigation and bindings stay canonical
- only the screens that need polish become custom
- fallback to native is easy
- builder mental model gets simpler

## Renderer Model

### Native

Use real Pebble UI primitives:

- `MenuLayer`
- `TextLayer`
- `ScrollLayer`
- `ActionBarLayer`
- native `ActionMenu`

### Custom

Compile the same screen data into draw/canvas steps using template-specific layout and motion.

Examples:

- `menu` -> `header_list`
- `card` -> `hero_card`
- `scroll` -> `reader`

## Important Tradeoff

When `presentation = custom`, the screen is no longer a true native `MenuLayer` or `ScrollLayer`.

It preserves:

- screen semantics
- item/action meaning
- bindings
- navigation behavior

But it does not preserve exact native widget behavior.

That is acceptable as long as the builder labels it clearly.

## Recommended Direction

1. Keep `type` as the canonical behavior model.
2. Add `presentation = native | custom`.
3. Add default custom templates per screen type.
4. Compile templates from existing screen data.
5. Let users override motion and selected layout details per screen.

## First Practical Step

Do not make custom presentation completely freeform first.

Start with one useful template per screen class:

- menu: `header_list`
- card: `hero_card`
- scroll: `reader`

That gives expressive animated screens without abandoning the current schema.

## Relationship To Motion Work

See [MOTION_AUTHORING_PLAN.md](/Users/sam/dev/pebble/pebble-stewie/docs/MOTION_AUTHORING_PLAN.md).

That document covers:

- semantic motion authoring
- compilation into native draw steps
- advanced raw fallback

This document is the product-level shape:

- keep native screen semantics
- make presentation swappable
- let draw become a renderer mode, not a separate app concept
