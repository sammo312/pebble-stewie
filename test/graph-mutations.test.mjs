import test from 'node:test'
import assert from 'node:assert/strict'

import {
  addDataItemToGraph,
  addMenuItemToScreen,
  addMotionTrackToScreen,
  addScreenActionToScreen,
  addStorageKeyToGraph,
  addVariableToGraph,
  addCanvasItemToScreen,
  addDrawStepToScreen,
  clearLinkByHandleInGraph,
  connectCanvasHandleInGraph,
  detachMotionToRawInScreen,
  enablePresetMotionInScreen,
  removeScreenHookFromScreen,
  setStorageNamespaceInGraph,
  toggleScreenTimerInScreen,
  updateCanvasHeaderInScreen,
  updateDrawStepInScreen,
  updateMotionTrackInScreen,
  updateScreenHookInScreen,
  updateScreenTimerInScreen
} from '../apps/screen-builder-web/app/lib/graph-mutations.mjs'
import {
  createGraphLoadState,
  parseImportedGraphText,
  prepareGraphForBuilder,
  prepareTemplateGraph
} from '../apps/screen-builder-web/app/lib/graph-loading.mjs'

function createLinkDeps(overrides = {}) {
  return {
    ensureUniqueEntityId(items, requestedId) {
      return items.length === 0 ? requestedId : `${requestedId}_${items.length + 1}`
    },
    getRunTargetDefinition(targetId) {
      if (targetId === 'run:effect') {
        return { title: 'Pulse', runType: 'effect' }
      }
      if (targetId === 'run:store') {
        return { title: 'Store', runType: 'store' }
      }
      return null
    },
    getScreenActions(screen) {
      return Array.isArray(screen.actions) ? screen.actions : []
    },
    isRunTargetId(targetId) {
      return String(targetId).startsWith('run:')
    },
    maxMenuActions: 6,
    pruneRunForType(type, run) {
      if (type === 'navigate') {
        return { type, screen: run.screen }
      }
      if (type === 'effect') {
        return { type, vibe: run.vibe, light: !!run.light }
      }
      if (type === 'store') {
        return { type, key: run.key, value: run.value }
      }
      if (type === 'set_var') {
        return { type, key: run.key, value: run.value }
      }
      if (type === 'agent_prompt') {
        return { type, prompt: run.prompt }
      }
      if (type === 'agent_command') {
        return { type, command: run.command }
      }
      return { type }
    },
    screenSupportsActions(screen) {
      return screen.type === 'card' || screen.type === 'scroll'
    },
    screenUsesButtonSlots(screen) {
      return screen.type === 'card'
    },
    screenUsesSelectDrawer(screen) {
      return screen.type === 'scroll'
    },
    ...overrides
  }
}

function createDrawDeps(overrides = {}) {
  function ensureUniqueEntityId(items, requestedId, fallback) {
    const base = String(requestedId || fallback || 'item')
    const used = new Set((items || []).map((item) => String(item.id || '')))
    if (!used.has(base)) {
      return base
    }
    let index = 2
    while (used.has(`${base}_${index}`)) {
      index += 1
    }
    return `${base}_${index}`
  }

  function normalizeCanvas(canvas) {
    return {
      template: 'freeform',
      header: 'Main Menu',
      items: [],
      ...(canvas || {})
    }
  }

  function normalizeMotion(motion) {
    return {
      playMode: 'loop',
      background: 'grid',
      timelineMs: 1800,
      tracks: Array.isArray(motion?.tracks) ? motion.tracks : [],
      ...(motion || {})
    }
  }

  function createDefaultCanvas(overrides = {}) {
    return normalizeCanvas(overrides)
  }

  function createDefaultMotionTrack(existingTracks = [], overrides = {}) {
    const id = ensureUniqueEntityId(existingTracks, 'track', 'track')
    return {
      id,
      label: `Track ${existingTracks.length + 1}`,
      delayMs: 0,
      fill: false,
      ...overrides
    }
  }

  function createDefaultMotion(overrides = {}) {
    return normalizeMotion({
      tracks: [createDefaultMotionTrack([], { id: 'track' })],
      ...overrides
    })
  }

  function createDefaultCanvasMotion(canvas, overrides = {}) {
    return normalizeMotion({
      tracks: [createDefaultMotionTrack([], {
        id: 'track',
        target: canvas?.template === 'header_list' ? 'items' : 'stage',
        label: 'Track 1'
      })],
      ...overrides
    })
  }

  function createDefaultDrawing() {
    return {
      playMode: 'loop',
      background: 'grid',
      timelineMs: 1800,
      steps: [
        {
          id: 'step',
          x: 0,
          y: 0,
          toX: 10,
          toY: 10,
          width: 24,
          height: 24,
          delayMs: 0,
          durationMs: 760,
          fromScale: 0.7,
          toScale: 1,
          fromOpacity: 0.25,
          toOpacity: 1,
          fill: false,
          color: 'accent',
          label: 'Step 1'
        }
      ]
    }
  }

  function createDefaultDrawStep(existingSteps = [], overrides = {}) {
    const id = ensureUniqueEntityId(existingSteps, 'step', 'step')
    return {
      id,
      label: `Step ${existingSteps.length + 1}`,
      x: 0,
      y: 0,
      toX: 10,
      toY: 10,
      width: 24,
      height: 24,
      delayMs: 0,
      durationMs: 760,
      fromScale: 0.7,
      toScale: 1,
      fromOpacity: 0.25,
      toOpacity: 1,
      fill: false,
      color: 'accent',
      ...overrides
    }
  }

  function coerceDrawNumber(rawValue, fallback, min, max) {
    const parsed = Number(rawValue)
    let next = Number.isFinite(parsed) ? parsed : fallback
    if (typeof min === 'number') {
      next = Math.max(min, next)
    }
    if (typeof max === 'number') {
      next = Math.min(max, next)
    }
    return next
  }

  function getDrawStepFieldLimit(fieldId) {
    if (fieldId === 'x' || fieldId === 'toX') return { min: 0, max: 144 }
    if (fieldId === 'y' || fieldId === 'toY') return { min: 0, max: 168 }
    if (fieldId === 'width' || fieldId === 'height') return { min: 4, max: 96 }
    if (fieldId === 'delayMs' || fieldId === 'durationMs') return { min: 0, max: 20000 }
    if (fieldId === 'fromScale' || fieldId === 'toScale') return { min: 0.1, max: 4 }
    if (fieldId === 'fromOpacity' || fieldId === 'toOpacity') return { min: 0.05, max: 1 }
    return { min: undefined, max: undefined }
  }

  function isDrawStepNumericField(fieldId) {
    return [
      'x',
      'y',
      'toX',
      'toY',
      'width',
      'height',
      'delayMs',
      'durationMs',
      'fromScale',
      'toScale',
      'fromOpacity',
      'toOpacity'
    ].includes(fieldId)
  }

  function clampDrawStepCount(steps) {
    return (steps || []).slice(0, 6)
  }

  function buildCompiledMotionState(rawMotion, rawCanvas) {
    const canvas = normalizeCanvas(rawCanvas)
    const motion = normalizeMotion(
      rawMotion || (canvas.template === 'header_list' ? createDefaultCanvasMotion(canvas) : createDefaultMotion())
    )
    return {
      canvas,
      motion,
      drawing: {
        playMode: motion.playMode || 'loop',
        background: motion.background || 'grid',
        timelineMs: motion.timelineMs || 1800,
        steps: (motion.tracks || []).map((track, index) => ({
          id: track.id || `step_${index + 1}`,
          x: 0,
          y: 0,
          toX: 10,
          toY: 10,
          width: 24,
          height: 24,
          delayMs: Number(track.delayMs || 0),
          durationMs: 760,
          fromScale: 0.7,
          toScale: 1,
          fromOpacity: 0.25,
          toOpacity: 1,
          fill: !!track.fill,
          color: 'accent',
          label: track.label || `Track ${index + 1}`
        }))
      }
    }
  }

  return {
    buildCompiledMotionState,
    clampDrawStepCount,
    coerceDrawNumber,
    createDefaultCanvas,
    createDefaultCanvasMotion,
    createDefaultDrawing,
    createDefaultDrawStep,
    createDefaultMotion,
    createDefaultMotionTrack,
    ensureUniqueEntityId,
    getDrawStepFieldLimit,
    isDrawStepNumericField,
    maxCanvasItems: 4,
    maxDrawSteps: 6,
    maxOptionLabelLen: 18,
    maxTitleLen: 24,
    normalizeCanvas,
    normalizeMotion,
    ...overrides
  }
}

test('graph meta mutations dedupe variables and storage keys', () => {
  const baseGraph = {
    entryScreenId: 'root',
    screens: { root: { id: 'root', type: 'menu', items: [] } }
  }

  const withVariable = addVariableToGraph(baseGraph, 'count', '0', 'number')
  const dedupedVariable = addVariableToGraph(withVariable, 'count', '1', 'number')
  const withStorage = addStorageKeyToGraph(dedupedVariable, 'high_score', 'number')
  const withData = addDataItemToGraph(withStorage, { key: 'count', scope: 'session', typeHint: 'number' })

  assert.deepEqual(withVariable._builderMeta.variables, [{ key: 'count', defaultValue: '0', typeHint: 'number' }])
  assert.equal(dedupedVariable._builderMeta.variables.length, 1)
  assert.deepEqual(withStorage._builderMeta.storageKeys, [{ key: 'high_score', typeHint: 'number' }])
  assert.deepEqual(withData._builderMeta.dataItems, [{ key: 'count', scope: 'session', typeHint: 'number' }])
})

test('setStorageNamespaceInGraph sets and clears the namespace', () => {
  const baseGraph = {
    entryScreenId: 'root',
    screens: { root: { id: 'root', type: 'menu', items: [] } }
  }

  const namespaced = setStorageNamespaceInGraph(baseGraph, 'demo_store')
  const cleared = setStorageNamespaceInGraph(namespaced, '')

  assert.equal(namespaced.storageNamespace, 'demo_store')
  assert.equal('storageNamespace' in cleared, false)
})

test('screen item and action mutations build expected defaults', () => {
  const menuScreen = addMenuItemToScreen(
    { id: 'root', type: 'menu', items: [] },
    {
      ensureUniqueEntityId(items, requestedId) {
        return items.length === 0 ? requestedId : `${requestedId}_${items.length + 1}`
      }
    }
  )

  assert.deepEqual(menuScreen.items[0], {
    id: 'item',
    label: 'New Item',
    value: '',
    labelTemplate: '',
    run: null
  })

  const cardScreen = addScreenActionToScreen(
    {
      id: 'card',
      type: 'card',
      actions: [{ slot: 'up', id: 'existing', icon: 'check', label: 'Existing', value: '', run: null }]
    },
    {
      ensureUniqueEntityId(actions, requestedId) {
        return actions.length === 0 ? requestedId : `${requestedId}_${actions.length + 1}`
      },
      getScreenActions(screen) {
        return Array.isArray(screen.actions) ? screen.actions : []
      },
      screenUsesSelectDrawer() {
        return false
      },
      actionSlots: ['up', 'select', 'down']
    }
  )

  assert.equal(cardScreen.actions[1].slot, 'select')
  assert.equal(cardScreen.actions[1].id, 'action_2')

  const scrollScreen = addScreenActionToScreen(
    { id: 'scroll', type: 'scroll', actions: [] },
    {
      ensureUniqueEntityId() {
        return 'drawer_item'
      },
      getScreenActions(screen) {
        return Array.isArray(screen.actions) ? screen.actions : []
      },
      screenUsesSelectDrawer() {
        return true
      },
      actionSlots: ['up', 'select', 'down']
    }
  )

  assert.deepEqual(scrollScreen.actions[0], {
    id: 'drawer_item',
    label: 'Action Menu Item',
    value: '',
    run: null
  })
})

test('screen hook mutations update and remove lifecycle hooks', () => {
  const screen = {
    id: 'root',
    type: 'menu',
    onEnter: [{ type: 'effect', vibe: 'short' }]
  }

  const updated = updateScreenHookInScreen(
    screen,
    'onEnter',
    0,
    'run.vibe',
    'long',
    {
      getScreenHookRuns(targetScreen, hookKey) {
        return Array.isArray(targetScreen[hookKey]) ? targetScreen[hookKey] : []
      },
      createDefaultScreenHookRun() {
        return { type: 'effect', vibe: 'short' }
      },
      updateRunField(entity, fieldId, value) {
        if (fieldId === 'run.vibe') {
          return { run: { ...entity.run, vibe: value } }
        }
        return entity
      }
    }
  )

  assert.equal(updated.onEnter[0].vibe, 'long')

  const removed = removeScreenHookFromScreen(updated, 'onEnter', 0, {
    getScreenHookRuns(targetScreen, hookKey) {
      return Array.isArray(targetScreen[hookKey]) ? targetScreen[hookKey] : []
    }
  })

  assert.equal('onEnter' in removed, false)
})

test('screen timer mutations clamp duration and toggle timer presence', () => {
  const screen = { id: 'root', type: 'menu' }

  const withDuration = updateScreenTimerInScreen(screen, 'timer.durationMs', '50', {
    createDefaultScreenTimer() {
      return { durationMs: 5000, run: { type: 'effect', vibe: 'short' } }
    },
    updateRunField(entity) {
      return entity
    }
  })

  assert.equal(withDuration.timer.durationMs, 100)

  const disabled = toggleScreenTimerInScreen(withDuration, false, {
    createDefaultScreenTimer() {
      return { durationMs: 5000, run: { type: 'effect', vibe: 'short' } }
    }
  })

  assert.equal('timer' in disabled, false)
})

test('clearLinkByHandleInGraph clears menu item runs and timer runs', () => {
  const graph = {
    entryScreenId: 'root',
    screens: {
      root: {
        id: 'root',
        type: 'menu',
        items: [{ id: 'first', label: 'First', run: { type: 'navigate', screen: 'done' } }],
        timer: { durationMs: 5000, run: { type: 'effect', vibe: 'short' } }
      },
      done: { id: 'done', type: 'card', actions: [] }
    }
  }

  const clearedItem = clearLinkByHandleInGraph(graph, 'root', 'item-first', createLinkDeps())
  assert.equal(clearedItem.removed, true)
  assert.equal(clearedItem.graph.screens.root.items[0].run, null)

  const clearedTimer = clearLinkByHandleInGraph(clearedItem.graph, 'root', 'timer-run', createLinkDeps())
  assert.equal(clearedTimer.removed, true)
  assert.equal(clearedTimer.graph.screens.root.timer.run, null)
})

test('connectCanvasHandleInGraph creates card slot links to screens', () => {
  const graph = {
    entryScreenId: 'root',
    screens: {
      root: { id: 'root', type: 'card', title: 'Home', actions: [] },
      done: { id: 'done', type: 'card', title: 'Done', actions: [] }
    }
  }

  const result = connectCanvasHandleInGraph(graph, {
    source: 'root',
    sourceHandle: 'slot-up',
    target: 'done'
  }, createLinkDeps())

  assert.equal(result.kind, 'success')
  assert.equal(result.focusSourceId, 'root')
  assert.equal(result.graph.screens.root.actions[0].slot, 'up')
  assert.equal(result.graph.screens.root.actions[0].label, 'up → Done')
  assert.deepEqual(result.graph.screens.root.actions[0].run, { type: 'navigate', screen: 'done' })
})

test('connectCanvasHandleInGraph creates drawer actions and action links to run targets', () => {
  const graph = {
    entryScreenId: 'scroll',
    screens: {
      scroll: { id: 'scroll', type: 'scroll', title: 'Scroll', actions: [] },
      card: {
        id: 'card',
        type: 'card',
        title: 'Card',
        actions: [{ slot: 'select', id: 'confirm', icon: 'check', label: 'Confirm', value: '', run: null }]
      }
    }
  }

  const drawerResult = connectCanvasHandleInGraph(graph, {
    source: 'scroll',
    sourceHandle: 'menu-action-create',
    target: 'run:effect'
  }, createLinkDeps())

  assert.equal(drawerResult.kind, 'success')
  assert.deepEqual(drawerResult.graph.screens.scroll.actions[0].run, { type: 'effect', vibe: 'short', light: false })
  assert.equal(drawerResult.graph.screens.scroll.actions[0].value, '')

  const actionResult = connectCanvasHandleInGraph(drawerResult.graph, {
    source: 'card',
    sourceHandle: 'action-confirm',
    target: 'run:store'
  }, createLinkDeps())

  assert.equal(actionResult.kind, 'success')
  assert.deepEqual(actionResult.graph.screens.card.actions[0].run, {
    type: 'store',
    key: 'high_score',
    value: '{{var.count}}'
  })
  assert.equal(actionResult.graph.screens.card.actions[0].value, 'Confirm')
})

test('draw canvas and motion mutations preserve compiled state', () => {
  const deps = createDrawDeps()
  const baseCanvas = deps.createDefaultCanvas({ header: 'Draw Header', template: 'header_list' })
  const baseMotion = deps.createDefaultCanvasMotion(baseCanvas)
  const compiled = deps.buildCompiledMotionState(baseMotion, baseCanvas)
  const screen = {
    id: 'draw',
    type: 'draw',
    title: 'Draw',
    canvas: compiled.canvas,
    motion: compiled.motion,
    drawing: compiled.drawing
  }

  const withItem = addCanvasItemToScreen(screen, deps)
  assert.equal(withItem.canvas.items.length, 1)
  assert.ok(withItem.motion)
  assert.ok(Array.isArray(withItem.drawing.steps))

  const withHeader = updateCanvasHeaderInScreen(withItem, 'New Header For Canvas', deps)
  assert.equal(withHeader.canvas.header, 'New Header For Canvas'.slice(0, 24))

  const withTrack = addMotionTrackToScreen(withHeader, deps)
  assert.ok(withTrack.motion.tracks.length >= 1)
  assert.ok(Array.isArray(withTrack.drawing.steps))
})

test('draw step and motion track mutations clamp and uniquify fields', () => {
  const deps = createDrawDeps()
  const rawScreen = {
    id: 'draw',
    type: 'draw',
    drawing: {
      ...deps.createDefaultDrawing(),
      steps: [
        { ...deps.createDefaultDrawStep([]), id: 'step' },
        { ...deps.createDefaultDrawStep([{ id: 'step' }]), id: 'step_2' }
      ]
    }
  }

  const updatedStep = updateDrawStepInScreen(rawScreen, 1, 'id', 'step', deps)
  assert.notEqual(updatedStep.drawing.steps[1].id, 'step')

  const clampedStep = updateDrawStepInScreen(updatedStep, 0, 'x', '999', deps)
  assert.equal(clampedStep.drawing.steps[0].x, 144)

  const motionScreen = enablePresetMotionInScreen({ id: 'draw', type: 'draw', canvas: deps.createDefaultCanvas() }, deps)
  const updatedTrack = updateMotionTrackInScreen(motionScreen, 0, 'delayMs', '25000', deps)
  assert.equal(updatedTrack.motion.tracks[0].delayMs, 20000)
})

test('draw mode can switch between preset motion and raw drawing', () => {
  const deps = createDrawDeps()
  const baseScreen = {
    id: 'draw',
    type: 'draw',
    canvas: deps.createDefaultCanvas()
  }

  const preset = enablePresetMotionInScreen(baseScreen, deps)
  assert.ok(preset.motion)
  assert.ok(Array.isArray(preset.drawing.steps))

  const raw = detachMotionToRawInScreen(preset, deps)
  assert.equal('motion' in raw, false)
  assert.ok(Array.isArray(raw.drawing.steps))

  const withStep = addDrawStepToScreen(raw, deps)
  assert.ok(withStep.drawing.steps.length >= raw.drawing.steps.length)
})

test('graph loading helpers prepare builder meta and parse import payloads', () => {
  const deps = {
    normalizeCanonicalGraph(candidate) {
      return candidate && candidate.entryScreenId ? { ...candidate } : null
    },
    inferBuilderMetaFromGraph(graph) {
      return {
        variables: [{ key: `from_${graph.entryScreenId}` }],
        storageKeys: [],
        dataItems: []
      }
    }
  }

  const sourceGraph = {
    entryScreenId: 'root',
    screens: { root: { id: 'root', type: 'menu' } }
  }

  const prepared = prepareGraphForBuilder(sourceGraph, deps)
  assert.deepEqual(prepared._builderMeta.variables, [{ key: 'from_root' }])

  const parsed = parseImportedGraphText(JSON.stringify({ graph: sourceGraph }), deps)
  assert.equal(parsed.ok, true)
  assert.equal(parsed.graph.entryScreenId, 'root')

  const parseFailure = parseImportedGraphText('{bad json', deps)
  assert.equal(parseFailure.ok, false)
  assert.match(parseFailure.error, /Import JSON parse error/)
})

test('template preparation preserves explicit builder meta and load state payload', () => {
  const deps = {
    normalizeCanonicalGraph(candidate) {
      return candidate && candidate.entryScreenId ? { ...candidate } : null
    },
    inferBuilderMetaFromGraph() {
      return { variables: [], storageKeys: [], dataItems: [] }
    }
  }

  const template = {
    id: 'demo',
    label: 'Demo',
    graph: {
      entryScreenId: 'root',
      _builderMeta: { variables: [{ key: 'preset' }], storageKeys: [], dataItems: [] },
      screens: { root: { id: 'root', type: 'menu' } }
    }
  }

  const prepared = prepareTemplateGraph(template, deps)
  assert.deepEqual(prepared._builderMeta.variables, [{ key: 'preset' }])

  const loadState = createGraphLoadState(prepared, { setImportText: true, resetPreviewRuntime: true })
  assert.equal(loadState.selectedScreenId, 'root')
  assert.equal(loadState.previewScreenId, 'root')
  assert.deepEqual(loadState.previewVars, {})
  assert.deepEqual(loadState.previewStorage, {})
  assert.equal(typeof loadState.importText, 'string')
})
