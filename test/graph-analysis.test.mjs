import test from 'node:test'
import assert from 'node:assert/strict'

import {
  collectGraphReferenceCatalog,
  inferBuilderMetaFromGraph,
  compileVariableDefaults
} from '../apps/screen-builder-web/app/lib/graph-analysis.mjs'

test('collectGraphReferenceCatalog infers variables, storage keys, and undeclared references', () => {
  const graph = {
    entryScreenId: 'root',
    screens: {
      root: {
        id: 'root',
        titleTemplate: 'Hello {{var.user}}',
        bodyTemplate: 'Saved {{storage.token}}',
        bindings: {
          clock: { source: 'device.time', live: true, refreshMs: 30000 },
          persisted: { source: 'storage.cached' }
        },
        items: [
          {
            id: 'item_1',
            labelTemplate: 'Count {{var.count}}',
            run: { type: 'set_var', key: 'mode', value: '{{storage.token}}' }
          }
        ],
        actions: [
          {
            id: 'action_1',
            labelTemplate: 'Ask {{var.question}}',
            run: { type: 'agent_prompt', prompt: 'Use {{var.user}} and {{storage.cached}}' }
          }
        ],
        onEnter: [{ type: 'navigate', condition: { var: 'ready', op: 'eq', value: 'true' } }],
        timer: { run: { type: 'store', key: 'last_seen', value: '{{var.user}}' } }
      }
    },
    _builderMeta: {
      variables: [{ key: 'declared', defaultValue: '', typeHint: 'string' }],
      storageKeys: [{ key: 'saved', typeHint: 'string' }]
    }
  }

  const catalog = collectGraphReferenceCatalog(graph, 'root')

  assert.deepEqual(catalog.bindingKeys, ['clock', 'persisted'])
  assert.deepEqual(catalog.variableKeys, ['count', 'declared', 'mode', 'ready', 'user'])
  assert.deepEqual(catalog.storageKeys, ['cached', 'last_seen', 'saved', 'token'])
  assert.deepEqual(catalog.undeclaredVariableKeys, ['count', 'mode', 'ready', 'user'])
  assert.deepEqual(catalog.undeclaredStorageKeys, ['cached', 'last_seen', 'token'])
})

test('inferBuilderMetaFromGraph promotes inferred references and device bindings into data items', () => {
  const graph = {
    entryScreenId: 'root',
    screens: {
      root: {
        id: 'root',
        titleTemplate: 'Hello {{var.user}}',
        bindings: {
          clock: { source: 'device.time', live: true, refreshMs: 30000 }
        },
        items: [
          { id: 'go', labelTemplate: 'Save {{storage.token}}' }
        ]
      }
    }
  }

  const meta = inferBuilderMetaFromGraph(graph)

  assert.deepEqual(meta.variables, [{ key: 'user', defaultValue: '', typeHint: 'string' }])
  assert.deepEqual(meta.storageKeys, [{ key: 'token', typeHint: 'string' }])
  assert.ok(
    meta.dataItems.some((item) => item.key === 'clock' && item.scope === 'device' && item.source === 'device.time')
  )
})

test('compileVariableDefaults injects missing session defaults and device bindings', () => {
  const graph = {
    entryScreenId: 'root',
    screens: {
      root: {
        id: 'root',
        titleTemplate: 'Hello {{weather.localTime}}',
        onEnter: [{ type: 'set_var', key: 'existing', value: '42' }]
      },
      detail: {
        id: 'detail',
        bodyTemplate: 'Forecast at {{weather.localTime}}'
      }
    },
    _builderMeta: {
      dataItems: [
        { key: 'existing', scope: 'session', defaultValue: '42', typeHint: 'string' },
        { key: 'missing', scope: 'session', defaultValue: 'ready', typeHint: 'string' },
        { key: 'weather', scope: 'device', source: 'device.time', live: true, refreshMs: 60000 }
      ]
    }
  }

  const compiled = compileVariableDefaults(graph)

  assert.deepEqual(compiled.screens.root.onEnter, [
    { type: 'set_var', key: 'missing', value: 'ready' },
    { type: 'set_var', key: 'existing', value: '42' }
  ])
  assert.deepEqual(compiled.screens.root.bindings.weather, {
    source: 'device.time',
    live: true,
    refreshMs: 60000
  })
  assert.deepEqual(compiled.screens.detail.bindings.weather, {
    source: 'device.time',
    live: true,
    refreshMs: 60000
  })
})
