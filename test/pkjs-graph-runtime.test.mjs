import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const graphRuntime = require('../src/pkjs/graph-runtime.js')

function createDeps(overrides = {}) {
  const events = []
  const runtimeState = {
    activeGraphSource: 'static',
    currentRenderedScreen: null,
    currentScreenDefinition: { id: 'root', type: 'card' }
  }

  const deps = {
    applySetVar(run) {
      events.push(['applySetVar', run.key, run.value])
      return true
    },
    applyStore(run, screen) {
      events.push(['applyStore', run.key, screen && screen.id ? screen.id : ''])
      return true
    },
    clearPendingEffects() {
      events.push(['clearPendingEffects'])
    },
    evaluateRunCondition(condition) {
      events.push(['evaluateRunCondition', condition])
      return !condition || condition.pass !== false
    },
    getActiveGraphSource() {
      return runtimeState.activeGraphSource
    },
    getCurrentRenderedScreen() {
      return runtimeState.currentRenderedScreen
    },
    getCurrentScreenDefinition() {
      return runtimeState.currentScreenDefinition
    },
    leaveAgentConversation() {
      events.push(['leaveAgentConversation'])
    },
    log() {
      events.push(['log', Array.from(arguments).join(' ')])
    },
    maxHookRedirects: 2,
    pushCurrentHistoryEntry() {
      events.push(['pushCurrentHistoryEntry'])
    },
    queueRunEffects(run) {
      events.push(['queueRunEffects', run.type])
    },
    renderAgentStatusCard(title, body) {
      events.push(['renderAgentStatusCard', title, body])
    },
    resolveScreenInGraph(graph, screenId) {
      return graph && graph.screens ? graph.screens[screenId] || null : null
    },
    resetAgentConversation(resetConversationId) {
      events.push(['resetAgentConversation', resetConversationId])
    },
    sanitizeVarKey(key) {
      return key ? String(key) : ''
    },
    sendNavigationError(targetScreen) {
      events.push(['sendNavigationError', targetScreen])
    },
    sendRender(screen, options) {
      events.push(['sendRender', screen.id, options && options.resetTimer])
      runtimeState.currentScreenDefinition = screen
      runtimeState.currentRenderedScreen = screen
    },
    setActiveGraph(graph, source) {
      events.push(['setActiveGraph', source, graph && graph.entryScreenId ? graph.entryScreenId : ''])
      runtimeState.activeGraphSource = source
    },
    setPendingDictation(pendingDictation) {
      events.push(['setPendingDictation', pendingDictation])
    },
    submitAgentTextInput(prompt, source) {
      events.push(['submitAgentTextInput', prompt, source])
    },
    transitionTo(screenId, pushHistory) {
      events.push(['transitionTo', screenId, pushHistory])
      return true
    }
  }

  return {
    deps: { ...deps, ...overrides },
    events,
    runtimeState
  }
}

test('executeTypedAction reports navigation failures through the injected callbacks', () => {
  const { deps, events } = createDeps({
    transitionTo(screenId, pushHistory) {
      events.push(['transitionTo', screenId, pushHistory])
      return false
    }
  })

  assert.equal(
    graphRuntime.executeTypedAction({ type: 'navigate', screen: 'missing', vibe: 'short' }, 'menu_item', deps),
    true
  )

  assert.deepEqual(events, [
    ['evaluateRunCondition', undefined],
    ['queueRunEffects', 'navigate'],
    ['transitionTo', 'missing', true],
    ['clearPendingEffects'],
    ['sendNavigationError', 'missing']
  ])
})

test('executeTypedAction rerenders the current screen after set_var', () => {
  const { deps, events } = createDeps()

  assert.equal(
    graphRuntime.executeTypedAction({ type: 'set_var', key: 'mode', value: 'ready' }, 'schema_action', deps),
    true
  )

  assert.deepEqual(events, [
    ['applySetVar', 'mode', 'ready'],
    ['queueRunEffects', 'set_var'],
    ['sendRender', 'root', false]
  ])
})

test('executeTypedAction prepares dictation screens and pending state', () => {
  const { deps, events } = createDeps()

  assert.equal(
    graphRuntime.executeTypedAction(
      { type: 'dictation', variable: 'spoken_value', screen: 'after-voice', then: { type: 'navigate', screen: 'done' } },
      'menu_item',
      deps
    ),
    true
  )

  assert.deepEqual(events, [
    ['queueRunEffects', 'dictation'],
    ['setPendingDictation', { variable: 'spoken_value', screen: 'after-voice', then: { type: 'navigate', screen: 'done' } }],
    ['pushCurrentHistoryEntry'],
    ['sendRender', '__dictation__', undefined]
  ])
})

test('executeTypedAction handles more_replies agent command', () => {
  const { deps, events } = createDeps()

  assert.equal(
    graphRuntime.executeTypedAction({ type: 'agent_command', command: 'more_replies' }, 'menu_item', deps),
    true
  )

  assert.deepEqual(events, [
    ['queueRunEffects', 'agent_command'],
    [
      'submitAgentTextInput',
      'System task: generate 4 short, distinct tap-friendly replies the user could send next. Return a menu screen. Keep item labels under 18 chars. Set each item value to the exact reply text to send. Avoid generic yes/no unless it is clearly the best fit.',
      'menu_item'
    ]
  ])
})

test('executeHookRuns returns the last redirect while preserving side effects', () => {
  const { deps, events } = createDeps()

  const redirect = graphRuntime.executeHookRuns(
    [
      { type: 'set_var', key: 'count', value: 'increment' },
      { type: 'navigate', screen: 'alpha' },
      { type: 'effect', vibe: 'short' },
      { type: 'navigate', screen: 'beta' }
    ],
    { id: 'root' },
    deps
  )

  assert.equal(redirect, 'beta')
  assert.deepEqual(events, [
    ['applySetVar', 'count', 'increment'],
    ['queueRunEffects', 'set_var'],
    ['evaluateRunCondition', undefined],
    ['queueRunEffects', 'effect'],
    ['evaluateRunCondition', undefined]
  ])
})

test('renderGraphScreen applies exit and enter redirects before rendering', () => {
  const { deps, events, runtimeState } = createDeps()
  runtimeState.activeGraphSource = 'agent'
  runtimeState.currentScreenDefinition = {
    id: 'root',
    onExit: [{ type: 'navigate', screen: 'gate' }]
  }

  const graph = {
    entryScreenId: 'root',
    screens: {
      gate: {
        id: 'gate',
        onEnter: [{ type: 'navigate', screen: 'final' }]
      },
      final: {
        id: 'final',
        type: 'card'
      }
    }
  }

  assert.equal(graphRuntime.renderGraphScreen(graph, 'static', 'menu', true, deps), true)
  assert.deepEqual(events, [
    ['pushCurrentHistoryEntry'],
    ['evaluateRunCondition', undefined],
    ['leaveAgentConversation'],
    ['setActiveGraph', 'static', 'root'],
    ['evaluateRunCondition', undefined],
    ['sendRender', 'final', undefined]
  ])
})

test('renderGraphScreen fails when lifecycle redirects loop forever', () => {
  const { deps, events } = createDeps({
    maxHookRedirects: 1
  })

  const graph = {
    entryScreenId: 'alpha',
    screens: {
      alpha: {
        id: 'alpha',
        onEnter: [{ type: 'navigate', screen: 'beta' }]
      },
      beta: {
        id: 'beta',
        onEnter: [{ type: 'navigate', screen: 'alpha' }]
      }
    }
  }

  assert.equal(graphRuntime.renderGraphScreen(graph, 'static', 'alpha', false, deps), false)
  assert.deepEqual(events, [
    ['setActiveGraph', 'static', 'alpha'],
    ['evaluateRunCondition', undefined],
    ['evaluateRunCondition', undefined],
    ['log', 'Lifecycle redirect loop detected for: alpha']
  ])
})
