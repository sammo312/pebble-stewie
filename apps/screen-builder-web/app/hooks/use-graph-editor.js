'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyNodeChanges, useNodesState, useEdgesState } from '@xyflow/react'
import { ACTION_TYPES } from '../pebble-protocol'
import {
  builderElements,
  graphSchema,
  bindingPresets,
  runtimeValues,
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
  getMenuItemFromPreviewAction,
  getMenuActionFromPreviewAction
} from '../lib/preview-utils'
import {
  applyPreviewStorageMutationToState as applyPreviewStorageMutationState,
  applyPreviewVarMutationToState as applyPreviewVarMutationState,
  computePreviewJump as computePreviewJumpInRuntime,
  evaluatePreviewCondition as evaluatePreviewConditionInRuntime,
  executePreviewHookSequence as executePreviewHookSequenceInRuntime
} from '../lib/preview-runtime.mjs'
import {
  createGraphLoadState,
  parseImportedGraphText,
  prepareTemplateGraph
} from '../lib/graph-loading.mjs'
import {
  addDataItemToGraph,
  addMenuItemToScreen,
  addMotionTrackToScreen,
  addScreenActionToScreen,
  addScreenHookToScreen,
  addStorageKeyToGraph,
  addVariableToGraph,
  addCanvasItemToScreen,
  addDrawStepToScreen,
  clearLinkByHandleInGraph,
  connectCanvasHandleInGraph,
  describeCanvasTarget as describeCanvasTargetInGraph,
  detachMotionToRawInScreen,
  enablePresetMotionInScreen,
  removeCanvasItemFromScreen,
  removeDataItemFromGraph,
  removeDrawStepFromScreen,
  removeMenuItemFromScreen,
  removeMotionTrackFromScreen,
  removeScreenActionFromScreen,
  removeScreenHookFromScreen,
  removeStorageKeyFromGraph,
  removeVariableFromGraph,
  setEntryScreenIdInGraph,
  setStorageNamespaceInGraph,
  toggleScreenTimerInScreen,
  updateCanvasHeaderInScreen,
  updateCanvasItemInScreen,
  updateCanvasTemplateInScreen,
  updateDataItemInGraph,
  updateDrawFieldInScreen,
  updateDrawStepInScreen,
  updateMenuItemInScreen,
  updateMotionFieldInScreen,
  updateMotionTrackInScreen,
  updateScreenActionInScreen,
  updateScreenHookInScreen,
  updateScreenTimerInScreen,
  updateStorageKeyInGraph,
  updateVariableInGraph
} from '../lib/graph-mutations.mjs'
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

const PREVIEW_RUNTIME_DEPS = {
  runtimeValues,
  maxRedirectDepth: 8,
  now: Date.now
}

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

  function getDrawMutationDeps() {
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
      maxDrawSteps: graphBuilderSpec.limits.maxDrawSteps || 6,
      maxOptionLabelLen: graphBuilderSpec.limits.maxOptionLabelLen || 18,
      maxTitleLen: graphBuilderSpec.limits.maxTitleLen || 30,
      normalizeCanvas,
      normalizeMotion
    }
  }

  function getPreviewRuntimeDeps() {
    return PREVIEW_RUNTIME_DEPS
  }

  function applyLoadedGraphState(graph, options = {}) {
    const nextState = createGraphLoadState(graph, options)

    setGraph(nextState.graph)
    if (Object.prototype.hasOwnProperty.call(nextState, 'importText')) {
      setImportText(nextState.importText)
    }
    setSelectedScreenId(nextState.selectedScreenId)
    setSelectedNodeId(nextState.selectedNodeId)
    setPreviewPlaceholderScreen(nextState.previewPlaceholderScreen)
    setPreviewScreenId(nextState.previewScreenId)
    setPreviewHistory(nextState.previewHistory)
    if (Object.prototype.hasOwnProperty.call(nextState, 'previewVars')) {
      setPreviewVars(nextState.previewVars)
    }
    if (Object.prototype.hasOwnProperty.call(nextState, 'previewStorage')) {
      setPreviewStorage(nextState.previewStorage)
    }
    setBindingsDraftByScreen(nextState.bindingsDraftByScreen)
    if (nextState.resetNodePositions) {
      nodePositionsRef.current = {}
    }
    if (nextState.resetRunTargetPositions) {
      runTargetPositionsRef.current = {}
    }
    setVisibleRunTargetIds(nextState.visibleRunTargetIds)
    setLayoutTick((tick) => tick + 1)
    setTimeout(() => flowInstance?.fitView({ padding: 0.2 }), 10)
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
      const result = executePreviewHookSequenceInRuntime(
        entryScreen.onEnter,
        entryScreen,
        nextVars,
        nextStorage,
        getPreviewRuntimeDeps()
      )
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
    return describeCanvasTargetInGraph(graph, targetId, { isRunTargetId, getRunTargetDefinition })
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
    let result = { graph, removed: false }

    setGraph((prev) => {
      result = clearLinkByHandleInGraph(prev, sourceScreenId, sourceHandle, { getScreenActions })
      return result.graph
    })

    if (result.removed) {
      setNotice({ type: 'success', text: `Removed link from ${sourceHandle}` })
    }
  }, [graph, setGraph, setNotice])

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

  function evaluatePreviewCondition(condition, vars) {
    return evaluatePreviewConditionInRuntime(condition, vars, getPreviewRuntimeDeps())
  }

  function applyPreviewVarMutationToState(run, vars) {
    return applyPreviewVarMutationState(run, vars, getPreviewRuntimeDeps())
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
    return applyPreviewStorageMutationState(run, sourceScreen, vars, storage, getPreviewRuntimeDeps())
  }

  function applyPreviewStorageMutation(run, sourceScreen) {
    const nextStorage = applyPreviewStorageMutationToState(run, sourceScreen, previewVars, previewStorage)
    if (!nextStorage) {
      return false
    }
    setPreviewStorage(nextStorage)
    return true
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

    const result = computePreviewJumpInRuntime(
      graph,
      targetScreenId,
      {
        ...options,
        forceLifecycle: options.forceLifecycle,
        runLifecycle: shouldRunLifecycle,
        sourceScreen,
        storage: nextStorage,
        timerDeadline: previewTimerDeadline,
        vars: nextVars
      },
      getPreviewRuntimeDeps()
    )

    if (!result.ok) {
      return false
    }

    setPreviewVars(result.vars)
    setPreviewStorage(result.storage)
    applyPreviewScreenState(result.targetScreenId, { ...options, nextTimerDeadline: result.nextTimerDeadline })
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

  const handleConnect = useCallback(
    (connection) => {
      let result = { graph, kind: 'ignored' }

      setGraph((prev) => {
        result = connectCanvasHandleInGraph(prev, connection, {
          ensureUniqueEntityId,
          getRunTargetDefinition,
          getScreenActions,
          graphBuilderSpec,
          isRunTargetId,
          maxMenuActions: graphBuilderSpec.limits.maxMenuActions,
          pruneRunForType,
          screenSupportsActions,
          screenUsesButtonSlots,
          screenUsesSelectDrawer
        })
        return result.graph
      })

      if (result.kind === 'error') {
        setNotice({ type: 'error', text: result.message })
        return
      }

      if (result.kind === 'success') {
        setNotice({ type: 'success', text: result.message })
        if (result.focusSourceId) {
          setSelectedScreenId(result.focusSourceId)
          setSelectedNodeId(result.focusSourceId)
        }
      }
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

    updateSelectedScreen((screen) => addMenuItemToScreen(screen, { ensureUniqueEntityId }))
  }

  function removeMenuItem(index) {
    updateSelectedScreen((screen) => removeMenuItemFromScreen(screen, index))
  }

  function updateMenuItem(index, field, rawValue) {
    const value =
      field.maxLen && typeof rawValue === 'string' ? rawValue.slice(0, field.maxLen) : rawValue

    updateSelectedScreen((screen) => updateMenuItemInScreen(screen, index, field.id, value, { updateEntityField }))
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

    updateSelectedScreen((screen) =>
      addScreenActionToScreen(screen, {
        ensureUniqueEntityId,
        getScreenActions,
        screenUsesSelectDrawer,
        actionSlots: graphBuilderSpec.enums.actionSlots
      })
    )
  }

  function removeScreenAction(index) {
    updateSelectedScreen((screen) => removeScreenActionFromScreen(screen, index, { getScreenActions }))
  }

  function updateScreenAction(index, field, rawValue) {
    const value =
      field.maxLen && typeof rawValue === 'string' ? rawValue.slice(0, field.maxLen) : rawValue

    updateSelectedScreen((screen) =>
      updateScreenActionInScreen(screen, index, field.id, value, { getScreenActions, updateEntityField })
    )
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

    updateSelectedScreen((screen) =>
      addScreenHookToScreen(screen, hookKey, { getScreenHookRuns, createDefaultScreenHookRun })
    )
  }

  function removeScreenHook(hookKey, index) {
    updateSelectedScreen((screen) =>
      removeScreenHookFromScreen(screen, hookKey, index, { getScreenHookRuns })
    )
  }

  function updateScreenHook(hookKey, index, field, rawValue) {
    const value =
      field.maxLen && typeof rawValue === 'string' ? rawValue.slice(0, field.maxLen) : rawValue

    updateSelectedScreen((screen) =>
      updateScreenHookInScreen(screen, hookKey, index, field.id, value, {
        getScreenHookRuns,
        createDefaultScreenHookRun,
        updateRunField
      })
    )
  }

  function updateScreenTimer(field, rawValue) {
    if (!selectedScreen) {
      return
    }

    if (!(graphBuilderSpec.timerRunFields || []).length) {
      setNotice({ type: 'error', text: `Timers are not supported by ${graph.schemaVersion}` })
      return
    }

    const value =
      field.maxLen && typeof rawValue === 'string' ? rawValue.slice(0, field.maxLen) : rawValue

    updateSelectedScreen((screen) =>
      updateScreenTimerInScreen(screen, field.id, value, { createDefaultScreenTimer, updateRunField })
    )
  }

  function toggleScreenTimer(enabled) {
    if (!selectedScreen) {
      return
    }

    if (enabled && !(graphBuilderSpec.timerRunFields || []).length) {
      setNotice({ type: 'error', text: `Timers are not supported by ${graph.schemaVersion}` })
      return
    }

    updateSelectedScreen((screen) =>
      toggleScreenTimerInScreen(screen, enabled, { createDefaultScreenTimer })
    )
  }

  function updateMotionField(fieldId, rawValue) {
    if (!selectedScreen || selectedScreen.type !== 'draw') {
      return
    }

    updateSelectedScreen((screen) => updateMotionFieldInScreen(screen, fieldId, rawValue, getDrawMutationDeps()))
  }

  function updateCanvasTemplate(template) {
    if (!selectedScreen || selectedScreen.type !== 'draw') {
      return
    }

    updateSelectedScreen((screen) => updateCanvasTemplateInScreen(screen, template, getDrawMutationDeps()))
  }

  function updateCanvasHeader(rawValue) {
    if (!selectedScreen || selectedScreen.type !== 'draw') {
      return
    }

    updateSelectedScreen((screen) => updateCanvasHeaderInScreen(screen, rawValue, getDrawMutationDeps()))
  }

  function addCanvasItem() {
    if (!selectedScreen || selectedScreen.type !== 'draw') {
      return
    }

    updateSelectedScreen((screen) => addCanvasItemToScreen(screen, getDrawMutationDeps()))
  }

  function removeCanvasItem(index) {
    if (!selectedScreen || selectedScreen.type !== 'draw') {
      return
    }

    updateSelectedScreen((screen) => removeCanvasItemFromScreen(screen, index, getDrawMutationDeps()))
  }

  function updateCanvasItem(index, rawValue) {
    if (!selectedScreen || selectedScreen.type !== 'draw') {
      return
    }

    updateSelectedScreen((screen) => updateCanvasItemInScreen(screen, index, rawValue, getDrawMutationDeps()))
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

    updateSelectedScreen((screen) => addMotionTrackToScreen(screen, getDrawMutationDeps()))
  }

  function removeMotionTrack(index) {
    if (!selectedScreen || selectedScreen.type !== 'draw') {
      return
    }

    updateSelectedScreen((screen) => removeMotionTrackFromScreen(screen, index, getDrawMutationDeps()))
  }

  function updateMotionTrack(index, fieldId, rawValue) {
    if (!selectedScreen || selectedScreen.type !== 'draw') {
      return
    }

    updateSelectedScreen((screen) =>
      updateMotionTrackInScreen(screen, index, fieldId, rawValue, getDrawMutationDeps())
    )
  }

  function detachMotionToRaw() {
    if (!selectedScreen || selectedScreen.type !== 'draw' || !selectedScreen.motion) {
      return
    }

    updateSelectedScreen((screen) => detachMotionToRawInScreen(screen, getDrawMutationDeps()))

    setNotice({ type: 'success', text: 'Detached preset motion to raw steps' })
  }

  function enablePresetMotion() {
    if (!selectedScreen || selectedScreen.type !== 'draw') {
      return
    }

    updateSelectedScreen((screen) => enablePresetMotionInScreen(screen, getDrawMutationDeps()))

    setNotice({ type: 'success', text: 'Preset motion enabled' })
  }

  function updateDrawField(fieldId, rawValue) {
    if (!selectedScreen || selectedScreen.type !== 'draw' || selectedScreen.motion) {
      return
    }

    updateSelectedScreen((screen) => updateDrawFieldInScreen(screen, fieldId, rawValue, getDrawMutationDeps()))
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

    updateSelectedScreen((screen) => addDrawStepToScreen(screen, getDrawMutationDeps()))
  }

  function removeDrawStep(index) {
    if (!selectedScreen || selectedScreen.type !== 'draw' || selectedScreen.motion) {
      return
    }

    updateSelectedScreen((screen) => removeDrawStepFromScreen(screen, index, getDrawMutationDeps()))
  }

  function updateDrawStep(index, fieldId, rawValue) {
    if (!selectedScreen || selectedScreen.type !== 'draw' || selectedScreen.motion) {
      return
    }

    updateSelectedScreen((screen) =>
      updateDrawStepInScreen(screen, index, fieldId, rawValue, getDrawMutationDeps())
    )
  }

  function handleImport() {
    const result = parseImportedGraphText(importText, {
      normalizeCanonicalGraph: graphSchema.normalizeCanonicalGraph,
      inferBuilderMetaFromGraph
    })

    if (!result.ok) {
      setNotice({ type: 'error', text: result.error })
      return
    }

    applyLoadedGraphState(result.graph)
    setNotice({ type: 'success', text: 'Imported and normalized successfully' })
  }

  function loadTemplate(templateId) {
    const template = GRAPH_TEMPLATES.find((t) => t.id === templateId)
    if (!template) {
      setNotice({ type: 'error', text: `Template "${templateId}" not found` })
      return
    }
    const normalized = prepareTemplateGraph(template, {
      normalizeCanonicalGraph: graphSchema.normalizeCanonicalGraph,
      inferBuilderMetaFromGraph
    })
    if (!normalized) {
      setNotice({ type: 'error', text: `Template "${template.label}" failed to normalize` })
      return
    }

    applyLoadedGraphState(normalized, {
      setImportText: true,
      resetPreviewRuntime: true
    })
    setNotice({ type: 'success', text: `Loaded template: ${template.label}` })
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

  function setEntryScreenId(id) {
    setGraph((prev) => setEntryScreenIdInGraph(prev, id))
  }

  function addVariable(key, defaultValue = '', typeHint = 'string') {
    const cleanKey = sanitizeId(key, 'var')
    setGraph((prev) => addVariableToGraph(prev, cleanKey, defaultValue, typeHint))
  }

  function removeVariable(key) {
    setGraph((prev) => removeVariableFromGraph(prev, key))
  }

  function updateVariable(key, field, value) {
    setGraph((prev) => updateVariableInGraph(prev, key, field, value))
  }

  function addStorageKey(key, typeHint = 'string') {
    const cleanKey = sanitizeId(key, 'store')
    setGraph((prev) => addStorageKeyToGraph(prev, cleanKey, typeHint))
  }

  function removeStorageKey(key) {
    setGraph((prev) => removeStorageKeyFromGraph(prev, key))
  }

  function updateStorageKey(key, field, value) {
    setGraph((prev) => updateStorageKeyInGraph(prev, key, field, value))
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
    setGraph((prev) => addDataItemToGraph(prev, item))
  }

  function removeDataItem(key, scope) {
    setGraph((prev) => removeDataItemFromGraph(prev, key, scope))
  }

  function updateDataItem(key, scope, field, value) {
    setGraph((prev) => updateDataItemInGraph(prev, key, scope, field, value))
  }

  function setStorageNamespace(rawValue) {
    const nextValue = sanitizeId(rawValue, '')
    setGraph((prev) => setStorageNamespaceInGraph(prev, nextValue))
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
