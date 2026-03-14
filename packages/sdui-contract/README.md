# @pebble/sdui-contract

Shared SDUI contract package for Pebble Stewie runtime and web builder.

## Exports

- `constants`: runtime limits/enums (`MAX_*`, slots, icons, schema version)
- `schemaRegistry`: versioned schema descriptors used by normalization/builders
- `textUtils`: sanitize/limit helpers
- `screenActions`: card action normalization/encoding
- `graphSchema`: canonical graph normalization (`normalizeCanonicalGraph`)
- `builderElements`: canonical form field descriptors for schema builders

## Example

```js
const contract = require('@pebble/sdui-contract')

const normalized = contract.graphSchema.normalizeCanonicalGraph(rawGraph)
const spec = contract.builderElements.deriveBuilderSpecFromGraph(normalized)
```
