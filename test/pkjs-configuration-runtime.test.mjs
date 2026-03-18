import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const configurationRuntime = require('../src/pkjs/configuration-runtime.js')

function createDeps(overrides = {}) {
  const events = []
  const store = {}

  const storage = {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null
    },
    setItem(key, value) {
      store[key] = String(value)
    },
    removeItem(key) {
      delete store[key]
    }
  }

  const deps = {
    activateGraph(graph, source, pushHistory) {
      events.push(['activateGraph', graph && graph.entryScreenId ? graph.entryScreenId : '', source, pushHistory])
    },
    defaultOpenAIModel: 'gpt-default',
    getAgentConfig() {
      return { openaiToken: store.token || '' }
    },
    getCurrentScreenId() {
      return ''
    },
    getStaticGraph() {
      return { entryScreenId: 'static-root' }
    },
    importedSchemaStorageKey: 'schema',
    log() {
      events.push(['log', Array.from(arguments).join(' ')])
    },
    normalizeCanonicalGraph(parsed) {
      if (parsed && parsed.entryScreenId && parsed.screens) {
        return { ...parsed, normalized: true }
      }
      return null
    },
    openaiModelStorageKey: 'model',
    openaiTokenStorageKey: 'token',
    renderAgentStatusCard(title, body) {
      events.push(['renderAgentStatusCard', title, body])
    },
    renderImportError(message) {
      events.push(['renderImportError', message])
    },
    resetHistory() {
      events.push(['resetHistory'])
    },
    sanitizeText(value) {
      return value ? String(value).trim() : ''
    },
    storage
  }

  return {
    deps: { ...deps, ...overrides },
    events,
    store
  }
}

test('parseImportedGraphFromJson validates JSON and canonical graphs', () => {
  const { deps } = createDeps()

  assert.deepEqual(
    configurationRuntime.parseImportedGraphFromJson('{oops', deps),
    { graph: null, error: 'Schema JSON is invalid.' }
  )

  assert.deepEqual(
    configurationRuntime.parseImportedGraphFromJson('{"entryScreenId":"root"}', deps),
    {
      graph: null,
      error: 'Schema must be a canonical graph with schemaVersion, entryScreenId, and screens.'
    }
  )

  const parsed = configurationRuntime.parseImportedGraphFromJson(
    '{"schemaVersion":"v1","entryScreenId":"root","screens":{"root":{"id":"root"}}}',
    deps
  )

  assert.equal(parsed.error, '')
  assert.equal(parsed.graph.entryScreenId, 'root')
  assert.equal(parsed.graph.normalized, true)
})

test('tryRenderImportedSchemaFromStorage renders import errors for invalid stored graphs', () => {
  const { deps, events, store } = createDeps()
  store.schema = '{"schemaVersion":"v1"}'

  assert.equal(configurationRuntime.tryRenderImportedSchemaFromStorage(deps), true)
  assert.deepEqual(events, [
    ['renderImportError', 'Schema must be a canonical graph with schemaVersion, entryScreenId, and screens.']
  ])
})

test('applyConfigurationFromPayload stores settings and activates imported graphs', () => {
  const { deps, events, store } = createDeps()

  configurationRuntime.applyConfigurationFromPayload(
    {
      openaiToken: '  sk-test  ',
      openaiModel: '  gpt-5-mini  ',
      schemaJson: '{"schemaVersion":"v1","entryScreenId":"root","screens":{"root":{"id":"root"}}}'
    },
    deps
  )

  assert.equal(store.token, 'sk-test')
  assert.equal(store.model, 'gpt-5-mini')
  assert.ok(store.schema)
  assert.deepEqual(events, [
    ['activateGraph', 'root', 'imported', false]
  ])
})

test('applyConfigurationFromPayload clears imported schema when schema is empty', () => {
  const { deps, events, store } = createDeps()
  store.schema = '{"old":true}'
  store.token = 'old-token'

  configurationRuntime.applyConfigurationFromPayload(
    {
      openaiToken: '',
      openaiModel: '',
      schemaJson: '   '
    },
    deps
  )

  assert.equal(store.token, undefined)
  assert.equal(store.model, 'gpt-default')
  assert.equal(store.schema, undefined)
  assert.deepEqual(events, [
    ['renderAgentStatusCard', 'Import Cleared', 'Imported schema removed.']
  ])
})

test('handleReady resets history and boots the static graph when nothing is active', () => {
  const { deps, events } = createDeps()

  configurationRuntime.handleReady(deps)

  assert.deepEqual(events, [
    ['log', 'Phone brain ready'],
    ['log', 'OpenAI key missing. Open app settings to add one.'],
    ['resetHistory'],
    ['activateGraph', 'static-root', 'static', false]
  ])
})
