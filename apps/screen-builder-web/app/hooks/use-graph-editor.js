'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyNodeChanges, useNodesState, useEdgesState } from '@xyflow/react'
import { ACTION_TYPES } from '../pebble-protocol'
import {
  schemaRegistry,
  builderElements,
  graphSchema,
  bindingPresets,
  isRunTargetId,
  getRunTargetDefinition,
  screenUsesButtonSlots,
  screenUsesSelectDrawer,
  screenSupportsActions,
  getScreenActions,
  createDefaultGraph
} from '../lib/constants'
import {
  sanitizeId,
  ensureUniqueScreenId,
  ensureUniqueEntityId,
  getNestedValue,
  setNestedValue,
  pruneRunForType,
  updateRunField,
  updateEntityField,
  toPrettyJson,
  shortHash,
  isRunConfigured,
  countUnmappedEntities,
  getScreenHookRuns,
  collectRequiredRunTargetIds,
  collectNodeUsages,
  collectGraphReferenceCatalog,
  inferBuilderMetaFromGraph,
  compileVariableDefaults,
  computeAutoPosition,
  buildGraphEdges,
  buildGraphNodes,
  remapNavigateTargets
} from '../lib/graph-utils'
import {
  PREVIEW_PLACEHOLDER_ID,
  createPreviewRenderScreen,
  createPreviewPlaceholderScreen,
  renderPreviewValueTemplate,
  getMenuItemFromPreviewAction,
  getMenuActionFromPreviewAction
} from '../lib/preview-utils'
import {
  clampDrawStepCount,
  coerceDrawNumber,
  compileMotionToDrawing,
  createDefaultCanvas,
  createDefaultCanvasMotion,
  createDefaultDrawing,
  createDefaultMotion,
  createDefaultMotionTrack,
  createDefaultDrawStep,
  getDrawStepFieldLimit,
  isDrawStepNumericField,
  normalizeCanvas,
  normalizeMotion
} from '../lib/draw-utils'
import { GRAPH_TEMPLATES } from '../lib/graph-templates'

export default function useGraphEditor() {
  const [graph, setGraph] = useState(createDefaultGraph)
  const [selectedScreenId, setSelectedScreenId] = useState('root')
  const selectedScreenIdRef = useRef(selectedScreenId)
  selectedScreenIdRef.current = selectedScreenId
  const [selectedNodeId, setSelectedNodeId] = useState('')
  const [previewScreenId, setPreviewScreenId] = useState('root')
  const [previewPlaceholderScreen, setPreviewPlaceholderScreen] = useState(null)
  const [previewHistory, setPreviewHistory] = useState([])
  const [previewVars, setPreviewVars] = useState({})
  const [previewStorage, setPreviewStorage] = useState({})
  const [previewTimerDeadline, setPreviewTimerDeadline] = useState(null)
  const [previewTimerNow, setPreviewTimerNow] = useState(() => Date.now())
  const [importText, setImportText] = useState(() => JSON.stringify(createDefaultGraph(), null, 2))
  const [notice, setNotice] = useState({ type: 'idle', text: 'Ready' })
  const [bindingsDraftByScreen, setBindingsDraftByScreen] = useState({})
  const nodePositionsRef = useRef({})
  const runTargetPositionsRef = useRef({})
  const [visibleRunTargetIds, setVisibleRunTargetIds] = useState([])
  const [layoutTick, setLayoutTick] = useState(0)
  const [flowInstance, setFlowInstance] = useState(null)
  const [nodes, setNodes] = useNodesState([])
  const [edges, setEdges] = useEdgesState([])
  const [showImportExport, setShowImportExport] = useState(false)
  const schemaVersions = useMemo(() => schemaRegistry.listSchemaVersions(), [])

  const normalizedGraph = useMemo(() => {
    const withDefaults = compileVariableDefaults(graph)
    return graphSchema.normalizeCanonicalGraph(withDefaults)
  }, [graph])
  const graphBuilderSpec = useMemo(() => builderElements.deriveBuilderSpecFromGraph(graph), [graph])

  const selectedScreen = selectedNodeId && !isRunTargetId(selectedNodeId) ? graph.screens[selectedNodeId] || null : null
  const selectedRunTarget = selectedNodeId && isRunTargetId(selectedNodeId) ? getRunTargetDefinition(selectedNodeId) : null
  const previewScreen =
    previewScreenId === PREVIEW_PLACEHOLDER_ID
      ? previewPlaceholderScreen
      : graph.screens[previewScreenId] || null
  const selectedScreenType = selectedScreen ? String(selectedScreen.type || 'menu') : 'menu'
  const screenBuilderSpec = useMemo(
    () => builderElements.deriveBuilderSpecForScreen(selectedScreenType, graph.schemaVersion),
    [graph.schemaVersion, selectedScreenType]
  )
  const screenIds = Object.keys(graph.screens)
  const unmappedCount = useMemo(() => countUnmappedEntities(graph), [graph])
  const requiredRunTargetIds = useMemo(() => collectRequiredRunTargetIds(graph), [graph])
  const activeRunTargetIds = useMemo(
    () => Array.from(new Set(visibleRunTargetIds.concat(requiredRunTargetIds))),
    [requiredRunTargetIds, visibleRunTargetIds]
  )
  const selectedNodeUsages = useMemo(
    () => collectNodeUsages(graph, selectedNodeId),
    [graph, selectedNodeId]
  )
  const graphReferenceCatalog = useMemo(
    () => collectGraphReferenceCatalog(graph, selectedScreenId),
    [graph, selectedScreenId]
  )

  const normalizedExportText = normalizedGraph ? JSON.stringify(normalizedGraph, null, 2) : ''
  const canExport = !!normalizedGraph
  const previewRevision = useMemo(
    () => shortHash(normalizedExportText || JSON.stringify(graph)),
    [graph, normalizedExportText]
  )
  const previewRenderedScreen = useMemo(
    () => createPreviewRenderScreen(
      previewScreen,
      previewRevision,
      previewVars,
      previewStorage,
      { remaining: Math.max(0, previewTimerDeadline ? Math.ceil((previewTimerDeadline - previewTimerNow) / 1000) : 0) }
    ),
    [previewScreen, previewRevision, previewVars, previewStorage, previewTimerDeadline, previewTimerNow]
  )

  function buildCompiledMotionState(rawMotion, rawCanvas) {
    const canvas = normalizeCanvas(rawCanvas)
    const motion = normalizeMotion(
      rawMotion || (canvas.template === 'header_list' ? createDefaultCanvasMotion(canvas) : createDefaultMotion())
    )
    return {
      canvas,
      motion,
      drawing: compileMotionToDrawing(motion, canvas)
    }
  }

  // --- Callbacks ---

  const handleAddMenuItemFromGraph = useCallback((screenId) => {
    let added = false

    setGraph((prev) => {
      const screen = prev.screens[screenId]
      if (!screen || screen.type !== 'menu') {
        return prev
      }

      const items = Array.isArray(screen.items) ? screen.items.slice() : []
      if (items.length >= graphBuilderSpec.limits.maxMenuItems) {
        return prev
      }

      const id = ensureUniqueEntityId(items, 'item', 'item')
      items.push({ id, label: 'New Item', value: '', labelTemplate: '', run: null })
      added = true

      return {
        ...prev,
        screens: {
          ...prev.screens,
          [screenId]: {
            ...screen,
            items
          }
        }
      }
    })

    if (!added) {
      setNotice({ type: 'error', text: 'Maximum menu items reached' })
      return
    }

    setSelectedScreenId(screenId)
    setSelectedNodeId(screenId)
    setNotice({ type: 'success', text: `Added menu item to ${screenId}` })
  }, [graphBuilderSpec.limits.maxMenuItems])

  const handleAddDrawerItemFromGraph = useCallback((screenId) => {
    let added = false

    setGraph((prev) => {
      const screen = prev.screens[screenId]
      if (!screen || !screenUsesSelectDrawer(screen)) {
        return prev
      }

      const actions = getScreenActions(screen).slice()
      if (actions.length >= graphBuilderSpec.limits.maxMenuActions) {
        return prev
      }

      const id = ensureUniqueEntityId(actions, 'drawer_item', 'drawer_item')
      actions.push({
        id,
        label: 'Drawer Item',
        value: '',
        run: null
      })
      added = true

      return {
        ...prev,
        screens: {
          ...prev.screens,
          [screenId]: {
            ...screen,
            actions
          }
        }
      }
    })

    if (!added) {
      setNotice({ type: 'error', text: 'Maximum action-menu items reached' })
      return
    }

    setSelectedScreenId(screenId)
    setSelectedNodeId(screenId)
    setNotice({ type: 'success', text: `Added action-menu item to ${screenId}` })
  }, [graphBuilderSpec.limits.maxMenuActions])

  // --- Effects ---

  useEffect(() => {
    if (!graph.screens[selectedScreenId]) {
      setSelectedScreenId(graph.entryScreenId)
    }
  }, [graph, selectedScreenId])

  useEffect(() => {
    if (selectedNodeId && !isRunTargetId(selectedNodeId) && !graph.screens[selectedNodeId]) {
      setSelectedNodeId('')
    }
  }, [graph, selectedNodeId])

  useEffect(() => {
    if (previewScreenId !== PREVIEW_PLACEHOLDER_ID && !graph.screens[previewScreenId]) {
      setPreviewScreenId(graph.entryScreenId)
      setPreviewPlaceholderScreen(null)
      setPreviewHistory([])
    }
  }, [graph, previewScreenId])

  useEffect(() => {
    let nextVars = {}
    let nextStorage = {}

    const entryId = previewScreenId !== PREVIEW_PLACEHOLDER_ID ? previewScreenId : graph.entryScreenId
    const entryScreen = graph.screens[entryId]
    if (entryScreen && Array.isArray(entryScreen.onEnter) && entryScreen.onEnter.length > 0) {
      const result = executePreviewHookSequence(entryScreen.onEnter, entryScreen, nextVars, nextStorage)
      nextVars = result.vars
      nextStorage = result.storage
    }

    setPreviewVars(nextVars)
    setPreviewStorage(nextStorage)
    setPreviewTimerDeadline(null)
    setPreviewTimerNow(Date.now())
  }, [previewRevision])

  useEffect(() => {
    if (!previewTimerDeadline) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setPreviewTimerNow(Date.now())
    }, 250)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [previewTimerDeadline])

  useEffect(() => {
    if (!previewTimerDeadline || previewScreenId === PREVIEW_PLACEHOLDER_ID || !previewScreen?.timer?.run) {
      return
    }

    if (previewTimerNow < previewTimerDeadline) {
      return
    }

    setPreviewTimerDeadline(null)
    runPreviewAction(previewScreen.timer.run, 'screen timer', previewScreen)
  }, [previewScreen, previewScreenId, previewTimerDeadline, previewTimerNow])

  useEffect(() => {
    const nextNodes = buildGraphNodes(
      graph,
      normalizedGraph,
      nodePositionsRef.current,
      selectedNodeId,
      activeRunTargetIds,
      runTargetPositionsRef.current,
      {
        onAddMenuItem: handleAddMenuItemFromGraph,
        onAddDrawerItem: handleAddDrawerItemFromGraph
      }
    )
    setNodes(nextNodes)
  }, [activeRunTargetIds, graph, handleAddDrawerItemFromGraph, handleAddMenuItemFromGraph, layoutTick, normalizedGraph, selectedNodeId, setNodes])

  useEffect(() => {
    setEdges(buildGraphEdges(graph, { focusedNodeId: selectedNodeId }))
  }, [graph, selectedNodeId, setEdges])

  // --- Node change handler ---

  const handleNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => {
        const next = applyNodeChanges(changes, nds)
        changes.forEach((change) => {
          if (change.type === 'position' && change.position) {
            if (isRunTargetId(change.id)) {
              runTargetPositionsRef.current = { ...runTargetPositionsRef.current, [change.id]: change.position }
            } else {
              nodePositionsRef.current = { ...nodePositionsRef.current, [change.id]: change.position }
            }
          }
        })
        return next
      })
    },
    [setNodes]
  )

  // --- Helper fns used by mutations ---

  function buildRunForCanvasTarget(targetId, existingRun = {}) {
    if (isRunTargetId(targetId)) {
      return createRunFromTargetId(targetId, existingRun)
    }

    if (graph.screens[targetId]) {
      return pruneRunForType('navigate', { ...(existingRun || {}), screen: targetId })
    }

    return null
  }

  function createRunFromTargetId(targetId, existingRun = {}) {
    const target = getRunTargetDefinition(targetId)
    if (!target) {
      return null
    }

    if (target.runType === 'agent_prompt') {
      return pruneRunForType('agent_prompt', {
        ...existingRun,
        type: 'agent_prompt',
        prompt: existingRun.prompt || 'Ask the agent to help with this action.'
      })
    }

    if (target.runType === 'agent_command') {
      return pruneRunForType('agent_command', {
        ...existingRun,
        type: 'agent_command',
        command: existingRun.command || 'reset'
      })
    }

    if (target.runType === 'effect') {
      return pruneRunForType('effect', {
        ...existingRun,
        type: 'effect',
        vibe: existingRun.vibe || 'short',
        light: !!existingRun.light
      })
    }

    if (target.runType === 'set_var') {
      return pruneRunForType('set_var', {
        ...existingRun,
        type: 'set_var',
        key: existingRun.key || 'count',
        value: existingRun.value || 'increment'
      })
    }

    if (target.runType === 'store') {
      return pruneRunForType('store', {
        ...existingRun,
        type: 'store',
        key: existingRun.key || 'high_score',
        value: existingRun.value || '{{var.count}}'
      })
    }

    return null
  }

  function createDefaultScreenHookRun() {
    return pruneRunForType('effect', {
      type: 'effect',
      vibe: 'short'
    })
  }

  function createDefaultScreenTimer() {
    return {
      durationMs: 5000,
      run: pruneRunForType('effect', {
        type: 'effect',
        vibe: 'short'
      })
    }
  }

  function describeCanvasTarget(targetId) {
    if (isRunTargetId(targetId)) {
      return getRunTargetDefinition(targetId)?.title || targetId
    }
    const targetScreen = graph.screens[targetId]
    return targetScreen?.title || targetId
  }

  function defaultCardActionLabelForLink(slot, targetId) {
    const targetName = describeCanvasTarget(targetId)
    return isRunTargetId(targetId) ? `${slot} ${targetName}` : `${slot} → ${targetName}`
  }

  function defaultMenuActionLabelForLink(targetId) {
    const targetName = describeCanvasTarget(targetId)
    return isRunTargetId(targetId) ? targetName : `Open ${targetName}`
  }

  function updateSelectedScreen(mutator) {
    const id = selectedScreenIdRef.current
    setGraph((prev) => {
      const screen = prev.screens[id]
      if (!screen) {
        return prev
      }

      const nextScreen = mutator(screen)
      return {
        ...prev,
        screens: {
          ...prev.screens,
          [id]: nextScreen
        }
      }
    })
  }

  // --- Mutation functions ---

  function resetLayout() {
    const auto = {}
    screenIds.forEach((id, index) => {
      auto[id] = computeAutoPosition(index, screenIds.length)
    })
    nodePositionsRef.current = auto
    runTargetPositionsRef.current = {}
    setLayoutTick((tick) => tick + 1)
    setNotice({ type: 'success', text: 'Reset canvas layout' })
    setTimeout(() => flowInstance?.fitView({ padding: 0.22, duration: 400 }), 10)
  }

  function addRunTargetNode(targetId, options = {}) {
    if (!targetId || !isRunTargetId(targetId)) {
      return
    }

    const target = getRunTargetDefinition(targetId)
    if (!target || !graphBuilderSpec.enums.runTypes.includes(target.runType)) {
      setNotice({ type: 'error', text: `Run target not supported by ${graph.schemaVersion}` })
      return
    }

    if (options.position) {
      runTargetPositionsRef.current = { ...runTargetPositionsRef.current, [targetId]: options.position }
    }
    setVisibleRunTargetIds((prev) => (prev.includes(targetId) ? prev : prev.concat(targetId)))
    setSelectedNodeId(targetId)
    setNotice({ type: 'success', text: `Added ${target.title || 'logic node'} to canvas` })
    setTimeout(() => flowInstance?.fitView({ padding: 0.22, duration: 250 }), 10)
  }

  function focusNode(targetId) {
    if (!targetId) {
      return
    }

    setSelectedNodeId(targetId)
    if (!isRunTargetId(targetId) && graph.screens[targetId]) {
      setSelectedScreenId(targetId)
      setPreviewPlaceholderScreen(null)
      setPreviewScreenId(targetId)
      setPreviewHistory([])
    }
  }

  const clearLinkByHandle = useCallback(function clearLinkByHandle(sourceScreenId, sourceHandle) {
    let removed = false

    setGraph((prev) => {
      const screen = prev.screens[sourceScreenId]
      if (!screen) {
        return prev
      }

      if (sourceHandle.startsWith('item-')) {
        const key = sourceHandle.slice('item-'.length)
        const items = Array.isArray(screen.items) ? screen.items : []
        const nextItems = items.map((item, idx) => {
          const matchId = item.id ? String(item.id) === key : false
          const matchIndex = !item.id && String(idx) === key
          if (!matchId && !matchIndex) {
            return item
          }
          removed = !!item.run
          return { ...item, run: null }
        })
        if (!removed) {
          return prev
        }
        return {
          ...prev,
          screens: {
            ...prev.screens,
            [sourceScreenId]: {
              ...screen,
              items: nextItems
            }
          }
        }
      }

      if (sourceHandle.startsWith('action-') || sourceHandle.startsWith('slot-')) {
        const isSlot = sourceHandle.startsWith('slot-')
        const key = isSlot ? sourceHandle.slice('slot-'.length) : sourceHandle.slice('action-'.length)
        const actions = getScreenActions(screen)
        const nextActions = actions.map((action, idx) => {
          const match = isSlot
            ? action.slot === key
            : (action.id ? String(action.id) === key : String(idx) === key)
          if (!match) {
            return action
          }
          removed = !!action.run
          return { ...action, run: null }
        })
        if (!removed) {
          return prev
        }
        return {
          ...prev,
          screens: {
            ...prev.screens,
            [sourceScreenId]: {
              ...screen,
              actions: nextActions
            }
          }
        }
      }

      if (sourceHandle.startsWith('hook-')) {
        const parts = sourceHandle.slice('hook-'.length).split('-')
        const hookKey = parts[0]
        const hookIndex = parseInt(parts[1], 10)
        const hooks = Array.isArray(screen[hookKey]) ? [...screen[hookKey]] : []
        if (hooks[hookIndex]) {
          removed = true
          hooks.splice(hookIndex, 1)
          return {
            ...prev,
            screens: {
              ...prev.screens,
              [sourceScreenId]: {
                ...screen,
                [hookKey]: hooks
              }
            }
          }
        }
      }

      if (sourceHandle === 'timer-run' && screen.timer) {
        removed = true
        return {
          ...prev,
          screens: {
            ...prev.screens,
            [sourceScreenId]: {
              ...screen,
              timer: { ...screen.timer, run: null }
            }
          }
        }
      }

      return prev
    })

    if (removed) {
      setNotice({ type: 'success', text: `Removed link from ${sourceHandle}` })
    }
  }, [setGraph, setNotice])

  const handleEdgesDelete = useCallback((deletedEdges) => {
    ;(deletedEdges || []).forEach((edge) => {
      if (edge?.data?.source && edge?.data?.sourceHandle) {
        clearLinkByHandle(edge.data.source, edge.data.sourceHandle)
      }
    })
  }, [clearLinkByHandle])

  function applyPreviewScreenState(screenId, options = {}) {
    setPreviewPlaceholderScreen(null)
    setPreviewScreenId(screenId)
    if (Object.prototype.hasOwnProperty.call(options, 'nextTimerDeadline')) {
      setPreviewTimerNow(Date.now())
      setPreviewTimerDeadline(options.nextTimerDeadline)
    }

    const historySourceId = options.historySourceId || previewScreenId
    if (options.resetHistory) {
      setPreviewHistory([])
    } else if (options.pushHistory && historySourceId && historySourceId !== screenId) {
      setPreviewHistory((prev) => prev.concat(historySourceId))
    }
  }

  function normalizePreviewVarKey(rawKey) {
    return String(rawKey || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/^_+/, '')
      .replace(/_+$/, '')
  }

  function parsePreviewConditionValue(rawValue) {
    const text = String(rawValue ?? '').trim()
    if (!text) {
      return ''
    }
    if (text === 'true') {
      return true
    }
    if (text === 'false') {
      return false
    }
    if (/^-?\d+(\.\d+)?$/.test(text)) {
      return Number(text)
    }
    return text
  }

  function evaluatePreviewCondition(condition, vars) {
    if (!condition || typeof condition !== 'object') {
      return true
    }

    const key = normalizePreviewVarKey(condition.var)
    const op = String(condition.op || '').toLowerCase()
    if (!key || !op) {
      return false
    }

    const left = vars[key]
    const right = parsePreviewConditionValue(condition.value)
    const leftNumber = Number(left)
    const rightNumber = Number(right)
    const numbersComparable = Number.isFinite(leftNumber) && Number.isFinite(rightNumber)

    if (op === 'eq') {
      return String(left ?? '') === String(right ?? '')
    }
    if (op === 'neq') {
      return String(left ?? '') !== String(right ?? '')
    }
    if (!numbersComparable) {
      return false
    }
    if (op === 'gt') {
      return leftNumber > rightNumber
    }
    if (op === 'gte') {
      return leftNumber >= rightNumber
    }
    if (op === 'lt') {
      return leftNumber < rightNumber
    }
    if (op === 'lte') {
      return leftNumber <= rightNumber
    }

    return false
  }

  function applyPreviewVarMutationToState(run, vars) {
    const key = normalizePreviewVarKey(run?.key)
    const valueSpec = String(run?.value || '').trim()
    if (!key || !valueSpec) {
      return null
    }

    const nextVars = { ...(vars || {}) }
    const current = nextVars[key]
    let nextValue = valueSpec

    if (valueSpec === 'increment') {
      const numeric = Number(current)
      nextValue = Number.isFinite(numeric) ? numeric + 1 : 1
    } else if (valueSpec === 'decrement') {
      const numeric = Number(current)
      nextValue = Number.isFinite(numeric) ? numeric - 1 : -1
    } else if (valueSpec === 'toggle') {
      nextValue = !(current === true || String(current).toLowerCase() === 'true')
    } else if (valueSpec.indexOf('literal:') === 0) {
      nextValue = valueSpec.slice('literal:'.length)
    } else if (valueSpec === 'true') {
      nextValue = true
    } else if (valueSpec === 'false') {
      nextValue = false
    } else if (/^-?\d+(\.\d+)?$/.test(valueSpec)) {
      nextValue = Number(valueSpec)
    }

    nextVars[key] = nextValue
    return nextVars
  }

  function applyPreviewVarMutation(run) {
    const nextVars = applyPreviewVarMutationToState(run, previewVars)
    if (!nextVars) {
      return false
    }
    setPreviewVars(nextVars)
    return true
  }

  function applyPreviewStorageMutationToState(run, sourceScreen, vars, storage) {
    const key = normalizePreviewVarKey(run?.key)
    const valueSpec = String(run?.value || '').trim()
    if (!key || !valueSpec) {
      return null
    }

    const resolvedValue = renderPreviewValueTemplate(valueSpec, sourceScreen, vars, storage)
    return {
      ...(storage || {}),
      [key]: String(resolvedValue ?? '')
    }
  }

  function applyPreviewStorageMutation(run, sourceScreen) {
    const nextStorage = applyPreviewStorageMutationToState(run, sourceScreen, previewVars, previewStorage)
    if (!nextStorage) {
      return false
    }
    setPreviewStorage(nextStorage)
    return true
  }

  function executePreviewHookRun(run, sourceScreen, vars, storage) {
    if (!run || !run.type) {
      return { vars, storage, redirect: '' }
    }

    if (run.type === 'navigate') {
      if (!evaluatePreviewCondition(run.condition, vars)) {
        return { vars, storage, redirect: '' }
      }
      return {
        vars,
        storage,
        redirect: run.screen || ''
      }
    }

    if (run.type === 'set_var') {
      const nextVars = applyPreviewVarMutationToState(run, vars)
      return {
        vars: nextVars || vars,
        storage,
        redirect: ''
      }
    }

    if (run.type === 'store') {
      const nextStorage = applyPreviewStorageMutationToState(run, sourceScreen, vars, storage)
      return {
        vars,
        storage: nextStorage || storage,
        redirect: ''
      }
    }

    if (run.type === 'effect') {
      return { vars, storage, redirect: '' }
    }

    return { vars, storage, redirect: '' }
  }

  function executePreviewHookSequence(runs, sourceScreen, vars, storage) {
    let nextVars = { ...(vars || {}) }
    let nextStorage = { ...(storage || {}) }
    let redirect = ''

    ;(runs || []).forEach((run) => {
      const result = executePreviewHookRun(run, sourceScreen, nextVars, nextStorage)
      nextVars = result.vars
      nextStorage = result.storage
      if (result.redirect) {
        redirect = result.redirect
      }
    })

    return {
      vars: nextVars,
      storage: nextStorage,
      redirect
    }
  }

  function jumpPreviewTo(screenId, options = {}) {
    if (!screenId || !graph.screens[screenId]) {
      return false
    }

    let targetScreenId = screenId
    let nextVars = { ...previewVars }
    let nextStorage = { ...previewStorage }
    const shouldRunLifecycle = options.runLifecycle !== false
    const sourceScreen =
      options.sourceScreen ||
      (previewScreenId !== PREVIEW_PLACEHOLDER_ID ? graph.screens[previewScreenId] || null : null)

    if (sourceScreen && sourceScreen.id === targetScreenId && !options.forceLifecycle) {
      applyPreviewScreenState(targetScreenId, options)
      return true
    }

    if (shouldRunLifecycle && sourceScreen && sourceScreen.id !== targetScreenId) {
      const exitResult = executePreviewHookSequence(sourceScreen.onExit, sourceScreen, nextVars, nextStorage)
      nextVars = exitResult.vars
      nextStorage = exitResult.storage
      if (exitResult.redirect) {
        targetScreenId = exitResult.redirect
      }
    }

    let depth = 0
    while (shouldRunLifecycle && depth < 8) {
      const nextScreen = graph.screens[targetScreenId]
      if (!nextScreen) {
        return false
      }

      const enterResult = executePreviewHookSequence(nextScreen.onEnter, nextScreen, nextVars, nextStorage)
      nextVars = enterResult.vars
      nextStorage = enterResult.storage
      if (enterResult.redirect && enterResult.redirect !== targetScreenId) {
        targetScreenId = enterResult.redirect
        depth += 1
        continue
      }
      break
    }

    if (depth >= 8) {
      return false
    }

    const targetScreen = graph.screens[targetScreenId]
    const nextTimerDeadline =
      targetScreen?.timer && (sourceScreen?.id !== targetScreenId || options.forceLifecycle)
        ? Date.now() + Math.max(100, Number(targetScreen.timer.durationMs || 5000))
        : sourceScreen?.id === targetScreenId
          ? previewTimerDeadline
          : null

    setPreviewVars(nextVars)
    setPreviewStorage(nextStorage)
    applyPreviewScreenState(targetScreenId, { ...options, nextTimerDeadline })
    return true
  }

  function runPreviewAction(run, sourceLabel, sourceScreen = previewScreen) {
    if (!run || !run.type) {
      return
    }

    if (run.type === 'effect') {
      const parts = []
      if (run.vibe) {
        parts.push(`vibe ${run.vibe}`)
      }
      if (run.light) {
        parts.push('backlight')
      }
      setNotice({ type: 'success', text: parts.length ? `Preview fired ${parts.join(' + ')}` : 'Preview fired native effect' })
      return
    }

    if (run.type === 'navigate') {
      if (!evaluatePreviewCondition(run.condition, previewVars)) {
        setNotice({ type: 'idle', text: `Preview condition blocked ${sourceLabel}` })
        return
      }
      if (previewScreenId === PREVIEW_PLACEHOLDER_ID) {
        setPreviewHistory((prev) => prev.slice(0, -1))
      }
      if (jumpPreviewTo(run.screen, { pushHistory: previewScreenId !== PREVIEW_PLACEHOLDER_ID, forceLifecycle: true })) {
        setNotice({ type: 'success', text: `Preview navigated via ${sourceLabel}` })
      } else {
        setNotice({ type: 'error', text: `Preview target "${run.screen}" is missing` })
      }
      return
    }

    if (run.type === 'set_var') {
      if (applyPreviewVarMutation(run)) {
        setNotice({ type: 'success', text: `Preview updated ${run.key}` })
      } else {
        setNotice({ type: 'error', text: 'Preview variable update is incomplete' })
      }
      return
    }

    if (run.type === 'store') {
      if (applyPreviewStorageMutation(run, sourceScreen)) {
        setNotice({ type: 'success', text: `Preview stored ${run.key}` })
      } else {
        setNotice({ type: 'error', text: 'Preview storage update is incomplete' })
      }
      return
    }

    const originScreenId = previewScreenId !== PREVIEW_PLACEHOLDER_ID ? previewScreenId : previewHistory[previewHistory.length - 1]
    setPreviewHistory((prev) => (originScreenId ? prev.concat(originScreenId) : prev))
    setPreviewPlaceholderScreen(createPreviewPlaceholderScreen(run, sourceLabel, originScreenId, previewRevision))
    setPreviewScreenId(PREVIEW_PLACEHOLDER_ID)
    setNotice({ type: 'success', text: `Opened preview placeholder for ${run.type}` })
  }

  function handlePreviewActionMessage(action) {
    if (!action || !action.type) {
      return
    }

    if (action.type === ACTION_TYPES.READY) {
      setNotice({ type: 'success', text: 'Stewie preview ready' })
      return
    }

    if (action.type === ACTION_TYPES.BACK) {
      if (previewHistory.length === 0) {
        setNotice({ type: 'idle', text: 'Preview is already at the root of its history' })
        return
      }
      const previousScreenId = previewHistory[previewHistory.length - 1]
      setPreviewHistory((prev) => prev.slice(0, -1))
      if (jumpPreviewTo(previousScreenId, { historySourceId: previewScreenId, sourceScreen: previewScreen, forceLifecycle: true })) {
        setNotice({ type: 'success', text: `Preview returned to "${previousScreenId}"` })
      } else {
        setNotice({ type: 'error', text: `Preview target "${previousScreenId}" is missing` })
      }
      return
    }

    if (action.type === ACTION_TYPES.VOICE) {
      setNotice({ type: 'success', text: 'Dictation result received (preview only)' })
      return
    }

    if (action.type !== ACTION_TYPES.SELECT) {
      return
    }

    const sourceScreen =
      action.screenId === PREVIEW_PLACEHOLDER_ID
        ? previewPlaceholderScreen
        : graph.screens[action.screenId] || previewScreen

    if (!sourceScreen) {
      return
    }

    if (sourceScreen.type === 'menu') {
      const menuAction = getMenuActionFromPreviewAction(action, sourceScreen)
      if (menuAction) {
        runPreviewAction(menuAction.run, menuAction.label || menuAction.id || 'action menu item', sourceScreen)
        return
      }

      const item = getMenuItemFromPreviewAction(action, sourceScreen)
      if (!item) {
        setNotice({ type: 'error', text: 'Preview select did not match a menu item or action-menu item' })
        return
      }
      runPreviewAction(item.run, item.label || item.id || 'menu item', sourceScreen)
      return
    }

    const actions = getScreenActions(sourceScreen)
    const selectedAction = action.itemId
      ? actions.find((candidate) => candidate && candidate.id === action.itemId)
      : null

    if (!selectedAction) {
      setNotice({ type: 'error', text: 'Preview select did not match a screen action or action-menu item' })
      return
    }

    runPreviewAction(selectedAction.run, selectedAction.label || selectedAction.id || 'screen action', sourceScreen)
  }

  const handleToSlot = {
    'slot-up': 'up',
    'slot-select': 'select',
    'slot-down': 'down'
  }

  const handleConnect = useCallback(
    (connection) => {
      const { source, sourceHandle, target } = connection
      if (!source || !sourceHandle || !target) {
        return
      }

      const screen = graph.screens[source]
      if (!screen) {
        return
      }

      if (handleToSlot[sourceHandle]) {
        if (!screenUsesButtonSlots(screen)) {
          setNotice({ type: 'error', text: 'Button slot links currently create card action-bar actions.' })
          return
        }

        const slot = handleToSlot[sourceHandle]
        const existingAction = getScreenActions(screen).find((action) => action.slot === slot)

        if (existingAction) {
          setGraph((prev) => {
            const currentScreen = prev.screens[source]
            if (!currentScreen || currentScreen.type !== 'card') {
              return prev
            }

            const nextActions = getScreenActions(currentScreen).map((action) => {
              if (action.slot !== slot) {
                return action
              }
              return {
                ...action,
                value: isRunTargetId(target) ? slot : target,
                run: buildRunForCanvasTarget(target, action.run || {})
              }
            })

            return {
              ...prev,
              screens: {
                ...prev.screens,
                [source]: {
                  ...currentScreen,
                  actions: nextActions
                }
              }
            }
          })
          setNotice({ type: 'success', text: `Linked ${slot} to ${describeCanvasTarget(target)}` })
          setSelectedScreenId(source)
          setSelectedNodeId(source)
          return
        }

        setGraph((prev) => {
          const currentScreen = prev.screens[source]
          if (!currentScreen || currentScreen.type !== 'card') {
            return prev
          }

          const actions = getScreenActions(currentScreen).slice()
          actions.push({
            slot,
            id: ensureUniqueEntityId(actions, `${slot}_action`, 'action'),
            icon: 'check',
            label: defaultCardActionLabelForLink(slot, target),
            value: isRunTargetId(target) ? slot : target,
            run: buildRunForCanvasTarget(target)
          })

          return {
            ...prev,
            screens: {
              ...prev.screens,
              [source]: {
                ...currentScreen,
                actions
              }
            }
          }
        })
        setNotice({ type: 'success', text: `Created ${slot} action to ${describeCanvasTarget(target)}` })
        setSelectedScreenId(source)
        setSelectedNodeId(source)
        return
      }

      if (sourceHandle === 'menu-action-create') {
        if (!screenUsesSelectDrawer(screen)) {
          setNotice({ type: 'error', text: 'Action-menu links apply to scroll screens' })
          return
        }

        if (getScreenActions(screen).length >= graphBuilderSpec.limits.maxMenuActions) {
          setNotice({ type: 'error', text: 'Maximum action-menu items reached' })
          return
        }

        setGraph((prev) => {
          const currentScreen = prev.screens[source]
          if (!currentScreen || !screenUsesSelectDrawer(currentScreen)) {
            return prev
          }

          const actions = getScreenActions(currentScreen).slice()
          actions.push({
            id: ensureUniqueEntityId(actions, 'drawer_item', 'drawer_item'),
            label: defaultMenuActionLabelForLink(target),
            value: isRunTargetId(target) ? '' : target,
            run: buildRunForCanvasTarget(target)
          })

          return {
            ...prev,
            screens: {
              ...prev.screens,
              [source]: {
                ...currentScreen,
                actions
              }
            }
          }
        })
        setNotice({ type: 'success', text: `Created action-menu item to ${describeCanvasTarget(target)}` })
        setSelectedScreenId(source)
        setSelectedNodeId(source)
        return
      }

      setGraph((prev) => {
        const currentScreen = prev.screens[source]
        if (!currentScreen) {
          return prev
        }

        if (sourceHandle.startsWith('item-')) {
          if (currentScreen.type !== 'menu') {
            setNotice({ type: 'error', text: 'Item links apply to menu screens' })
            return prev
          }
          const key = sourceHandle.slice('item-'.length)
          const items = Array.isArray(currentScreen.items) ? currentScreen.items.slice() : []
          const nextItems = items.map((item, idx) => {
            const matchId = item.id ? String(item.id) === key : false
            const matchIndex = !item.id && String(idx) === key
            if (!matchId && !matchIndex) {
              return item
            }
            return {
              ...item,
              run: buildRunForCanvasTarget(target, item.run || {})
            }
          })

          setNotice({ type: 'success', text: `Linked item to ${describeCanvasTarget(target)}` })
          setSelectedScreenId(source)
          setSelectedNodeId(source)
          return {
            ...prev,
            screens: {
              ...prev.screens,
              [source]: {
                ...currentScreen,
                items: nextItems
              }
            }
          }
        }

        if (sourceHandle.startsWith('action-')) {
          if (!screenSupportsActions(currentScreen)) {
            setNotice({ type: 'error', text: 'Action links apply to screens with actions' })
            return prev
          }
          const key = sourceHandle.slice('action-'.length)
          const actions = getScreenActions(currentScreen).slice()
          const nextActions = actions.map((action, idx) => {
            const matchId = action.id ? String(action.id) === key : false
            const matchIndex = !action.id && String(idx) === key
            if (!matchId && !matchIndex) {
              return action
            }
            return {
              ...action,
              run: buildRunForCanvasTarget(target, action.run || {}),
              value: isRunTargetId(target) ? action.value || action.label || action.id : target
            }
          })

          setNotice({ type: 'success', text: `Linked ${screenUsesSelectDrawer(currentScreen) ? 'action-menu item' : 'action'} to ${describeCanvasTarget(target)}` })
          setSelectedScreenId(source)
          setSelectedNodeId(source)
          return {
            ...prev,
            screens: {
              ...prev.screens,
              [source]: {
                ...currentScreen,
                actions: nextActions
              }
            }
          }
        }

        setNotice({ type: 'error', text: 'Handle not linkable' })
        return prev
      })
    },
    [graph, graphBuilderSpec]
  )

  // --- Screen mutations ---

  function renameSelectedScreen(rawId) {
    const nextId = ensureUniqueScreenId(graph, rawId, selectedScreenId)
    if (!nextId || nextId === selectedScreenId) {
      updateSelectedScreen((screen) => ({ ...screen, id: nextId || selectedScreenId }))
      return
    }

    setGraph((prev) => {
      const current = prev.screens[selectedScreenId]
      if (!current) {
        return prev
      }

      const screens = { ...prev.screens }
      delete screens[selectedScreenId]
      screens[nextId] = { ...current, id: nextId }

      const patched = remapNavigateTargets(screens, selectedScreenId, nextId)

      return {
        ...prev,
        entryScreenId: prev.entryScreenId === selectedScreenId ? nextId : prev.entryScreenId,
        screens: patched
      }
    })

    const posNext = { ...nodePositionsRef.current }
    if (posNext[selectedScreenId]) {
      posNext[nextId] = posNext[selectedScreenId]
      delete posNext[selectedScreenId]
    }
    nodePositionsRef.current = posNext
    setLayoutTick((tick) => tick + 1)

    setSelectedScreenId(nextId)
    setSelectedNodeId(nextId)
    setPreviewScreenId((current) => (current === selectedScreenId ? nextId : current))
    setNotice({ type: 'success', text: `Screen renamed to ${nextId}` })
  }

  function updateScreenField(field, rawValue) {
    if (!selectedScreen) {
      return
    }

    if (field.id === 'id') {
      renameSelectedScreen(rawValue)
      return
    }

    if (field.id === 'type') {
      const val = String(rawValue || 'menu').toLowerCase()
      const nextType =
        val === 'card' ? 'card' : val === 'scroll' ? 'scroll' : val === 'draw' ? 'draw' : 'menu'
      if (!graphBuilderSpec.enums.screenTypes.includes(nextType)) {
        setNotice({ type: 'error', text: `Screen type not supported by ${graph.schemaVersion}` })
        return
      }
      updateSelectedScreen((screen) => {
        const next = {
          ...screen,
          type: nextType,
          input: {
            ...(screen.input || {}),
            mode: screen.input && screen.input.mode ? screen.input.mode : 'menu'
          }
        }

        if (nextType === 'menu') {
          next.items = Array.isArray(screen.items) ? screen.items : []
          delete next.drawing
          delete next.motion
          delete next.canvas
          delete next.actions
        } else if (nextType === 'card') {
          next.actions = getScreenActions(screen)
          delete next.drawing
          delete next.motion
          delete next.canvas
          delete next.items
        } else if (nextType === 'scroll') {
          next.actions = getScreenActions(screen)
          delete next.drawing
          delete next.motion
          delete next.canvas
          delete next.items
        } else {
          const baseCanvas = screen.canvas || createDefaultCanvas({ header: screen.title || 'New Draw' })
          const compiled = buildCompiledMotionState(screen.motion, baseCanvas)
          next.canvas = compiled.canvas
          next.motion = compiled.motion
          next.drawing = compiled.drawing
          if (!next.body && !next.bodyTemplate) {
            next.body = 'Animated drawing'
          }
          delete next.items
          delete next.actions
        }

        return next
      })
      return
    }

    if (field.id === 'bindings') {
      return
    }

    const typedValue =
      field.type === 'enum' ? String(rawValue || '').toLowerCase() : String(rawValue || '')
    const limitedValue =
      field.maxLen && typeof typedValue === 'string'
        ? typedValue.slice(0, field.maxLen)
        : typedValue

    updateSelectedScreen((screen) => updateEntityField(screen, field.id, limitedValue))
  }

  function getBindingsDraft() {
    if (!selectedScreen) {
      return ''
    }

    if (bindingsDraftByScreen[selectedScreenId] !== undefined) {
      return bindingsDraftByScreen[selectedScreenId]
    }

    return toPrettyJson(selectedScreen.bindings)
  }

  function updateBindingsDraft(value) {
    setBindingsDraftByScreen((prev) => ({ ...prev, [selectedScreenId]: value }))
  }

  function commitBindingsDraft() {
    const draft = getBindingsDraft().trim()

    if (!draft) {
      updateSelectedScreen((screen) => ({ ...screen, bindings: null }))
      setNotice({ type: 'success', text: 'Bindings cleared' })
      return
    }

    try {
      const parsed = JSON.parse(draft)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setNotice({ type: 'error', text: 'Bindings must be a JSON object' })
        return
      }

      updateSelectedScreen((screen) => ({ ...screen, bindings: parsed }))
      setNotice({ type: 'success', text: 'Bindings updated' })
    } catch (error) {
      setNotice({ type: 'error', text: `Bindings JSON error: ${error.message}` })
    }
  }

  function applyBindingsPreset(rawValue) {
    const availablePresets = bindingPresets.filter((presetItem) => {
      const requiredRunTypes = presetItem.requiresRunTypes || []
      return requiredRunTypes.every((runType) => graphBuilderSpec.enums.runTypes.includes(runType))
    })
    const preset = (availablePresets.find((presetItem) => presetItem.id === rawValue) || {}).value || ''

    if (!preset) {
      setBindingsDraftByScreen((prev) => ({ ...prev, [selectedScreenId]: '' }))
      updateSelectedScreen((screen) => ({ ...screen, bindings: null }))
      setNotice({ type: 'success', text: 'Bindings cleared' })
      return
    }

    setBindingsDraftByScreen((prev) => ({ ...prev, [selectedScreenId]: preset }))

    try {
      const parsed = JSON.parse(preset)
      updateSelectedScreen((screen) => ({ ...screen, bindings: parsed }))
      setNotice({ type: 'success', text: 'Bindings preset applied' })
    } catch (error) {
      setNotice({ type: 'error', text: `Preset JSON error: ${error.message}` })
    }
  }

  function ensureCurrentScreenBinding(preferredKey, bindingConfig) {
    if (!selectedScreen || !bindingConfig || typeof bindingConfig !== 'object') {
      return ''
    }

    const source = String(bindingConfig.source || '')
    let resolvedKey = ''
    let nextDraft = ''

    updateSelectedScreen((screen) => {
      const nextBindings = screen.bindings && typeof screen.bindings === 'object'
        ? { ...screen.bindings }
        : {}

      if (source) {
        const existingKey = Object.keys(nextBindings).find((key) => String(nextBindings[key]?.source || '') === source)
        if (existingKey) {
          resolvedKey = existingKey
          nextDraft = toPrettyJson(nextBindings)
          return screen
        }
      }

      const baseKey = sanitizeId(preferredKey || 'data', 'data')
      let candidate = baseKey
      let index = 2
      while (nextBindings[candidate]) {
        candidate = `${baseKey}_${index}`
        index += 1
      }

      nextBindings[candidate] = { ...bindingConfig }
      resolvedKey = candidate
      nextDraft = toPrettyJson(nextBindings)
      return {
        ...screen,
        bindings: nextBindings
      }
    })

    if (nextDraft) {
      setBindingsDraftByScreen((prev) => ({ ...prev, [selectedScreenId]: nextDraft }))
    }

    return resolvedKey
  }

  function addScreen(kind, options = {}) {
    const requestedType =
      kind === 'card' ? 'card' : kind === 'scroll' ? 'scroll' : kind === 'draw' ? 'draw' : 'menu'
    if (!graphBuilderSpec.enums.screenTypes.includes(requestedType)) {
      setNotice({ type: 'error', text: `Screen type not supported by ${graph.schemaVersion}` })
      return
    }
    const titles = { menu: 'New Menu', card: 'New Card', scroll: 'New Scroll', draw: 'New Draw' }
    const nextId = ensureUniqueScreenId(graph, 'screen', '')
    const nextScreen = {
      id: nextId,
      type: requestedType,
      title: titles[requestedType] || 'New Screen',
      body: requestedType === 'draw' ? 'Animated drawing' : '',
      titleTemplate: '',
      bodyTemplate: '',
      bindings: null,
      input: { mode: 'menu' },
      items: requestedType === 'menu' ? [] : undefined,
      actions: requestedType === 'scroll' || requestedType === 'card' ? [] : undefined,
      ...(requestedType === 'draw'
        ? buildCompiledMotionState(
            createDefaultCanvasMotion(createDefaultCanvas({ header: titles.draw })),
            createDefaultCanvas({ header: titles.draw })
          )
        : {})
    }

    setGraph((prev) => ({
      ...prev,
      screens: {
        ...prev.screens,
        [nextId]: nextScreen
      }
    }))

    if (options.position) {
      nodePositionsRef.current = { ...nodePositionsRef.current, [nextId]: options.position }
    }

    setSelectedScreenId(nextId)
    setSelectedNodeId(nextId)
    setPreviewPlaceholderScreen(null)
    setPreviewScreenId(nextId)
    setPreviewHistory([])
    setNotice({ type: 'success', text: `Added ${requestedType} ${nextId}` })
  }

  function deleteSelectedScreen() {
    const ids = Object.keys(graph.screens)
    if (!selectedScreen) {
      setNotice({ type: 'error', text: 'Select a screen to delete' })
      return
    }

    if (ids.length <= 1) {
      setNotice({ type: 'error', text: 'At least one screen is required' })
      return
    }

    const nextIds = ids.filter((id) => id !== selectedScreenId)
    const fallbackId = graph.entryScreenId === selectedScreenId ? nextIds[0] : graph.entryScreenId

    setGraph((prev) => {
      const nextScreens = { ...prev.screens }
      delete nextScreens[selectedScreenId]

      return {
        ...prev,
        entryScreenId: fallbackId,
        screens: nextScreens
      }
    })

    const posNext = { ...nodePositionsRef.current }
    delete posNext[selectedScreenId]
    nodePositionsRef.current = posNext
    setLayoutTick((tick) => tick + 1)

    setSelectedScreenId(fallbackId)
    setSelectedNodeId('')
    setPreviewPlaceholderScreen(null)
    setPreviewScreenId((current) => (current === selectedScreenId ? fallbackId : current))
    setNotice({ type: 'success', text: `Removed ${selectedScreenId}` })
  }

  function addMenuItem() {
    if (!selectedScreen || selectedScreen.type !== 'menu') {
      return
    }

    if ((selectedScreen.items || []).length >= graphBuilderSpec.limits.maxMenuItems) {
      setNotice({ type: 'error', text: 'Maximum menu items reached' })
      return
    }

    updateSelectedScreen((screen) => {
      const items = Array.isArray(screen.items) ? screen.items.slice() : []
      const id = ensureUniqueEntityId(items, 'item', 'item')
      items.push({ id, label: 'New Item', value: '', labelTemplate: '', run: null })
      return { ...screen, items }
    })
  }

  function removeMenuItem(index) {
    updateSelectedScreen((screen) => {
      const items = Array.isArray(screen.items) ? screen.items.slice() : []
      items.splice(index, 1)
      return { ...screen, items }
    })
  }

  function updateMenuItem(index, field, rawValue) {
    const value =
      field.maxLen && typeof rawValue === 'string' ? rawValue.slice(0, field.maxLen) : rawValue

    updateSelectedScreen((screen) => {
      const items = Array.isArray(screen.items) ? screen.items.slice() : []
      const current = items[index] || {}
      items[index] = updateEntityField(current, field.id, value)
      return { ...screen, items }
    })
  }

  function addScreenAction() {
    if (!selectedScreen || !screenSupportsActions(selectedScreen)) {
      return
    }

    const limit =
      selectedScreen.type === 'scroll'
        ? graphBuilderSpec.limits.maxMenuActions
        : graphBuilderSpec.limits.maxCardActions

    if (getScreenActions(selectedScreen).length >= limit) {
      setNotice({ type: 'error', text: screenUsesSelectDrawer(selectedScreen) ? 'Maximum action-menu items reached' : 'Maximum card actions reached' })
      return
    }

    updateSelectedScreen((screen) => {
      const actions = getScreenActions(screen).slice()

      if (screenUsesSelectDrawer(screen)) {
        const id = ensureUniqueEntityId(actions, 'drawer_item', 'drawer_item')
        actions.push({
          id,
          label: 'Action Menu Item',
          value: '',
          run: null
        })
      } else {
        const usedSlots = new Set(actions.map((action) => action.slot))
        const slot =
          graphBuilderSpec.enums.actionSlots.find((candidate) => !usedSlots.has(candidate)) || 'select'
        const id = ensureUniqueEntityId(actions, 'action', 'action')

        actions.push({
          slot,
          id,
          icon: 'check',
          label: 'Action',
          value: '',
          run: null
        })
      }

      return { ...screen, actions }
    })
  }

  function removeScreenAction(index) {
    updateSelectedScreen((screen) => {
      const actions = getScreenActions(screen).slice()
      actions.splice(index, 1)
      return { ...screen, actions }
    })
  }

  function updateScreenAction(index, field, rawValue) {
    const value =
      field.maxLen && typeof rawValue === 'string' ? rawValue.slice(0, field.maxLen) : rawValue

    updateSelectedScreen((screen) => {
      const actions = getScreenActions(screen).slice()
      const current = actions[index] || {}
      actions[index] = updateEntityField(current, field.id, value)
      return { ...screen, actions }
    })
  }

  function addScreenHook(hookKey) {
    if (!selectedScreen || (hookKey !== 'onEnter' && hookKey !== 'onExit')) {
      return
    }

    if (!(graphBuilderSpec.hookRunFields || []).length) {
      setNotice({ type: 'error', text: `Lifecycle hooks are not supported by ${graph.schemaVersion}` })
      return
    }

    if (getScreenHookRuns(selectedScreen, hookKey).length >= (graphBuilderSpec.limits.maxScreenHooks || 6)) {
      setNotice({ type: 'error', text: 'Maximum lifecycle hooks reached' })
      return
    }

    updateSelectedScreen((screen) => {
      const hooks = getScreenHookRuns(screen, hookKey).slice()
      hooks.push(createDefaultScreenHookRun())
      return {
        ...screen,
        [hookKey]: hooks
      }
    })
  }

  function removeScreenHook(hookKey, index) {
    updateSelectedScreen((screen) => {
      const hooks = getScreenHookRuns(screen, hookKey).slice()
      hooks.splice(index, 1)
      const next = { ...screen }
      if (hooks.length) {
        next[hookKey] = hooks
      } else {
        delete next[hookKey]
      }
      return next
    })
  }

  function updateScreenHook(hookKey, index, field, rawValue) {
    const value =
      field.maxLen && typeof rawValue === 'string' ? rawValue.slice(0, field.maxLen) : rawValue

    updateSelectedScreen((screen) => {
      const hooks = getScreenHookRuns(screen, hookKey).slice()
      const currentRun = hooks[index] || createDefaultScreenHookRun()
      const nextEntity = updateRunField({ run: currentRun }, field.id, value)

      if (!nextEntity.run) {
        hooks.splice(index, 1)
      } else {
        hooks[index] = nextEntity.run
      }

      const next = { ...screen }
      if (hooks.length) {
        next[hookKey] = hooks
      } else {
        delete next[hookKey]
      }
      return next
    })
  }

  function updateScreenTimer(field, rawValue) {
    if (!selectedScreen) {
      return
    }

    if (!(graphBuilderSpec.timerRunFields || []).length) {
      setNotice({ type: 'error', text: `Timers are not supported by ${graph.schemaVersion}` })
      return
    }

    if (field.id === 'timer.durationMs') {
      const nextDuration = Math.max(100, Math.min(86400000, Number.parseInt(String(rawValue || '0'), 10) || 5000))
      updateSelectedScreen((screen) => {
        const currentTimer = screen.timer || createDefaultScreenTimer()
        return {
          ...screen,
          timer: {
            ...currentTimer,
            durationMs: nextDuration
          }
        }
      })
      return
    }

    const value =
      field.maxLen && typeof rawValue === 'string' ? rawValue.slice(0, field.maxLen) : rawValue

    updateSelectedScreen((screen) => {
      const currentTimer = screen.timer || createDefaultScreenTimer()
      const nextEntity = updateRunField({ run: currentTimer.run }, field.id, value)
      if (!nextEntity.run) {
        const next = { ...screen }
        delete next.timer
        return next
      }
      return {
        ...screen,
        timer: {
          ...currentTimer,
          run: nextEntity.run
        }
      }
    })
  }

  function toggleScreenTimer(enabled) {
    if (!selectedScreen) {
      return
    }

    if (enabled && !(graphBuilderSpec.timerRunFields || []).length) {
      setNotice({ type: 'error', text: `Timers are not supported by ${graph.schemaVersion}` })
      return
    }

    updateSelectedScreen((screen) => {
      if (!enabled) {
        const next = { ...screen }
        delete next.timer
        return next
      }

      return {
        ...screen,
        timer: screen.timer || createDefaultScreenTimer()
      }
    })
  }

  function updateMotionField(fieldId, rawValue) {
    if (!selectedScreen || selectedScreen.type !== 'draw') {
      return
    }

    updateSelectedScreen((screen) => {
      const motion = normalizeMotion(screen.motion || createDefaultMotion())
      let value = rawValue
      if (fieldId === 'timelineMs') {
        value = coerceDrawNumber(rawValue, Number(motion.timelineMs || 1800), 240, 20000)
      }
      const compiled = buildCompiledMotionState({
        ...motion,
        [fieldId]: value
      }, screen.canvas)

      return {
        ...screen,
        motion: compiled.motion,
        drawing: compiled.drawing
      }
    })
  }

  function updateCanvasTemplate(template) {
    if (!selectedScreen || selectedScreen.type !== 'draw') {
      return
    }

    updateSelectedScreen((screen) => {
      const nextCanvas =
        String(template || 'freeform') === 'header_list'
          ? normalizeCanvas(screen.canvas?.template === 'header_list'
              ? screen.canvas
              : createDefaultCanvas({ header: screen.title || 'Main Menu' }))
          : normalizeCanvas({ template: 'freeform' })

      if (!screen.motion) {
        return {
          ...screen,
          canvas: nextCanvas
        }
      }

      const compiled = buildCompiledMotionState(
        nextCanvas.template === 'header_list' ? createDefaultCanvasMotion(nextCanvas) : screen.motion,
        nextCanvas
      )

      return {
        ...screen,
        canvas: compiled.canvas,
        motion: compiled.motion,
        drawing: compiled.drawing
      }
    })
  }

  function updateCanvasHeader(rawValue) {
    if (!selectedScreen || selectedScreen.type !== 'draw') {
      return
    }

    updateSelectedScreen((screen) => {
      const canvas = normalizeCanvas(screen.canvas || createDefaultCanvas({ header: screen.title || 'Main Menu' }))
      const nextCanvas = {
        ...canvas,
        header: String(rawValue || '').slice(0, graphBuilderSpec.limits.maxTitleLen || 30)
      }

      if (!screen.motion) {
        return {
          ...screen,
          canvas: nextCanvas
        }
      }

      const compiled = buildCompiledMotionState(screen.motion, nextCanvas)
      return {
        ...screen,
        canvas: compiled.canvas,
        motion: compiled.motion,
        drawing: compiled.drawing
      }
    })
  }

  function addCanvasItem() {
    if (!selectedScreen || selectedScreen.type !== 'draw') {
      return
    }

    updateSelectedScreen((screen) => {
      const canvas = normalizeCanvas(screen.canvas || createDefaultCanvas({ header: screen.title || 'Main Menu' }))
      const items = Array.isArray(canvas.items) ? canvas.items.slice() : []
      if (items.length >= 4) {
        return screen
      }

      const id = ensureUniqueEntityId(items, 'item', 'item')
      const nextCanvas = {
        ...canvas,
        items: items.concat([{ id, label: `Item ${items.length + 1}` }])
      }

      if (!screen.motion) {
        return {
          ...screen,
          canvas: nextCanvas
        }
      }

      const compiled = buildCompiledMotionState(screen.motion, nextCanvas)
      return {
        ...screen,
        canvas: compiled.canvas,
        motion: compiled.motion,
        drawing: compiled.drawing
      }
    })
  }

  function removeCanvasItem(index) {
    if (!selectedScreen || selectedScreen.type !== 'draw') {
      return
    }

    updateSelectedScreen((screen) => {
      const canvas = normalizeCanvas(screen.canvas || createDefaultCanvas({ header: screen.title || 'Main Menu' }))
      const items = Array.isArray(canvas.items) ? canvas.items.slice() : []
      items.splice(index, 1)
      const nextCanvas = {
        ...canvas,
        items
      }

      if (!screen.motion) {
        return {
          ...screen,
          canvas: nextCanvas
        }
      }

      const compiled = buildCompiledMotionState(screen.motion, nextCanvas)
      return {
        ...screen,
        canvas: compiled.canvas,
        motion: compiled.motion,
        drawing: compiled.drawing
      }
    })
  }

  function updateCanvasItem(index, rawValue) {
    if (!selectedScreen || selectedScreen.type !== 'draw') {
      return
    }

    updateSelectedScreen((screen) => {
      const canvas = normalizeCanvas(screen.canvas || createDefaultCanvas({ header: screen.title || 'Main Menu' }))
      const items = Array.isArray(canvas.items) ? canvas.items.slice() : []
      const current = items[index]
      if (!current) {
        return screen
      }

      items[index] = {
        ...current,
        label: String(rawValue || '').slice(0, graphBuilderSpec.limits.maxOptionLabelLen || 18)
      }
      const nextCanvas = {
        ...canvas,
        items
      }

      if (!screen.motion) {
        return {
          ...screen,
          canvas: nextCanvas
        }
      }

      const compiled = buildCompiledMotionState(screen.motion, nextCanvas)
      return {
        ...screen,
        canvas: compiled.canvas,
        motion: compiled.motion,
        drawing: compiled.drawing
      }
    })
  }

  function addMotionTrack() {
    if (!selectedScreen || selectedScreen.type !== 'draw') {
      return
    }

    const motion = normalizeMotion(selectedScreen.motion || createDefaultMotion())
    const tracks = Array.isArray(motion.tracks) ? motion.tracks : []
    if (tracks.length >= (graphBuilderSpec.limits.maxDrawSteps || 6)) {
      setNotice({ type: 'error', text: 'Maximum motion tracks reached' })
      return
    }

    updateSelectedScreen((screen) => {
      const nextMotion = normalizeMotion(screen.motion || createDefaultMotion())
      const nextTracks = Array.isArray(nextMotion.tracks) ? nextMotion.tracks.slice() : []
      nextTracks.push(
        createDefaultMotionTrack(
          nextTracks,
          screen.canvas?.template === 'header_list'
            ? {
                target: 'items',
                label: `Items ${nextTracks.length + 1}`,
                preset: 'slide_left',
                kind: 'text',
                placement: 'middle',
                color: 'ink',
                fill: true
              }
            : undefined
        )
      )
      const compiled = buildCompiledMotionState({
        ...nextMotion,
        tracks: nextTracks
      }, screen.canvas)
      return {
        ...screen,
        motion: compiled.motion,
        drawing: compiled.drawing
      }
    })
  }

  function removeMotionTrack(index) {
    if (!selectedScreen || selectedScreen.type !== 'draw') {
      return
    }

    updateSelectedScreen((screen) => {
      const motion = normalizeMotion(screen.motion || createDefaultMotion())
      const tracks = Array.isArray(motion.tracks) ? motion.tracks.slice() : []
      tracks.splice(index, 1)
      const compiled = buildCompiledMotionState({
        ...motion,
        tracks
      }, screen.canvas)
      return {
        ...screen,
        motion: compiled.motion,
        drawing: compiled.drawing
      }
    })
  }

  function updateMotionTrack(index, fieldId, rawValue) {
    if (!selectedScreen || selectedScreen.type !== 'draw') {
      return
    }

    updateSelectedScreen((screen) => {
      const motion = normalizeMotion(screen.motion || createDefaultMotion())
      const tracks = Array.isArray(motion.tracks) ? motion.tracks.slice() : []
      const current = tracks[index] || createDefaultMotionTrack(tracks)
      let value = rawValue

      if (fieldId === 'fill') {
        value = !!rawValue
      } else if (fieldId === 'id') {
        const otherTracks = tracks.filter((_, trackIndex) => trackIndex !== index)
        value = ensureUniqueEntityId(otherTracks, rawValue, current.id || 'track')
      } else if (fieldId === 'delayMs') {
        value = coerceDrawNumber(rawValue, Number(current.delayMs || 0), 0, 20000)
      } else {
        value = String(rawValue || '')
      }

      tracks[index] = {
        ...current,
        [fieldId]: value
      }
      const compiled = buildCompiledMotionState({
        ...motion,
        tracks
      }, screen.canvas)

      return {
        ...screen,
        motion: compiled.motion,
        drawing: compiled.drawing
      }
    })
  }

  function detachMotionToRaw() {
    if (!selectedScreen || selectedScreen.type !== 'draw' || !selectedScreen.motion) {
      return
    }

    updateSelectedScreen((screen) => {
      const next = {
        ...screen,
        drawing: screen.drawing || createDefaultDrawing()
      }
      delete next.motion
      return next
    })

    setNotice({ type: 'success', text: 'Detached preset motion to raw steps' })
  }

  function enablePresetMotion() {
    if (!selectedScreen || selectedScreen.type !== 'draw') {
      return
    }

    updateSelectedScreen((screen) => {
      const baseMotion =
        screen.motion ||
        (screen.canvas?.template === 'header_list'
          ? createDefaultCanvasMotion(screen.canvas)
          : createDefaultMotion())
      const compiled = buildCompiledMotionState(baseMotion, screen.canvas)
      return {
        ...screen,
        motion: compiled.motion,
        drawing: compiled.drawing
      }
    })

    setNotice({ type: 'success', text: 'Preset motion enabled' })
  }

  function updateDrawField(fieldId, rawValue) {
    if (!selectedScreen || selectedScreen.type !== 'draw' || selectedScreen.motion) {
      return
    }

    updateSelectedScreen((screen) => {
      const drawing = screen.drawing || createDefaultDrawing()
      let value = rawValue
      if (fieldId === 'timelineMs') {
        value = coerceDrawNumber(rawValue, Number(drawing.timelineMs || 1800), 240, 20000)
      }

      return {
        ...screen,
        drawing: {
          ...drawing,
          [fieldId]: value
        }
      }
    })
  }

  function addDrawStep() {
    if (!selectedScreen || selectedScreen.type !== 'draw' || selectedScreen.motion) {
      return
    }

    const drawing = selectedScreen.drawing || createDefaultDrawing()
    const steps = Array.isArray(drawing.steps) ? drawing.steps : []
    if (steps.length >= (graphBuilderSpec.limits.maxDrawSteps || 6)) {
      setNotice({ type: 'error', text: 'Maximum draw steps reached' })
      return
    }

    updateSelectedScreen((screen) => {
      const nextDrawing = screen.drawing || createDefaultDrawing()
      const nextSteps = Array.isArray(nextDrawing.steps) ? nextDrawing.steps.slice() : []
      nextSteps.push(createDefaultDrawStep(nextSteps))
      return {
        ...screen,
        drawing: {
          ...nextDrawing,
          steps: clampDrawStepCount(nextSteps)
        }
      }
    })
  }

  function removeDrawStep(index) {
    if (!selectedScreen || selectedScreen.type !== 'draw' || selectedScreen.motion) {
      return
    }

    updateSelectedScreen((screen) => {
      const drawing = screen.drawing || createDefaultDrawing()
      const steps = Array.isArray(drawing.steps) ? drawing.steps.slice() : []
      steps.splice(index, 1)
      return {
        ...screen,
        drawing: {
          ...drawing,
          steps
        }
      }
    })
  }

  function updateDrawStep(index, fieldId, rawValue) {
    if (!selectedScreen || selectedScreen.type !== 'draw' || selectedScreen.motion) {
      return
    }

    updateSelectedScreen((screen) => {
      const drawing = screen.drawing || createDefaultDrawing()
      const steps = Array.isArray(drawing.steps) ? drawing.steps.slice() : []
      const current = steps[index] || createDefaultDrawStep(steps)
      let value = rawValue

      if (fieldId === 'fill') {
        value = !!rawValue
      } else if (fieldId === 'id') {
        const otherSteps = steps.filter((_, stepIndex) => stepIndex !== index)
        value = ensureUniqueEntityId(otherSteps, rawValue, current.id || 'step')
      } else if (isDrawStepNumericField(fieldId)) {
        const { min, max } = getDrawStepFieldLimit(fieldId)
        value = coerceDrawNumber(rawValue, Number(current[fieldId] || 0), min, max)
      } else {
        value = String(rawValue || '')
      }

      steps[index] = {
        ...current,
        [fieldId]: value
      }

      return {
        ...screen,
        drawing: {
          ...drawing,
          steps: clampDrawStepCount(steps)
        }
      }
    })
  }

  function handleImport() {
    let parsed
    try {
      parsed = JSON.parse(importText)
    } catch (error) {
      setNotice({ type: 'error', text: `Import JSON parse error: ${error.message}` })
      return
    }

    const candidate = parsed && parsed.graph ? parsed.graph : parsed
    const normalized = graphSchema.normalizeCanonicalGraph(candidate)

    if (!normalized) {
      setNotice({ type: 'error', text: 'Import failed. Payload is not a canonical graph.' })
      return
    }

    if (candidate._builderMeta) {
      normalized._builderMeta = candidate._builderMeta
    } else {
      normalized._builderMeta = inferBuilderMetaFromGraph(normalized)
    }

    setGraph(normalized)
    setSelectedScreenId(normalized.entryScreenId)
    setSelectedNodeId('')
    setPreviewPlaceholderScreen(null)
    setPreviewScreenId(normalized.entryScreenId)
    setPreviewHistory([])
    setBindingsDraftByScreen({})
    nodePositionsRef.current = {}
    runTargetPositionsRef.current = {}
    setVisibleRunTargetIds([])
    setLayoutTick((tick) => tick + 1)
    setNotice({ type: 'success', text: 'Imported and normalized successfully' })
    setTimeout(() => flowInstance?.fitView({ padding: 0.2 }), 10)
  }

  function loadTemplate(templateId) {
    const template = GRAPH_TEMPLATES.find((t) => t.id === templateId)
    if (!template) {
      setNotice({ type: 'error', text: `Template "${templateId}" not found` })
      return
    }
    const normalized = graphSchema.normalizeCanonicalGraph(JSON.parse(JSON.stringify(template.graph)))
    if (!normalized) {
      setNotice({ type: 'error', text: `Template "${template.label}" failed to normalize` })
      return
    }
    if (template.graph._builderMeta) {
      normalized._builderMeta = template.graph._builderMeta
    } else {
      normalized._builderMeta = inferBuilderMetaFromGraph(normalized)
    }
    setGraph(normalized)
    setImportText(JSON.stringify(normalized, null, 2))
    setSelectedScreenId(normalized.entryScreenId)
    setSelectedNodeId('')
    setPreviewPlaceholderScreen(null)
    setPreviewScreenId(normalized.entryScreenId)
    setPreviewHistory([])
    setPreviewVars({})
    setPreviewStorage({})
    setBindingsDraftByScreen({})
    nodePositionsRef.current = {}
    runTargetPositionsRef.current = {}
    setVisibleRunTargetIds([])
    setLayoutTick((tick) => tick + 1)
    setNotice({ type: 'success', text: `Loaded template: ${template.label}` })
    setTimeout(() => flowInstance?.fitView({ padding: 0.2 }), 10)
  }

  async function handleCopyExport() {
    if (!canExport) {
      setNotice({ type: 'error', text: 'Export blocked. Graph is not valid yet.' })
      return
    }

    try {
      await navigator.clipboard.writeText(normalizedExportText)
      setNotice({ type: 'success', text: 'Copied normalized graph to clipboard' })
    } catch (error) {
      setNotice({ type: 'error', text: 'Clipboard permission denied. Use download instead.' })
    }
  }

  function handleDownloadExport() {
    if (!canExport) {
      setNotice({ type: 'error', text: 'Export blocked. Graph is not valid yet.' })
      return
    }

    const blob = new Blob([normalizedExportText], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'pebble-screen-graph.json'
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice({ type: 'success', text: 'Downloaded normalized graph JSON' })
  }

  function loadCurrentIntoImportBox() {
    setImportText(JSON.stringify(graph, null, 2))
  }

  function setSchemaVersion(nextSchemaVersion) {
    const nextVersion = String(nextSchemaVersion || '')
    const descriptor = schemaRegistry.getSchemaDescriptor(nextVersion)
    if (!descriptor) {
      setNotice({ type: 'error', text: `Unknown schema version: ${nextVersion}` })
      return
    }

    if (graph.schemaVersion === descriptor.schemaVersion) {
      return
    }

    const migrated = graphSchema.normalizeCanonicalGraph({
      ...graph,
      schemaVersion: descriptor.schemaVersion
    })

    if (!migrated) {
      setNotice({ type: 'error', text: `Could not migrate graph to ${descriptor.schemaVersion}` })
      return
    }

    const supportedRunTypes = descriptor.enums?.runTypes || []
    const nextVisibleRunTargetIds = visibleRunTargetIds.filter((targetId) => {
      const target = getRunTargetDefinition(targetId)
      return !!target && supportedRunTypes.includes(target.runType)
    })
    const nextRequiredRunTargetIds = collectRequiredRunTargetIds(migrated)
    const nextSelectedScreenId = migrated.screens[selectedScreenId] ? selectedScreenId : migrated.entryScreenId
    const nextPreviewScreenId =
      previewScreenId !== PREVIEW_PLACEHOLDER_ID && migrated.screens[previewScreenId]
        ? previewScreenId
        : migrated.entryScreenId

    let nextSelectedNodeId = ''
    if (selectedNodeId) {
      if (!isRunTargetId(selectedNodeId) && migrated.screens[selectedNodeId]) {
        nextSelectedNodeId = selectedNodeId
      } else if (
        isRunTargetId(selectedNodeId) &&
        (nextVisibleRunTargetIds.includes(selectedNodeId) || nextRequiredRunTargetIds.includes(selectedNodeId))
      ) {
        nextSelectedNodeId = selectedNodeId
      }
    }

    setGraph(migrated)
    setSelectedScreenId(nextSelectedScreenId)
    setSelectedNodeId(nextSelectedNodeId)
    setPreviewPlaceholderScreen(null)
    setPreviewScreenId(nextPreviewScreenId)
    setPreviewHistory((prev) => prev.filter((screenId) => migrated.screens[screenId]))
    setBindingsDraftByScreen((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([screenId]) => migrated.screens[screenId]))
    )
    runTargetPositionsRef.current = Object.fromEntries(
      Object.entries(runTargetPositionsRef.current).filter(([targetId]) => nextVisibleRunTargetIds.includes(targetId))
    )
    setVisibleRunTargetIds(nextVisibleRunTargetIds)
    setLayoutTick((tick) => tick + 1)
    setNotice({ type: 'success', text: `Migrated graph to ${descriptor.schemaVersion}` })
    setTimeout(() => flowInstance?.fitView({ padding: 0.2, duration: 250 }), 10)
  }

  function setEntryScreenId(id) {
    setGraph((prev) => ({ ...prev, entryScreenId: id }))
  }

  function addVariable(key, defaultValue = '', typeHint = 'string') {
    const cleanKey = sanitizeId(key, 'var')
    setGraph((prev) => {
      const meta = prev._builderMeta || { variables: [], storageKeys: [] }
      if (meta.variables.some((v) => v.key === cleanKey)) {
        return prev
      }
      return {
        ...prev,
        _builderMeta: {
          ...meta,
          variables: [...meta.variables, { key: cleanKey, defaultValue, typeHint }]
        }
      }
    })
  }

  function removeVariable(key) {
    setGraph((prev) => {
      const meta = prev._builderMeta || { variables: [], storageKeys: [] }
      return {
        ...prev,
        _builderMeta: {
          ...meta,
          variables: meta.variables.filter((v) => v.key !== key)
        }
      }
    })
  }

  function updateVariable(key, field, value) {
    setGraph((prev) => {
      const meta = prev._builderMeta || { variables: [], storageKeys: [] }
      return {
        ...prev,
        _builderMeta: {
          ...meta,
          variables: meta.variables.map((v) =>
            v.key === key ? { ...v, [field]: value } : v
          )
        }
      }
    })
  }

  function addStorageKey(key, typeHint = 'string') {
    const cleanKey = sanitizeId(key, 'store')
    setGraph((prev) => {
      const meta = prev._builderMeta || { variables: [], storageKeys: [] }
      if (meta.storageKeys.some((s) => s.key === cleanKey)) {
        return prev
      }
      return {
        ...prev,
        _builderMeta: {
          ...meta,
          storageKeys: [...meta.storageKeys, { key: cleanKey, typeHint }]
        }
      }
    })
  }

  function removeStorageKey(key) {
    setGraph((prev) => {
      const meta = prev._builderMeta || { variables: [], storageKeys: [] }
      return {
        ...prev,
        _builderMeta: {
          ...meta,
          storageKeys: meta.storageKeys.filter((s) => s.key !== key)
        }
      }
    })
  }

  function updateStorageKey(key, field, value) {
    setGraph((prev) => {
      const meta = prev._builderMeta || { variables: [], storageKeys: [] }
      return {
        ...prev,
        _builderMeta: {
          ...meta,
          storageKeys: meta.storageKeys.map((s) =>
            s.key === key ? { ...s, [field]: value } : s
          )
        }
      }
    })
  }

  function declareFromUndeclared(key, kind) {
    if (kind === 'storage') {
      addStorageKey(key)
      addDataItem({ key, scope: 'persistent', typeHint: 'string' })
    } else {
      addVariable(key)
      addDataItem({ key, scope: 'session', defaultValue: '', typeHint: 'string' })
    }
  }

  function addDataItem(item) {
    setGraph((prev) => {
      const meta = prev._builderMeta || { variables: [], storageKeys: [], dataItems: [] }
      const dataItems = Array.isArray(meta.dataItems) ? meta.dataItems : []
      if (dataItems.some((d) => d.key === item.key && d.scope === item.scope)) {
        return prev
      }
      return {
        ...prev,
        _builderMeta: {
          ...meta,
          dataItems: [...dataItems, item]
        }
      }
    })
  }

  function removeDataItem(key, scope) {
    setGraph((prev) => {
      const meta = prev._builderMeta || { variables: [], storageKeys: [], dataItems: [] }
      const dataItems = Array.isArray(meta.dataItems) ? meta.dataItems : []
      return {
        ...prev,
        _builderMeta: {
          ...meta,
          dataItems: dataItems.filter((d) => !(d.key === key && d.scope === scope))
        }
      }
    })
  }

  function updateDataItem(key, scope, field, value) {
    setGraph((prev) => {
      const meta = prev._builderMeta || { variables: [], storageKeys: [], dataItems: [] }
      const dataItems = Array.isArray(meta.dataItems) ? meta.dataItems : []
      return {
        ...prev,
        _builderMeta: {
          ...meta,
          dataItems: dataItems.map((d) =>
            d.key === key && d.scope === scope ? { ...d, [field]: value } : d
          )
        }
      }
    })
  }

  function setStorageNamespace(rawValue) {
    const nextValue = sanitizeId(rawValue, '')
    setGraph((prev) => {
      const next = { ...prev }
      if (nextValue) {
        next.storageNamespace = nextValue
      } else {
        delete next.storageNamespace
      }
      return next
    })
  }

  return {
    // State
    graph,
    selectedScreenId,
    selectedNodeId,
    selectedScreen,
    selectedRunTarget,
    previewScreen,
    previewScreenId,
    previewRenderedScreen,
    previewRevision,
    importText,
    notice,
    nodes,
    edges,
    showImportExport,
    screenIds,
    unmappedCount,
    selectedNodeUsages,
    graphReferenceCatalog,
    normalizedExportText,
    canExport,
    graphBuilderSpec,
    screenBuilderSpec,
    schemaVersions,

    // Setters
    setImportText,
    setNotice,
    setShowImportExport,
    setFlowInstance,
    setSelectedNodeId,
    setSelectedScreenId,

    // Mutation fns
    addScreen,
    deleteSelectedScreen,
    addRunTargetNode,
    resetLayout,
    updateScreenField,
    addMenuItem,
    removeMenuItem,
    updateMenuItem,
    addScreenHook,
    removeScreenHook,
    updateScreenHook,
    toggleScreenTimer,
    updateScreenTimer,
    addScreenAction,
    removeScreenAction,
    updateScreenAction,
    updateCanvasTemplate,
    updateCanvasHeader,
    addCanvasItem,
    removeCanvasItem,
    updateCanvasItem,
    updateMotionField,
    addMotionTrack,
    removeMotionTrack,
    updateMotionTrack,
    detachMotionToRaw,
    enablePresetMotion,
    updateDrawField,
    addDrawStep,
    removeDrawStep,
    updateDrawStep,
    handleImport,
    loadTemplate,
    handleCopyExport,
    handleDownloadExport,
    loadCurrentIntoImportBox,
    handlePreviewActionMessage,
    handleNodesChange,
    handleConnect,
    handleEdgesDelete,
    clearLinkByHandle,
    jumpPreviewTo,
    setSchemaVersion,
    setEntryScreenId,
    setStorageNamespace,
    getBindingsDraft,
    updateBindingsDraft,
    commitBindingsDraft,
    applyBindingsPreset,
    ensureCurrentScreenBinding,
    describeCanvasTarget,
    focusNode,
    addVariable,
    removeVariable,
    updateVariable,
    addStorageKey,
    removeStorageKey,
    updateStorageKey,
    declareFromUndeclared,
    addDataItem,
    removeDataItem,
    updateDataItem
  }
}
