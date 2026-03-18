import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const transportRuntime = require('../src/pkjs/transport-runtime.js')
const constants = require('../src/pkjs/constants.js')

function createDeps(overrides = {}) {
  const events = []
  const timeouts = []
  const runtimeState = {
    currentScreenDefinition: null,
    currentScreenId: '',
    currentRenderedScreen: null,
    currentCardActionsById: {},
    currentMenuActionsById: {},
    liveRenderTimer: null,
    pendingEffects: { vibe: '', light: false },
    screenTimerDeadline: 0,
    screenTimerId: null
  }

  function startTimer(callback, ms) {
    const handle = { id: timeouts.length + 1, ms, callback }
    timeouts.push(handle)
    events.push(['setTimeout', ms])
    return handle
  }

  const deps = {
    applyScreenBindings(screen) {
      events.push(['applyScreenBindings', screen.id])
      return { screen, refreshMs: 0 }
    },
    clearLiveRenderTimer() {
      events.push(['clearLiveRenderTimer'])
      runtimeState.liveRenderTimer = null
    },
    clearPendingEffects() {
      events.push(['clearPendingEffects'])
      runtimeState.pendingEffects = { vibe: '', light: false }
    },
    clearScreenTimer() {
      events.push(['clearScreenTimer'])
      runtimeState.screenTimerId = null
      runtimeState.screenTimerDeadline = 0
    },
    executeTypedAction(run, source) {
      events.push(['executeTypedAction', run.type, source])
    },
    getCurrentScreenDefinition() {
      return runtimeState.currentScreenDefinition
    },
    getCurrentScreenId() {
      return runtimeState.currentScreenId
    },
    getPendingEffects() {
      return runtimeState.pendingEffects
    },
    getScreenTimerDeadline() {
      return runtimeState.screenTimerDeadline
    },
    log() {
      events.push(['log', Array.from(arguments).join(' ')])
    },
    now() {
      return 1000
    },
    prepareScreenForRender(screen) {
      events.push(['prepareScreenForRender', screen.id])
      return screen
    },
    sendAppMessage(payload) {
      events.push(['sendAppMessage', payload])
    },
    sendRender(screen, options) {
      events.push(['sendRender', screen.id, options && options.resetTimer])
    },
    setCurrentCardActionsById(nextActions) {
      events.push(['setCurrentCardActionsById', Object.keys(nextActions)])
      runtimeState.currentCardActionsById = nextActions
    },
    setCurrentMenuActionsById(nextActions) {
      events.push(['setCurrentMenuActionsById', Object.keys(nextActions)])
      runtimeState.currentMenuActionsById = nextActions
    },
    setCurrentRenderedScreen(screen) {
      events.push(['setCurrentRenderedScreen', screen.id])
      runtimeState.currentRenderedScreen = screen
    },
    setCurrentScreenDefinition(screen) {
      events.push(['setCurrentScreenDefinition', screen.id])
      runtimeState.currentScreenDefinition = screen
    },
    setCurrentScreenId(screenId) {
      events.push(['setCurrentScreenId', screenId])
      runtimeState.currentScreenId = screenId
    },
    setLiveRenderTimer(timerId) {
      events.push(['setLiveRenderTimer', timerId ? timerId.ms : null])
      runtimeState.liveRenderTimer = timerId
    },
    setScreenTimerDeadline(deadline) {
      events.push(['setScreenTimerDeadline', deadline])
      runtimeState.screenTimerDeadline = deadline
    },
    setScreenTimerId(timerId) {
      events.push(['setScreenTimerId', timerId ? timerId.ms : null])
      runtimeState.screenTimerId = timerId
    },
    setTimeout: startTimer
  }

  return {
    deps: { ...deps, ...overrides },
    events,
    runtimeState,
    timeouts
  }
}

test('sendRender builds card payloads and drains pending effects', () => {
  const { deps, events, runtimeState } = createDeps()
  runtimeState.pendingEffects = { vibe: 'short', light: true }

  transportRuntime.sendRender(
    {
      id: 'root',
      type: 'card',
      title: 'Home',
      body: 'Welcome home',
      actions: [{ slot: 'select', id: 'confirm', label: 'Confirm', run: { type: 'effect', vibe: 'short' } }]
    },
    {},
    deps
  )

  const sendEvent = events.find((event) => event[0] === 'sendAppMessage')
  const payload = sendEvent[1]

  assert.equal(payload.msgType, constants.MSG_TYPE_RENDER)
  assert.equal(payload.uiType, constants.UI_TYPE_CARD)
  assert.equal(payload.effectVibe, 'short')
  assert.equal(payload.effectLight, 1)
  assert.equal(payload.title, 'Home')
  assert.equal(runtimeState.currentRenderedScreen.id, 'root')
  assert.ok(runtimeState.currentCardActionsById.confirm)
  assert.equal(runtimeState.pendingEffects.vibe, '')
  assert.equal(runtimeState.pendingEffects.light, false)
})

test('sendRender clamps live refresh to one second when a screen timer is active', () => {
  const { deps, events, timeouts } = createDeps({
    applyScreenBindings(screen) {
      events.push(['applyScreenBindings', screen.id])
      return { screen, refreshMs: 5000 }
    }
  })

  transportRuntime.sendRender(
    {
      id: 'timer-screen',
      type: 'menu',
      title: 'Timer',
      items: [{ id: 'one', label: 'One' }],
      timer: { durationMs: 250, run: { type: 'effect', vibe: 'short' } }
    },
    {},
    deps
  )

  assert.deepEqual(timeouts.map((timeout) => timeout.ms), [250, 1000])
})

test('scheduleLiveRender rerenders only when the same screen is still active', () => {
  const { deps, events, runtimeState, timeouts } = createDeps()
  runtimeState.currentScreenId = 'root'
  runtimeState.currentScreenDefinition = { id: 'root', type: 'card' }

  transportRuntime.scheduleLiveRender('root', 750, deps)
  timeouts[0].callback()

  assert.deepEqual(events, [
    ['clearLiveRenderTimer'],
    ['setTimeout', 750],
    ['setLiveRenderTimer', 750],
    ['sendRender', 'root', false]
  ])
})

test('syncScreenTimer executes the timer run when the current screen is still active', () => {
  const { deps, events, runtimeState, timeouts } = createDeps()
  runtimeState.currentScreenId = 'timer-screen'

  transportRuntime.syncScreenTimer(
    {
      id: 'timer-screen',
      timer: { durationMs: 300, run: { type: 'navigate', screen: 'next' } }
    },
    true,
    deps
  )

  timeouts[0].callback()

  assert.equal(runtimeState.screenTimerDeadline, 0)
  assert.deepEqual(events, [
    ['clearScreenTimer'],
    ['setScreenTimerDeadline', 1300],
    ['setTimeout', 300],
    ['setScreenTimerId', 300],
    ['setScreenTimerId', null],
    ['setScreenTimerDeadline', 0],
    ['executeTypedAction', 'navigate', 'screen_timer']
  ])
})
