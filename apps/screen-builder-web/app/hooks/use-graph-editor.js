'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { applyNodeChanges, useNodesState, useEdgesState } from 'reactflow'
import { ACTION_TYPES } from '../pebble-protocol'
import {
  builderElements,
  graphSchema,
  bindingPresets,
  RUN_TARGETS,
  isRunTargetId,
  getRunTargetDefinition,
  screenUsesButtonSlots,
  screenUsesSelectDrawer,
  screenSupportsActions,
  getScreenActions,
  createDefaultGraph
} from '../lib/constants'
import {
  clampDrawStepCount,
  coerceDrawNumber,
  createDefaultDrawing,
  createDefaultDrawStep,
  getDrawStepFieldLimit,
  isDrawStepNumericField
} from '../lib/draw-utils'
import {
  ensureUniqueScreenId,
  ensureUniqueEntityId,
  getNestedValue,
  setNestedValue,
  pruneRunForType,
  updateEntityField,
  toPrettyJson,
  shortHash,
  isRunConfigured,
  countUnmappedEntities,
  collectRequiredRunTargetIds,
  collectNodeUsages,
  computeAutoPosition,
  buildGraphEdges,
  buildGraphNodes,
  remapNavigateTargets
} from '../lib/graph-utils'
import {
  PREVIEW_PLACEHOLDER_ID,
  createPreviewRenderScreen,
  createPreviewPlaceholderScreen,
  createVoicePreviewScreen,
  getMenuItemFromPreviewAction,
  getMenuActionFromPreviewAction
} from '../lib/preview-utils'

export default function useGraphEditor() {
  const [graph, setGraph] = useState(createDefaultGraph)
  const [selectedScreenId, setSelectedScreenId] = useState('root')
  const [selectedNodeId, setSelectedNodeId] = useState('')
  const [previewScreenId, setPreviewScreenId] = useState('root')
  const [previewPlaceholderScreen, setPreviewPlaceholderScreen] = useState(null)
  const [previewHistory, setPreviewHistory] = useState([])
  const [importText, setImportText] = useState(() => JSON.stringify(createDefaultGraph(), null, 2))
  const [notice, setNotice] = useState({ type: 'idle', text: 'Ready' })
  const [bindingsDraftByScreen, setBindingsDraftByScreen] = useState({})
  const [nodePositions, setNodePositions] = useState({})
  const [runTargetPositions, setRunTargetPositions] = useState({})
  const [visibleRunTargetIds, setVisibleRunTargetIds] = useState([])
  const [layoutTick, setLayoutTick] = useState(0)
  const [flowInstance, setFlowInstance] = useState(null)
  const [nodes, setNodes] = useNodesState([])
  const [edges, setEdges] = useEdgesState([])
  const [newNodeType, setNewNodeType] = useState('menu')
  const [newRunTargetId, setNewRunTargetId] = useState(RUN_TARGETS[0].id)
  const [pendingSlotLink, setPendingSlotLink] = useState(null)
  const [pendingMenuActionLink, setPendingMenuActionLink] = useState(null)
  const [showImportExport, setShowImportExport] = useState(false)

  const normalizedGraph = useMemo(() => graphSchema.normalizeCanonicalGraph(graph), [graph])
  const graphBuilderSpec = useMemo(() => builderElements.deriveBuilderSpecFromGraph(graph), [graph])

  const selectedScreen = selectedNodeId && !isRunTargetId(selectedNodeId) ? graph.screens[selectedNodeId] || null : null
  const selectedRunTarget = selectedNodeId && isRunTargetId(selectedNodeId) ? getRunTargetDefinition(selectedNodeId) : null
  const previewScreen =
    previewScreenId === PREVIEW_PLACEHOLDER_ID
      ? previewPlaceholderScreen
      : graph.screens[previewScreenId] || null
  const selectedScreenType = selectedScreen ? String(selectedScreen.type || 'menu') : 'menu'
  const screenBuilderSpec = useMemo(
    () => builderElements.deriveBuilderSpecForScreen(selectedScreenType),
    [selectedScreenType]
  )
  const screenIds = Object.keys(graph.screens)
  const hasBuilderOnlyDrawScreens = false
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

  const normalizedExportText = normalizedGraph ? JSON.stringify(normalizedGraph, null, 2) : ''
  const canExport = !!normalizedGraph
  const previewRevision = useMemo(
    () => shortHash(normalizedExportText || JSON.stringify(graph)),
    [graph, normalizedExportText]
  )
  const previewRenderedScreen = useMemo(
    () => createPreviewRenderScreen(previewScreen, previewRevision),
    [previewScreen, previewRevision]
  )

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
    const nextNodes = buildGraphNodes(
      graph,
      nodePositions,
      selectedNodeId,
      activeRunTargetIds,
      runTargetPositions,
      {
        onAddMenuItem: handleAddMenuItemFromGraph,
        onAddDrawerItem: handleAddDrawerItemFromGraph
      }
    )
    setNodes(nextNodes)
  }, [activeRunTargetIds, graph, handleAddDrawerItemFromGraph, handleAddMenuItemFromGraph, layoutTick, runTargetPositions, selectedNodeId, setNodes])

  useEffect(() => {
    setEdges(buildGraphEdges(graph))
  }, [graph, setEdges])

  // --- Node change handler ---

  const handleNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => {
        const next = applyNodeChanges(changes, nds)
        changes.forEach((change) => {
          if (change.type === 'position' && change.position) {
            if (isRunTargetId(change.id)) {
              setRunTargetPositions((prev) => ({ ...prev, [change.id]: change.position }))
            } else {
              setNodePositions((prev) => ({ ...prev, [change.id]: change.position }))
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

    return null
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
    setGraph((prev) => {
      const screen = prev.screens[selectedScreenId]
      if (!screen) {
        return prev
      }

      const nextScreen = mutator(screen)
      return {
        ...prev,
        screens: {
          ...prev.screens,
          [selectedScreenId]: nextScreen
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
    setNodePositions(auto)
    setRunTargetPositions({})
    setLayoutTick((tick) => tick + 1)
    setNodes(buildGraphNodes(graph, auto, selectedNodeId, activeRunTargetIds, {}, {
      onAddMenuItem: handleAddMenuItemFromGraph,
      onAddDrawerItem: handleAddDrawerItemFromGraph
    }))
    setTimeout(() => flowInstance?.fitView({ padding: 0.22, duration: 400 }), 10)
  }

  function addRunTargetNode(targetId) {
    if (!targetId || !isRunTargetId(targetId)) {
      return
    }

    setVisibleRunTargetIds((prev) => (prev.includes(targetId) ? prev : prev.concat(targetId)))
    setSelectedNodeId(targetId)
    setNotice({ type: 'success', text: `Added ${getRunTargetDefinition(targetId)?.title || 'logic node'} to canvas` })
    setTimeout(() => flowInstance?.fitView({ padding: 0.22, duration: 250 }), 10)
  }

  function commitSlotLink(link) {
    if (!link) {
      return
    }

    const { sourceScreenId, slot, targetId, icon, label } = link
    const run = buildRunForCanvasTarget(targetId)
    if (!run) {
      setNotice({ type: 'error', text: 'Link target is invalid' })
      return
    }

    setGraph((prev) => {
      const screen = prev.screens[sourceScreenId]
      if (!screen || screen.type !== 'card') {
        return prev
      }

      const actions = getScreenActions(screen).slice()
      actions.push({
        slot,
        id: ensureUniqueEntityId(actions, `${slot}_action`, 'action'),
        icon: icon || 'check',
        label: label || defaultCardActionLabelForLink(slot, targetId),
        value: isRunTargetId(targetId) ? slot : targetId,
        run
      })

      return {
        ...prev,
        screens: {
          ...prev.screens,
          [sourceScreenId]: {
            ...screen,
            actions
          }
        }
      }
    })

    setPendingSlotLink(null)
    setSelectedScreenId(sourceScreenId)
    setSelectedNodeId(sourceScreenId)
    setNotice({ type: 'success', text: `Linked ${slot} to ${describeCanvasTarget(targetId)}` })
  }

  function commitMenuActionLink(link) {
    if (!link) {
      return
    }

    const { sourceScreenId, targetId, label } = link
    const run = buildRunForCanvasTarget(targetId)
    if (!run) {
      setNotice({ type: 'error', text: 'Link target is invalid' })
      return
    }

    setGraph((prev) => {
      const screen = prev.screens[sourceScreenId]
      if (!screen || !screenUsesSelectDrawer(screen)) {
        return prev
      }

      const actions = getScreenActions(screen).slice()
      const nextLabel = String(label || defaultMenuActionLabelForLink(targetId)).trim() || defaultMenuActionLabelForLink(targetId)
      actions.push({
        id: ensureUniqueEntityId(actions, nextLabel, 'drawer_item'),
        label: nextLabel,
        value: isRunTargetId(targetId) ? nextLabel : targetId,
        run
      })

      return {
        ...prev,
        screens: {
          ...prev.screens,
          [sourceScreenId]: {
            ...screen,
            actions
          }
        }
      }
    })

    setPendingMenuActionLink(null)
    setSelectedScreenId(sourceScreenId)
    setSelectedNodeId(sourceScreenId)
    setNotice({ type: 'success', text: `Added action-menu item to ${describeCanvasTarget(targetId)}` })
  }

  function clearLinkByHandle(sourceScreenId, sourceHandle) {
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

      if (sourceHandle.startsWith('action-')) {
        const key = sourceHandle.slice('action-'.length)
        const actions = getScreenActions(screen)
        const nextActions = actions.map((action, idx) => {
          const matchId = action.id ? String(action.id) === key : false
          const matchIndex = !action.id && String(idx) === key
          if (!matchId && !matchIndex) {
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

      return prev
    })

    if (removed) {
      setNotice({ type: 'success', text: `Removed link from ${sourceHandle}` })
    }
  }

  const handleEdgesDelete = useCallback((deletedEdges) => {
    ;(deletedEdges || []).forEach((edge) => {
      if (edge?.data?.source && edge?.data?.sourceHandle) {
        clearLinkByHandle(edge.data.source, edge.data.sourceHandle)
      }
    })
  }, [])

  function jumpPreviewTo(screenId, options = {}) {
    if (!screenId || !graph.screens[screenId]) {
      return false
    }

    setPreviewPlaceholderScreen(null)
    setPreviewScreenId(screenId)

    if (options.resetHistory) {
      setPreviewHistory([])
    } else if (options.pushHistory && previewScreenId && previewScreenId !== screenId) {
      setPreviewHistory((prev) => prev.concat(previewScreenId))
    }

    return true
  }

  function runPreviewAction(run, sourceLabel) {
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
      if (previewScreenId === PREVIEW_PLACEHOLDER_ID) {
        setPreviewHistory((prev) => prev.slice(0, -1))
      }
      if (jumpPreviewTo(run.screen, { pushHistory: previewScreenId !== PREVIEW_PLACEHOLDER_ID })) {
        setNotice({ type: 'success', text: `Preview navigated via ${sourceLabel}` })
      } else {
        setNotice({ type: 'error', text: `Preview target "${run.screen}" is missing` })
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
      setPreviewPlaceholderScreen(null)
      setPreviewScreenId(previousScreenId)
      setNotice({ type: 'success', text: `Preview returned to "${previousScreenId}"` })
      return
    }

    if (action.type === ACTION_TYPES.VOICE) {
      const originScreenId =
        action.screenId && action.screenId !== PREVIEW_PLACEHOLDER_ID
          ? action.screenId
          : previewScreenId !== PREVIEW_PLACEHOLDER_ID
            ? previewScreenId
            : previewHistory[previewHistory.length - 1]

      setPreviewHistory((prev) => (originScreenId ? prev.concat(originScreenId) : prev))
      setPreviewPlaceholderScreen(createVoicePreviewScreen(action, originScreenId))
      setPreviewScreenId(PREVIEW_PLACEHOLDER_ID)
      setNotice({ type: 'success', text: 'Preview opened voice result' })
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
        runPreviewAction(menuAction.run, menuAction.label || menuAction.id || 'action menu item')
        return
      }

      const item = getMenuItemFromPreviewAction(action, sourceScreen)
      if (!item) {
        setNotice({ type: 'error', text: 'Preview select did not match a menu item or action-menu item' })
        return
      }
      runPreviewAction(item.run, item.label || item.id || 'menu item')
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

    runPreviewAction(selectedAction.run, selectedAction.label || selectedAction.id || 'screen action')
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

        setPendingSlotLink({
          sourceScreenId: source,
          slot,
          targetId: target,
          icon: 'check',
          label: defaultCardActionLabelForLink(slot, target)
        })
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

        setPendingMenuActionLink({
          sourceScreenId: source,
          targetId: target,
          label: defaultMenuActionLabelForLink(target)
        })
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

    setNodePositions((prev) => {
      const next = { ...prev }
      if (prev[selectedScreenId]) {
        next[nextId] = prev[selectedScreenId]
        delete next[selectedScreenId]
      }
      return next
    })
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
      const nextType = val === 'card' ? 'card' : val === 'scroll' ? 'scroll' : val === 'draw' ? 'draw' : 'menu'
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
          delete next.actions
        } else if (nextType === 'card') {
          next.actions = getScreenActions(screen)
          delete next.items
        } else if (nextType === 'scroll') {
          next.actions = getScreenActions(screen)
          delete next.items
        } else {
          delete next.items
          delete next.actions
          next.drawing = screen.drawing || createDefaultDrawing()
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

    updateSelectedScreen((screen) => setNestedValue(screen, field.id, limitedValue))
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
    const preset = (bindingPresets.find((presetItem) => presetItem.id === rawValue) || {}).value || ''

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

  function addScreen(kind) {
    const requestedType = kind === 'card' ? 'card' : kind === 'scroll' ? 'scroll' : kind === 'draw' ? 'draw' : 'menu'
    const titles = { menu: 'New Menu', card: 'New Card', scroll: 'New Scroll', draw: 'New Motion' }
    const nextId = ensureUniqueScreenId(graph, 'screen', '')
    const nextScreen = {
      id: nextId,
      type: requestedType,
      title: titles[requestedType] || 'New Screen',
      body: '',
      titleTemplate: '',
      bodyTemplate: '',
      bindings: null,
      input: { mode: 'menu' },
      items: requestedType === 'menu' ? [] : undefined,
      actions: requestedType === 'scroll' || requestedType === 'card' ? [] : undefined,
      drawing: requestedType === 'draw' ? createDefaultDrawing() : undefined
    }

    setGraph((prev) => ({
      ...prev,
      screens: {
        ...prev.screens,
        [nextId]: nextScreen
      }
    }))

    setSelectedScreenId(nextId)
    setSelectedNodeId(nextId)
    setPreviewPlaceholderScreen(null)
    setPreviewScreenId(nextId)
    setPreviewHistory([])
    setNotice({
      type: 'success',
      text: requestedType === 'draw'
        ? `Added draw screen ${nextId}`
        : `Added ${requestedType} ${nextId}`
    })
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

    setNodePositions((prev) => {
      const next = { ...prev }
      delete next[selectedScreenId]
      return next
    })
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

  function updateDrawField(fieldId, rawValue) {
    if (!selectedScreen || selectedScreen.type !== 'draw') {
      return
    }

    updateSelectedScreen((screen) => {
      const drawing = { ...(screen.drawing || createDefaultDrawing()) }
      if (fieldId === 'timelineMs') {
        drawing.timelineMs = coerceDrawNumber(rawValue, drawing.timelineMs || 1800, 240, 20000)
      } else if (fieldId === 'playMode' || fieldId === 'background') {
        drawing[fieldId] = String(rawValue || '').toLowerCase()
      }
      return { ...screen, drawing }
    })
  }

  function addDrawStep() {
    if (!selectedScreen || selectedScreen.type !== 'draw') {
      return
    }

    const steps = Array.isArray(selectedScreen.drawing?.steps) ? selectedScreen.drawing.steps : []
    if (steps.length >= graphBuilderSpec.limits.maxDrawSteps) {
      setNotice({ type: 'error', text: 'Maximum motion steps reached' })
      return
    }

    updateSelectedScreen((screen) => {
      const drawing = { ...(screen.drawing || createDefaultDrawing()) }
      const nextSteps = Array.isArray(drawing.steps) ? drawing.steps.slice() : []
      nextSteps.push(createDefaultDrawStep(nextSteps))
      drawing.steps = clampDrawStepCount(nextSteps)
      return { ...screen, drawing }
    })
  }

  function removeDrawStep(index) {
    if (!selectedScreen || selectedScreen.type !== 'draw') {
      return
    }

    updateSelectedScreen((screen) => {
      const drawing = { ...(screen.drawing || createDefaultDrawing()) }
      const nextSteps = Array.isArray(drawing.steps) ? drawing.steps.slice() : []
      nextSteps.splice(index, 1)
      drawing.steps = nextSteps
      return { ...screen, drawing }
    })
  }

  function updateDrawStep(index, fieldId, rawValue) {
    if (!selectedScreen || selectedScreen.type !== 'draw') {
      return
    }

    updateSelectedScreen((screen) => {
      const drawing = { ...(screen.drawing || createDefaultDrawing()) }
      const steps = Array.isArray(drawing.steps) ? drawing.steps.slice() : []
      const current = steps[index] || createDefaultDrawStep(steps)
      const next = { ...current }

      if (fieldId === 'fill') {
        next.fill = !!rawValue
      } else if (fieldId === 'kind' || fieldId === 'color') {
        next[fieldId] = String(rawValue || '').toLowerCase()
      } else if (fieldId === 'id') {
        const siblingSteps = steps.filter((_, stepIndex) => stepIndex !== index)
        next.id = ensureUniqueEntityId(siblingSteps, rawValue, `step_${index + 1}`)
      } else if (isDrawStepNumericField(fieldId)) {
        const { min, max } = getDrawStepFieldLimit(fieldId)
        next[fieldId] = coerceDrawNumber(rawValue, current[fieldId], min, max)
      } else {
        next[fieldId] = String(rawValue || '')
      }

      steps[index] = next
      drawing.steps = clampDrawStepCount(steps)
      return { ...screen, drawing }
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

    setGraph(normalized)
    setSelectedScreenId(normalized.entryScreenId)
    setSelectedNodeId('')
    setPreviewPlaceholderScreen(null)
    setPreviewScreenId(normalized.entryScreenId)
    setPreviewHistory([])
    setBindingsDraftByScreen({})
    setNodePositions({})
    setRunTargetPositions({})
    setVisibleRunTargetIds([])
    setLayoutTick((tick) => tick + 1)
    setNodes(buildGraphNodes(normalized, {}, normalized.entryScreenId, collectRequiredRunTargetIds(normalized), {}, {
      onAddMenuItem: handleAddMenuItemFromGraph,
      onAddDrawerItem: handleAddDrawerItemFromGraph
    }))
    setNotice({ type: 'success', text: 'Imported and normalized successfully' })
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

  function setEntryScreenId(id) {
    setGraph((prev) => ({ ...prev, entryScreenId: id }))
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
    newNodeType,
    newRunTargetId,
    pendingSlotLink,
    pendingMenuActionLink,
    showImportExport,
    screenIds,
    unmappedCount,
    selectedNodeUsages,
    normalizedExportText,
    canExport,
    hasBuilderOnlyDrawScreens,
    graphBuilderSpec,
    screenBuilderSpec,

    // Setters
    setImportText,
    setNotice,
    setNewNodeType,
    setNewRunTargetId,
    setPendingSlotLink,
    setPendingMenuActionLink,
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
    addScreenAction,
    removeScreenAction,
    updateScreenAction,
    updateDrawField,
    addDrawStep,
    removeDrawStep,
    updateDrawStep,
    handleImport,
    handleCopyExport,
    handleDownloadExport,
    loadCurrentIntoImportBox,
    commitSlotLink,
    commitMenuActionLink,
    handlePreviewActionMessage,
    handleNodesChange,
    handleConnect,
    handleEdgesDelete,
    clearLinkByHandle,
    jumpPreviewTo,
    setEntryScreenId,
    getBindingsDraft,
    updateBindingsDraft,
    commitBindingsDraft,
    applyBindingsPreset,
    describeCanvasTarget
  }
}
