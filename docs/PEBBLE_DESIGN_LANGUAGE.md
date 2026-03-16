# Pebble Design Language Notes

This is a paraphrased reference distilled from a Pebble design talk transcript. It preserves the practical rules and intent, not the original wording.

## Core Thesis

Pebble's visual identity came from constraints:

- 64-color e-paper
- very small screens viewed at a distance
- readability in both bright outdoor light and dim indoor light
- animation capabilities that are stronger than people expect from e-paper

The result is a design language that optimizes for glanceability first, then uses motion and color for emphasis.

## Visual Language

### 1. Contrast first

- Judge colors by luminance, not just hue. If two colors collapse to similar gray values, they will compete on-device.
- Default text to the highest-contrast pair available, usually black on white or white on black.
- Use color as an accent, category marker, or emphasis, not as the main way body text stays readable.
- Prefer thick strokes and bold silhouettes over fine detail.

### 2. Small palette, strong graphics

- Pebble's color work was inspired by pop art, early comics, and op art: few colors, bold shapes, repeatable patterns, and deliberate graphic simplification.
- Graphics should read instantly at a glance.
- Icons work best as self-contained black-and-white units that can survive over changing backgrounds.

### 3. Design for the pixel grid

- Avoid hairlines, shallow diagonals, and delicate curves. Limited antialiasing makes them shimmer or vary in thickness.
- Prefer angular or pixel-oriented forms for type, icons, and watchface geometry.
- Do not fake smooth bezier curves with lots of tiny stepped segments just because the screen can technically draw them. It weakens the language instead of strengthening it.

## Motion Language

Motion should feel simple, graphic, and directional. On Pebble hardware, animation is partly delightful because it exceeds the user's expectation of what the display can do, so movement should be used intentionally.

### Transition families

- `stretch`: use when an element travels within the same space. The deformation adds directionality and makes movement easier to parse.
- `dot`: use when moving between major system areas or when an incoming event interrupts the current context.
- `morph`: use when moving between closely related states. Keeping a visual anchor on-screen reduces disorientation on a tiny display.

### Motion rules

- Reuse geometry across states when possible. Let icons scale, stretch, or morph instead of swapping to unrelated shapes.
- Keep movement short and legible. Motion should explain destination, hierarchy, or interruption.
- Favor semantic motion families over ornamental effects. The point is clarity with personality, not spectacle.

## Round Screen Layout

Round screens change how text is read.

- On rectangular screens, people naturally anchor from the upper-left reading edge.
- On round screens, the eye tends to anchor toward the center first.
- That means the most valuable text space is the horizontal middle, or "equator," of the display.

### Practical rules

- Center-align text so the layout agrees with the form factor.
- Wrap text to the circular bounds instead of pretending the display is still a rectangle.
- Paginate instead of line-scrolling. Reflowing text on every button press makes the content feel unstable.
- Keep focus fixed near the center while surrounding content moves behind it.
- Expand detailed text only for the focused item. Near the clipped top and bottom edges, prefer icons or abbreviated information.

## Anti-Patterns

- Low-contrast multicolor UI where different hues share similar luminance
- Thin strokes or shallow-angle line art that depends on smooth antialiasing
- Complex fake curves built from many tiny steps
- Decorative motion that does not communicate direction or state change
- Line-by-line scrolling on round layouts when pagination would preserve structure

## What This Means For Stewie

- Builder previews should bias toward bold, high-contrast Pebble-native presentation.
- Motion presets should model semantic families like `stretch`, `dot`, and `morph` before adding more experimental effects.
- Round-screen previews should preserve centered focus, pagination, and clipped-edge awareness.
- New UI primitives should be judged first by glanceability, then by richness.
