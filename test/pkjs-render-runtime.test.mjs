import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const renderRuntime = require('../src/pkjs/render-runtime.js')
const constants = require('../src/pkjs/constants.js')

function createStorageAdapter(initial = {}) {
  const store = { ...initial }
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null
    },
    setItem(key, value) {
      store[key] = String(value)
    },
    removeItem(key) {
      delete store[key]
    },
    dump() {
      return { ...store }
    }
  }
}

test('graph storage namespace prefers explicit ids and hashes graph fallback', () => {
  assert.equal(
    renderRuntime.getGraphStorageNamespace({ storageNamespace: ' Demo Namespace ' }),
    'demo_namespace'
  )

  const graph = {
    entryScreenId: 'root',
    screens: {
      root: { id: 'root', type: 'menu' }
    }
  }

  const namespaceA = renderRuntime.getGraphStorageNamespace(graph)
  const namespaceB = renderRuntime.getGraphStorageNamespace(graph)

  assert.equal(namespaceA, namespaceB)
  assert.match(namespaceA, /^graph_[0-9a-f]{8}$/)
})

test('graph storage map reads objects, ignores invalid payloads, and enforces size limits', () => {
  const graph = {
    storageNamespace: 'runtime',
    entryScreenId: 'root',
    screens: {
      root: { id: 'root', type: 'menu' }
    }
  }
  const storageKey = renderRuntime.getGraphStorageKey(graph)
  const adapter = createStorageAdapter()

  assert.equal(renderRuntime.writeGraphStorageMap(adapter, graph, { count: '1' }), true)
  assert.deepEqual(renderRuntime.readGraphStorageMap(adapter, graph), { count: '1' })

  adapter.setItem(storageKey, '[1,2,3]')
  assert.deepEqual(renderRuntime.readGraphStorageMap(adapter, graph), {})

  adapter.setItem(storageKey, '{oops')
  assert.deepEqual(renderRuntime.readGraphStorageMap(adapter, graph), {})

  assert.equal(
    renderRuntime.writeGraphStorageMap(adapter, graph, { body: 'x'.repeat(5000) }),
    false
  )

  assert.equal(renderRuntime.writeGraphStorageMap(adapter, graph, {}), true)
  assert.equal(adapter.getItem(storageKey), null)
})

test('applyScreenBindings renders templates and reports the shortest live refresh', () => {
  const result = renderRuntime.applyScreenBindings(
    {
      id: 'root',
      type: 'menu',
      titleTemplate: 'Hi {{var.user}}',
      bodyTemplate: 'Stored {{storage.task}} in {{clock.localTime}}',
      bindings: {
        clock: { source: 'device.time', live: true, refreshMs: 30000 },
        storedTask: { source: 'storage.task', live: true, refreshMs: 1000 }
      },
      items: [{ id: 'one', labelTemplate: '{{storage.task}}' }],
      actions: [{ id: 'go', labelTemplate: 'Count {{var.count}}' }]
    },
    {
      vars: { user: 'Sam', count: 3 },
      storage: { task: 'Laundry' },
      timerRemaining: 9,
      now: new Date('2025-01-02T03:04:05.000Z')
    }
  )

  assert.equal(result.screen.title, 'Hi Sam')
  assert.match(result.screen.body, /^Stored Laundry in /)
  assert.equal(result.screen.items[0].label, 'Laundry')
  assert.equal(result.screen.actions[0].label, 'Count 3')
  assert.equal(result.refreshMs, 1000)
})

test('prepareScreenForRender applies voice affordances and agent fallback items', () => {
  const voiceScreen = renderRuntime.prepareScreenForRender(
    {
      id: 'voice',
      type: 'menu',
      input: { mode: 'menu_or_voice' },
      items: Array.from({ length: 8 }, (_, index) => ({ id: `item-${index}`, label: `Item ${index}` }))
    },
    { activeGraphSource: 'static' }
  )

  assert.equal(voiceScreen.items.length, 8)
  assert.equal(voiceScreen.items[7].id, constants.VOICE_INPUT_ITEM_ID)

  const agentScreen = renderRuntime.prepareScreenForRender(
    {
      id: 'agent',
      type: 'menu',
      items: []
    },
    { activeGraphSource: 'agent' }
  )

  assert.deepEqual(agentScreen.items, [{ id: 'continue', label: 'Continue', value: 'continue' }])
})
