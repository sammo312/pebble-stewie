# screen-builder-web

Next.js builder app for authoring versioned Pebble SDUI graph schemas.

## Core behavior

- Form fields are derived from `builderElements.deriveBuilderSpecFromGraph`.
- Import validates and normalizes with `graphSchema.normalizeCanonicalGraph`.
- Export is only enabled when normalization succeeds.

## Run

```bash
pnpm install
pnpm --filter screen-builder-web dev
```

## Contract check

```bash
pnpm --filter screen-builder-web check-contract
```
