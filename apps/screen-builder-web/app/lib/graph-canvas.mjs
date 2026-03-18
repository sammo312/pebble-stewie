import { MarkerType } from '@xyflow/react'

import {
  RUN_TARGETS,
  screenUsesButtonSlots,
  screenUsesSelectDrawer,
  getScreenActions
} from './constants.js'
import {
  getScreenHookRuns,
  getScreenTimerRun,
  isRunConfigured
} from './graph-run-helpers.mjs'
import {
  collectRunTargetUsageSummary,
  getRunTargetNodeIdForType
} from './graph-usage.mjs'

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

function buildEdgeLabel(entity, index) {
  return entity.label || entity.value || entity.id || `link-${index}`
}

function createGraphEdge({
  source,
  sourceHandle,
  target,
  label,
  accent,
  kind,
  focused = false,
  muted = false
}) {
  return {
    id: `${source}:${sourceHandle}:${target}`,
    source,
    sourceHandle,
    target,
    label: focused ? label : '',
    type: 'canvas',
    markerEnd: { type: MarkerType.ArrowClosed },
    zIndex: focused ? 10 : 1,
    style: {
      stroke: accent,
      strokeWidth: focused ? 2 : 1.5,
      opacity: muted ? 0.18 : focused ? 1 : 0.7
    },
    data: { source, sourceHandle, target, kind, focused, muted }
  }
}

function getEdgeTarget(run) {
  if (!run || !run.type) {
    return ''
  }

  if (run.type === 'navigate') {
    return run.screen || ''
  }

  return getRunTargetNodeIdForType(run.type)
}

export function buildGraphEdges(graph, options = {}) {
  const focusedNodeId = options.focusedNodeId || ''
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
        const target = getEdgeTarget(item.run)
        if (!target) {
          return
        }
        edgeSpecs.push({
          source: screenId,
          sourceHandle: `item-${item.id || index}`,
          target,
          label: buildEdgeLabel(item, index),
          accent: item.run.type === 'navigate' ? 'var(--ring)' : 'var(--muted-foreground)',
          kind: item.run.type
        })
      })
    }

    const isSlotted = screenUsesButtonSlots(screen)
    getScreenActions(screen).forEach((action, index) => {
      if (!action || !action.run || !isRunConfigured(action.run)) {
        return
      }
      const target = getEdgeTarget(action.run)
      if (!target) {
        return
      }
      const sourceHandle = isSlotted && action.slot ? `slot-${action.slot}` : `action-${action.id || index}`
      edgeSpecs.push({
        source: screenId,
        sourceHandle,
        target,
        label: buildEdgeLabel(action, index),
        accent:
          action.run.type === 'navigate'
            ? screenUsesSelectDrawer(screen)
              ? 'var(--ring)'
              : 'var(--accent-2)'
            : 'var(--muted-foreground)',
        kind: action.run.type
      })
    })

    ;['onEnter', 'onExit'].forEach((hookKey) => {
      getScreenHookRuns(screen, hookKey).forEach((run, hookIndex) => {
        if (!run || !isRunConfigured(run)) {
          return
        }
        const target = getEdgeTarget(run)
        if (!target) {
          return
        }
        edgeSpecs.push({
          source: screenId,
          sourceHandle: `hook-${hookKey}-${hookIndex}`,
          target,
          label: hookKey,
          accent: 'var(--muted-foreground)',
          kind: run.type
        })
      })
    })

    const timerRun = getScreenTimerRun(screen)
    if (timerRun && isRunConfigured(timerRun)) {
      const target = getEdgeTarget(timerRun)
      if (target) {
        edgeSpecs.push({
          source: screenId,
          sourceHandle: 'timer-run',
          target,
          label: 'timer',
          accent: 'var(--muted-foreground)',
          kind: timerRun.type
        })
      }
    }
  }

  return edgeSpecs.map((spec) => {
    const focused = !!focusedNodeId && (spec.source === focusedNodeId || spec.target === focusedNodeId)
    const muted = !!focusedNodeId && !focused
    return createGraphEdge({
      ...spec,
      focused,
      muted
    })
  })
}

export function buildGraphNodes(
  graph,
  previewGraph,
  positions,
  selectedId,
  activeRunTargetIds,
  runTargetPositions,
  callbacks = {}
) {
  const screenIds = Object.keys(graph.screens)
  const screenNodes = screenIds.map((id, index) => {
    const screen = graph.screens[id]
    const previewScreen = previewGraph?.screens?.[id] || screen
    const position = positions[id] || computeAutoPosition(index, screenIds.length)
    const isSelected = id === selectedId
    const tags = []
    if (graph.entryScreenId === id) {
      tags.push('entry')
    }
    tags.push(previewScreen.type)
    if (screenUsesSelectDrawer(previewScreen) && getScreenActions(previewScreen).length > 0) {
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
        previewScreen,
        onAddMenuItem: callbacks.onAddMenuItem,
        onAddDrawerItem: callbacks.onAddDrawerItem
      },
      style: {
        border: '0',
        background: 'transparent',
        padding: 0,
        width: previewScreen.type === 'draw' ? 296 : screenUsesButtonSlots(previewScreen) ? 298 : 262
      },
      draggable: true,
      className: `graph-node-shell ${isSelected ? 'node-selected' : ''}`
    }
  })

  const runTargetNodes = RUN_TARGETS
    .filter((target) => activeRunTargetIds.includes(target.id))
    .map((target, index) => {
      const isSelected = target.id === selectedId
      const usageSummary = collectRunTargetUsageSummary(graph, target.id)
      return {
        id: target.id,
        type: 'runTarget',
        position: runTargetPositions[target.id] || computeRunTargetPosition(index),
        draggable: true,
        selectable: true,
        deletable: false,
        data: {
          ...target,
          usageSummary
        },
        style: {
          border: '0',
          background: 'transparent',
          padding: 0,
          width: 220
        },
        className: `graph-node-shell ${isSelected ? 'node-selected' : ''}`
      }
    })

  return screenNodes.concat(runTargetNodes)
}
