# screen-builder-web

Next.js builder for authoring and previewing Pebble Stewie canonical graphs.

## What it covers

- `pebble.sdui.v1.2.0` import, normalization, and export
- screen types: `menu`, `card`, `scroll`, `draw`
- run types: navigation, variables, storage, agent actions, effects, dictation
- lifecycle hooks, timers, bindings, storage namespaces
- semantic motion authoring for draw screens with compiled native draw output
- emulator-backed preview plus local static preview rendering

## Run

```bash
pnpm install
pnpm --filter screen-builder-web dev
```

The dev server runs on port `3000`.

## Useful commands

```bash
pnpm --filter screen-builder-web build
pnpm --filter screen-builder-web start
pnpm --filter screen-builder-web check-contract
```

## Contract behavior

- imports are normalized through `graphSchema.normalizeCanonicalGraph`
- imports accept either a raw graph or an object shaped like `{ "graph": ... }`
- builder field definitions come from `builderElements.deriveBuilderSpecFromGraph`
- builder metadata is preserved when present and inferred when absent
- exports always target the latest canonical schema version
- copy/download export remains disabled until the graph normalizes cleanly
