import {
  RUN_TARGETS,
  screenUsesSelectDrawer,
  screenSupportsActions,
  getScreenActions
} from './constants.js'
import {
  describeRunTarget,
  getScreenHookRuns,
  getScreenTimerRun,
  isEntityWired,
  isRunConfigured
} from './graph-run-helpers.mjs'

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
    getScreenHookRuns(screen, 'onEnter').forEach((run) => {
      if (!isRunConfigured(run)) {
        count += 1
      }
    })
    getScreenHookRuns(screen, 'onExit').forEach((run) => {
      if (!isRunConfigured(run)) {
        count += 1
      }
    })
    if (getScreenTimerRun(screen) && !isRunConfigured(getScreenTimerRun(screen))) {
      count += 1
    }
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
    entities.push(...getScreenHookRuns(screen, 'onEnter').map((run) => ({ run })))
    entities.push(...getScreenHookRuns(screen, 'onExit').map((run) => ({ run })))
    if (getScreenTimerRun(screen)) {
      entities.push({ run: getScreenTimerRun(screen) })
    }
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
          entityLabel: item.label || item.id || `Item ${index + 1}`,
          runSummary: describeRunTarget(item.run)
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
        entityLabel: action.label || action.id || action.slot || `Action ${index + 1}`,
        runSummary: describeRunTarget(action.run)
      })
    })

    getScreenHookRuns(screen, 'onEnter').forEach((run, index) => {
      if (getCanvasTargetIdForRun(run) !== targetId) {
        return
      }
      usages.push({
        id: `${screenId}:hook:onEnter:${index}`,
        sourceScreenId: screenId,
        sourceScreenLabel: screenLabel,
        entityKind: 'On Enter',
        entityLabel: describeRunTarget(run),
        runSummary: describeRunTarget(run)
      })
    })

    getScreenHookRuns(screen, 'onExit').forEach((run, index) => {
      if (getCanvasTargetIdForRun(run) !== targetId) {
        return
      }
      usages.push({
        id: `${screenId}:hook:onExit:${index}`,
        sourceScreenId: screenId,
        sourceScreenLabel: screenLabel,
        entityKind: 'On Exit',
        entityLabel: describeRunTarget(run),
        runSummary: describeRunTarget(run)
      })
    })

    if (getCanvasTargetIdForRun(getScreenTimerRun(screen)) === targetId) {
      usages.push({
        id: `${screenId}:timer`,
        sourceScreenId: screenId,
        sourceScreenLabel: screenLabel,
        entityKind: 'Timer',
        entityLabel: describeRunTarget(getScreenTimerRun(screen)),
        runSummary: describeRunTarget(getScreenTimerRun(screen))
      })
    }
  }

  return usages
}

export function collectRunTargetUsageSummary(graph, targetId, maxItems = 3) {
  const usages = collectNodeUsages(graph, targetId)
  const lines = usages.map((usage) => {
    const screenLabel = usage.sourceScreenLabel || usage.sourceScreenId
    const sourceLabel = usage.entityKind === 'On Enter' || usage.entityKind === 'On Exit' || usage.entityKind === 'Timer'
      ? usage.entityKind
      : usage.entityLabel || 'item'
    return `${screenLabel}: ${sourceLabel} → ${usage.runSummary || usage.entityLabel || usage.entityKind}`
  })

  const visibleLines = lines.slice(0, maxItems)

  return {
    count: lines.length,
    lines: visibleLines,
    remaining: Math.max(lines.length - visibleLines.length, 0)
  }
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

    if (Array.isArray(nextScreen.onEnter)) {
      nextScreen.onEnter = nextScreen.onEnter.map((run) => {
        if (!run || run.type !== 'navigate' || run.screen !== oldId) {
          return run
        }

        return {
          ...run,
          screen: newId
        }
      })
    }

    if (Array.isArray(nextScreen.onExit)) {
      nextScreen.onExit = nextScreen.onExit.map((run) => {
        if (!run || run.type !== 'navigate' || run.screen !== oldId) {
          return run
        }

        return {
          ...run,
          screen: newId
        }
      })
    }

    if (nextScreen.timer && nextScreen.timer.run && nextScreen.timer.run.type === 'navigate' && nextScreen.timer.run.screen === oldId) {
      nextScreen.timer = {
        ...nextScreen.timer,
        run: {
          ...nextScreen.timer.run,
          screen: newId
        }
      }
    }

    nextScreens[screenId] = nextScreen
  }

  return nextScreens
}
