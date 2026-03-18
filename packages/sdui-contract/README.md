# @pebble/sdui-contract

Shared contract package for the Pebble Stewie watch runtime, PKJS runtime, and web builder.

## What it includes

- schema constants and version registry
- canonical graph normalization and migration
- run normalization and action encoding helpers
- template and runtime value helpers
- draw payload codec
- semantic motion compiler for draw screens
- builder field definitions derived from the current schema descriptor

## Main exports

- `constants`
- `schemaRegistry`
- `textUtils`
- `runtimeValues`
- `drawCodec`
- `motionCompiler`
- `screenActions`
- `graphSchema`
- `builderElements`

## Notes

- The package is published as CommonJS.
- ESM consumers can use default interop (`const contract = mod.default || mod`).

## Version discovery

```js
const contract = require('@pebble/sdui-contract')

console.log(contract.schemaRegistry.listSchemaVersions())
console.log(contract.schemaRegistry.getLatestSchemaVersion())
```

## Example

```js
const contract = require('@pebble/sdui-contract')

const latest = contract.schemaRegistry.getLatestSchemaVersion()
const normalized = contract.graphSchema.normalizeCanonicalGraph(rawGraph, latest)
const spec = contract.builderElements.deriveBuilderSpecFromGraph(normalized)
const drawing = contract.motionCompiler.compileMotionToDrawing({
  version: 1,
  playMode: 'once',
  background: 'grid',
  timelineMs: 1200,
  tracks: []
}).drawing
```

`normalizeCanonicalGraph()` migrates older supported schema versions forward to the target version.
