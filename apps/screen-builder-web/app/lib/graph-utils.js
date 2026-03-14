import { MarkerType } from 'reactflow'
import {
  RUN_TARGETS,
  isRunTargetId,
  screenUsesButtonSlots,
  screenUsesSelectDrawer,
  screenSupportsActions,
  getScreenActions
} from './constants'

export function sanitizeId(value, fallback) {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '')

  return cleaned || fallback
}

export function ensureUniqueScreenId(graph, requestedId, currentId) {
  const base = sanitizeId(requestedId, 'screen')
  if (!graph.screens[base] || base === currentId) {
    return base
  }

  let index = 2
  let candidate = `${base}_${index}`
  while (graph.screens[candidate] && candidate !== currentId) {
    index += 1
    candidate = `${base}_${index}`
  }

  return candidate
}

export function ensureUniqueEntityId(items, requestedId, fallback) {
  const usedIds = new Set((items || []).map((item) => String(item.id || '')))
  const base = sanitizeId(requestedId, fallback)

  if (!usedIds.has(base)) {
    return base
  }

  let index = 2
  let candidate = `${base}_${index}`
  while (usedIds.has(candidate)) {
    index += 1
    candidate = `${base}_${index}`
  }

  return candidate
}

export function getNestedValue(obj, path) {
  if (!obj || !path) {
    return ''
  }

  if (!path.includes('.')) {
    const direct = obj[path]
    return direct === undefined || direct === null ? '' : direct
  }

  const segments = path.split('.')
  let cursor = obj
  for (let i = 0; i < segments.length; i += 1) {
    if (!cursor || typeof cursor !== 'object') {
      return ''
    }
    cursor = cursor[segments[i]]
  }

  return cursor === undefined || cursor === null ? '' : cursor
}

export function setNestedValue(obj, path, value) {
  if (!path.includes('.')) {
    return { ...obj, [path]: value }
  }

  const segments = path.split('.')
  const root = { ...obj }
  let cursor = root

  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i]
    const source = cursor[segment]
    cursor[segment] = source && typeof source === 'object' ? { ...source } : {}
    cursor = cursor[segment]
  }

  cursor[segments[segments.length - 1]] = value
  return root
}

export function pruneRunForType(type, run = {}) {
  const next = {}
  if (!type) {
    return next
  }

  next.type = type

  if (type === 'navigate' && run.screen) {
    next.screen = run.screen
  }
  if (type === 'agent_prompt' && run.prompt) {
    next.prompt = run.prompt
  }
  if (type === 'agent_command' && run.command) {
    next.command = run.command
  }
  if (run.vibe) {
    next.vibe = run.vibe
  }
  if (run.light) {
    next.light = true
  }

  return next
}

export function updateRunField(entity, fieldId, value) {
  const runKey = fieldId.split('.')[1]

  if (runKey === 'type') {
    if (!value) {
      const next = { ...entity }
      delete next.run
      return next
    }

    return {
      ...entity,
      run: pruneRunForType(value, entity.run || {})
    }
  }

  if (!entity.run || !entity.run.type) {
    return {
      ...entity,
      run: {
        type: 'navigate',
        [runKey]: value
      }
    }
  }

  return {
    ...entity,
    run: {
      ...entity.run,
      [runKey]: value
    }
  }
}

export function updateEntityField(entity, fieldId, value) {
  if (fieldId.startsWith('run.')) {
    return updateRunField(entity, fieldId, value)
  }

  return setNestedValue(entity, fieldId, value)
}

export function shouldRenderRunField(entity, fieldId) {
  if (!fieldId.startsWith('run.') || fieldId === 'run.type') {
    return true
  }

  const runType = entity.run && entity.run.type ? String(entity.run.type) : ''
  if (!runType) {
    return false
  }

  if (runType === 'navigate' && fieldId === 'run.screen') {
    return true
  }
  if (runType === 'agent_prompt' && fieldId === 'run.prompt') {
    return true
  }
  if (runType === 'agent_command' && fieldId === 'run.command') {
    return true
  }
  if (runType === 'effect') {
    return fieldId === 'run.vibe' || fieldId === 'run.light'
  }

  if (fieldId === 'run.vibe' || fieldId === 'run.light') {
    return true
  }

  return false
}

export function toPrettyJson(value) {
  if (!value) {
    return ''
  }

  return JSON.stringify(value, null, 2)
}

export function shortHash(value) {
  const text = String(value || '')
  let hash = 5381
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0
  }
  return hash.toString(16).padStart(8, '0').slice(0, 8)
}

export function isRunConfigured(run) {
  if (!run || !run.type) {
    return false
  }

  if (run.type === 'navigate') {
    return !!run.screen
  }
  if (run.type === 'agent_prompt') {
    return !!String(run.prompt || '').trim()
  }
  if (run.type === 'agent_command') {
    return !!String(run.command || '').trim()
  }
  if (run.type === 'effect') {
    return !!run.vibe || !!run.light
  }

  return false
}

export function describeRunTarget(run) {
  if (!run || !run.type) {
    return 'unmapped'
  }

  if (run.type === 'navigate') {
    return run.screen ? `\u2192 ${run.screen}` : 'navigation target missing'
  }
  if (run.type === 'agent_prompt') {
    return run.prompt ? '\u2192 agent prompt' : 'agent prompt missing'
  }
  if (run.type === 'agent_command') {
    return run.command ? `\u2192 command ${run.command}` : 'agent command missing'
  }
  if (run.type === 'effect') {
    const parts = []
    if (run.vibe) {
      parts.push(run.vibe)
    }
    if (run.light) {
      parts.push('light')
    }
    return parts.length ? `\u2192 effect ${parts.join(' + ')}` : 'effect missing'
  }

  return run.type
}

export function isEntityWired(entity) {
  return isRunConfigured(entity && entity.run)
}

export function countUnmappedEntities(graph) {
  let count = 0
  const screenIds = Object.keys(graph.screens || {})
  for (let i = 0; i < screenIds.length; i += 1) {
    const screen = graph.screens[screenIds[i]]
    const items = Array.isArray(screen?.items) ? screen.items : []
    const actions = getScreenActions(screen)
    items.forEach((item) => {
      if (!isEntityWired(item)) {
        count += 1
      }
    })
    actions.forEach((action) => {
      if (!isEntityWired(action)) {
        count += 1
      }
    })
  }
  return count
}

export function getRunTargetNodeIdForType(runType) {
  const target = RUN_TARGETS.find((item) => item.runType === runType)
  return target ? target.id : ''
}

export function getCanvasTargetIdForRun(run) {
  if (!run || !run.type) {
    return ''
  }

  if (run.type === 'navigate') {
    return run.screen || ''
  }

  return getRunTargetNodeIdForType(run.type)
}

export function collectRequiredRunTargetIds(graph) {
  const ids = new Set()
  const screens = graph && graph.screens ? Object.values(graph.screens) : []

  screens.forEach((screen) => {
    const entities = []
    if (Array.isArray(screen?.items)) {
      entities.push(...screen.items)
    }
    entities.push(...getScreenActions(screen))

    entities.forEach((entity) => {
      const run = entity && entity.run
      if (!run || !run.type || run.type === 'navigate') {
        return
      }
      const nodeId = getRunTargetNodeIdForType(run.type)
      if (nodeId) {
        ids.add(nodeId)
      }
    })
  })

  return Array.from(ids)
}

export function collectNodeUsages(graph, targetId) {
  if (!graph || !graph.screens || !targetId) {
    return []
  }

  const usages = []
  const screenIds = Object.keys(graph.screens)

  for (let i = 0; i < screenIds.length; i += 1) {
    const screenId = screenIds[i]
    const screen = graph.screens[screenId]
    const screenLabel = screen.title || screenId

    if (screen.type === 'menu' && Array.isArray(screen.items)) {
      screen.items.forEach((item, index) => {
        if (getCanvasTargetIdForRun(item && item.run) !== targetId) {
          return
        }
        usages.push({
          id: `${screenId}:item:${item.id || index}`,
          sourceScreenId: screenId,
          sourceScreenLabel: screenLabel,
          entityKind: 'Menu Item',
          entityLabel: item.label || item.id || `Item ${index + 1}`
        })
      })
    }

    getScreenActions(screen).forEach((action, index) => {
      if (getCanvasTargetIdForRun(action && action.run) !== targetId) {
        return
      }
      usages.push({
        id: `${screenId}:action:${action.id || index}`,
        sourceScreenId: screenId,
        sourceScreenLabel: screenLabel,
        entityKind: screenUsesSelectDrawer(screen) ? 'Drawer Item' : 'Action',
        entityLabel: action.label || action.id || action.slot || `Action ${index + 1}`
      })
    })
  }

  return usages
}

export function remapNavigateTargets(screens, oldId, newId) {
  const nextScreens = {}
  const screenIds = Object.keys(screens)

  for (let i = 0; i < screenIds.length; i += 1) {
    const screenId = screenIds[i]
    const screen = screens[screenId]
    const nextScreen = { ...screen }

    if (nextScreen.type === 'menu' && Array.isArray(nextScreen.items)) {
      nextScreen.items = nextScreen.items.map((item) => {
        if (!item || !item.run || item.run.type !== 'navigate' || item.run.screen !== oldId) {
          return item
        }

        return {
          ...item,
          run: {
            ...item.run,
            screen: newId
          }
        }
      })
    }

    if (screenSupportsActions(nextScreen) && Array.isArray(nextScreen.actions)) {
      nextScreen.actions = nextScreen.actions.map((action) => {
        if (!action || !action.run || action.run.type !== 'navigate' || action.run.screen !== oldId) {
          return action
        }

        return {
          ...action,
          run: {
            ...action.run,
            screen: newId
          }
        }
      })
    }

    nextScreens[screenId] = nextScreen
  }

  return nextScreens
}

export function computeAutoPosition(index, total) {
  const radius = Math.max(240, total * 48)
  const angle = total ? (index / total) * Math.PI * 2 : 0
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius
  }
}

export function computeRunTargetPosition(index) {
  return {
    x: 760,
    y: -120 + index * 170
  }
}

function buildEdgeLabel(sourceId, entity, index) {
  const base = entity.label || entity.value || entity.id || `link-${index}`
  return `${sourceId} → ${base}`
}

function createGraphEdge({ source, sourceHandle, target, label, accent, kind, laneIndex = 0, laneCount = 1 }) {
  return {
    id: `${source}:${sourceHandle}:${target}`,
    source,
    sourceHandle,
    target,
    label,
    type: 'canvas',
    markerEnd: { type: MarkerType.ArrowClosed },
    animated: true,
    style: { stroke: accent },
    data: { source, sourceHandle, target, kind, laneIndex, laneCount }
  }
}

export function buildGraphEdges(graph) {
  const edgeSpecs = []
  const screenIds = Object.keys(graph.screens)

  for (let i = 0; i < screenIds.length; i += 1) {
    const screenId = screenIds[i]
    const screen = graph.screens[screenId]

    if (screen.type === 'menu' && Array.isArray(screen.items)) {
      screen.items.forEach((item, index) => {
        if (!item || !item.run || !isRunConfigured(item.run)) {
          return
        }
        const target = item.run.type === 'navigate' ? item.run.screen : RUN_TARGETS.find((candidate) => candidate.runType === item.run.type)?.id
        if (!target) {
          return
        }
        edgeSpecs.push({
          source: screenId,
          sourceHandle: `item-${item.id || index}`,
          target,
          label: buildEdgeLabel(screenId, item, index),
          accent: item.run.type === 'navigate' ? 'var(--accent)' : '#ffbf69',
          kind: item.run.type
        })
      })
    }

    getScreenActions(screen).forEach((action, index) => {
      if (!action || !action.run || !isRunConfigured(action.run)) {
        return
      }
      const target = action.run.type === 'navigate' ? action.run.screen : RUN_TARGETS.find((candidate) => candidate.runType === action.run.type)?.id
      if (!target) {
        return
      }
      edgeSpecs.push({
        source: screenId,
        sourceHandle: `action-${action.id || index}`,
        target,
        label: buildEdgeLabel(screenId, action, index),
        accent:
          action.run.type === 'navigate'
            ? screenUsesSelectDrawer(screen)
              ? '#72e4ff'
              : 'var(--accent-2)'
            : '#ffd166',
        kind: action.run.type
      })
    })
  }

  const countsByTarget = edgeSpecs.reduce((acc, spec) => {
    acc[spec.target] = (acc[spec.target] || 0) + 1
    return acc
  }, {})
  const seenByTarget = {}

  return edgeSpecs.map((spec) => {
    const laneIndex = seenByTarget[spec.target] || 0
    seenByTarget[spec.target] = laneIndex + 1
    return createGraphEdge({
      ...spec,
      laneIndex,
      laneCount: countsByTarget[spec.target] || 1
    })
  })
}

export function buildGraphNodes(graph, positions, selectedId, activeRunTargetIds, runTargetPositions, callbacks = {}) {
  const screenIds = Object.keys(graph.screens)
  const screenNodes = screenIds.map((id, index) => {
    const screen = graph.screens[id]
    const position = positions[id] || computeAutoPosition(index, screenIds.length)
    const isSelected = id === selectedId
    const tags = []
    if (graph.entryScreenId === id) {
      tags.push('entry')
    }
    tags.push(screen.type)
    if (screenUsesSelectDrawer(screen) && getScreenActions(screen).length > 0) {
      tags.push('drawer')
    }

    return {
      id,
      type: 'pebble',
      position,
      data: {
        title: screen.title,
        tags,
        screen,
        onAddMenuItem: callbacks.onAddMenuItem,
        onAddDrawerItem: callbacks.onAddDrawerItem
      },
      style: {
        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--line)'}`,
        background: isSelected ? 'rgba(52, 198, 167, 0.12)' : 'rgba(10, 15, 24, 0.78)',
        color: 'var(--ink)',
        borderRadius: 12,
        padding: 6
      },
      draggable: true,
      className: isSelected ? 'node-selected' : ''
    }
  })

  const runTargetNodes = RUN_TARGETS
    .filter((target) => activeRunTargetIds.includes(target.id))
    .map((target, index) => {
      const isSelected = target.id === selectedId
      return {
        id: target.id,
        type: 'runTarget',
        position: runTargetPositions[target.id] || computeRunTargetPosition(index),
        draggable: true,
        selectable: true,
        deletable: false,
        data: target,
        style: {
          border: `1px solid ${isSelected ? 'rgba(255, 191, 105, 0.9)' : 'rgba(255, 191, 105, 0.45)'}`,
          boxShadow: isSelected ? '0 0 0 3px rgba(255, 191, 105, 0.12)' : '0 12px 28px rgba(0, 0, 0, 0.24)'
        },
        className: isSelected ? 'node-selected' : ''
      }
    })

  return screenNodes.concat(runTargetNodes)
}
