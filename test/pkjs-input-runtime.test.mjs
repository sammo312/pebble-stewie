import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const inputRuntime = require('../src/pkjs/input-runtime.js')

function createDeps(overrides = {}) {
  const events = []
  const runtimeState = {
    activeGraph: { id: 'active-graph' },
    activeGraphSource: 'static',
    currentCardActionsById: {},
    currentMenuActionsById: {},
    currentRenderedScreen: null,
    currentScreenDefinition: null,
    history: [],
    pendingDictation: null,
    currentScreenId: ''
  }

  const deps = {
    activateGraph(graph, source, pushHistory) {
      events.push(['activateGraph', graph && graph.id ? graph.id : graph.entryScreenId || '', source, pushHistory])
    },
    actionTypeBack: 3,
    actionTypeReady: 1,
    actionTypeSelect: 2,
    actionTypeVoice: 4,
    applySetVar(run) {
      events.push(['applySetVar', run.key, run.value])
      return true
    },
    clearPendingDictation() {
      events.push(['clearPendingDictation'])
      runtimeState.pendingDictation = null
    },
    clearScreenTimer() {
      events.push(['clearScreenTimer'])
    },
    executeTypedAction(run, source) {
      events.push(['executeTypedAction', run && run.type, source, run && run.prompt ? run.prompt : ''])
      return false
    },
    getActiveGraph() {
      return runtimeState.activeGraph
    },
    getActiveGraphSource() {
      return runtimeState.activeGraphSource
    },
    getCurrentCardActionsById() {
      return runtimeState.currentCardActionsById
    },
    getCurrentMenuActionsById() {
      return runtimeState.currentMenuActionsById
    },
    getCurrentRenderedScreen() {
      return runtimeState.currentRenderedScreen
    },
    getCurrentScreenDefinition() {
      return runtimeState.currentScreenDefinition
    },
    getHistoryLength() {
      return runtimeState.history.length
    },
    getPendingDictation() {
      return runtimeState.pendingDictation
    },
    getStaticGraph() {
      return { id: 'static-graph' }
    },
    leaveAgentConversation() {
      events.push(['leaveAgentConversation'])
    },
    limitText(value, maxLen) {
      return String(value).slice(0, maxLen)
    },
    maxScrollBodyLen: 1024,
    msgTypeAction: 9,
    parseNumber(value, fallback) {
      const parsed = Number(value)
      return Number.isNaN(parsed) ? fallback : parsed
    },
    popHistoryEntry() {
      return runtimeState.history.pop()
    },
    pushCurrentHistoryEntry() {
      events.push(['pushCurrentHistoryEntry'])
    },
    resetAgentConversation(resetConversationId) {
      events.push(['resetAgentConversation', resetConversationId])
    },
    resetHistory() {
      events.push(['resetHistory'])
      runtimeState.history = []
    },
    resetVars() {
      events.push(['resetVars'])
    },
    restoreHistoryEntry(entry) {
      events.push(['restoreHistoryEntry', entry && entry.screenId ? entry.screenId : ''])
    },
    sanitizeText(value) {
      return value ? String(value).trim() : ''
    },
    sanitizeVarKey(key) {
      return key ? String(key) : ''
    },
    sendRender(screen) {
      events.push(['sendRender', screen.id, screen.type, screen.body || ''])
    },
    setCurrentScreenId(screenId) {
      events.push(['setCurrentScreenId', screenId])
      runtimeState.currentScreenId = screenId
    },
    submitAgentTextInput(text, reason) {
      events.push(['submitAgentTextInput', text, reason])
    },
    submitAgentVoice(text) {
      events.push(['submitAgentVoice', text])
    },
    transitionTo(screenId, pushHistory) {
      events.push(['transitionTo', screenId, pushHistory])
      return true
    },
    tryRenderImportedSchemaFromStorage() {
      events.push(['tryRenderImportedSchemaFromStorage'])
      return false
    },
    voiceErrorItemId: '__voice_error__',
    voiceInputItemId: '__voice__',
    voiceNotSupportedItemId: '__voice_unsupported__'
  }

  return {
    deps: { ...deps, ...overrides },
    events,
    runtimeState
  }
}

test('handleBack restores static graph when agent history is empty', () => {
  const { deps, events, runtimeState } = createDeps()
  runtimeState.activeGraphSource = 'agent'

  inputRuntime.handleBack(deps)

  assert.deepEqual(events, [
    ['leaveAgentConversation'],
    ['activateGraph', 'static-graph', 'static', false]
  ])
})

test('handleMenuActionSelect submits agent text when action has value but no run handler', () => {
  const { deps, events, runtimeState } = createDeps()
  runtimeState.activeGraphSource = 'agent'
  runtimeState.currentMenuActionsById = {
    refresh: { id: 'refresh', value: 'Refresh data', run: { type: 'effect' } }
  }

  assert.equal(
    inputRuntime.handleMenuActionSelect({ itemId: 'refresh', index: -1 }, deps),
    true
  )

  assert.deepEqual(events, [
    ['executeTypedAction', 'effect', 'menu_action', ''],
    ['submitAgentTextInput', 'User selected action menu item refresh: Refresh data', 'menu_action']
  ])
})

test('handleVoiceAction interpolates dictation text into agent prompts', () => {
  const { deps, events, runtimeState } = createDeps({
    executeTypedAction(run, source) {
      events.push(['executeTypedAction', run.type, source, run.prompt || ''])
      return true
    }
  })
  runtimeState.currentScreenDefinition = {
    id: 'voice-menu',
    items: [
      {
        id: '__voice__',
        run: {
          type: 'dictation',
          variable: 'topic',
          then: {
            type: 'agent_prompt',
            prompt: 'Summarize {{var.topic}}',
            vibe: 'short'
          }
        }
      }
    ]
  }

  inputRuntime.handleVoiceAction({ text: 'weather' }, deps)

  assert.deepEqual(events, [
    ['applySetVar', 'topic', 'literal:weather'],
    ['executeTypedAction', 'agent_prompt', 'dictation_then', 'Summarize weather']
  ])
})

test('handleActionMessage resets runtime state on READY and boots the static graph', () => {
  const { deps, events, runtimeState } = createDeps()
  runtimeState.history = [{ screenId: 'old' }]

  inputRuntime.handleActionMessage(
    {
      msgType: 9,
      actionType: 1,
      actionScreenId: 'root'
    },
    deps
  )

  assert.deepEqual(events, [
    ['setCurrentScreenId', 'root'],
    ['resetHistory'],
    ['resetVars'],
    ['clearScreenTimer'],
    ['resetAgentConversation', false],
    ['tryRenderImportedSchemaFromStorage'],
    ['activateGraph', 'static-graph', 'static', false]
  ])
})
