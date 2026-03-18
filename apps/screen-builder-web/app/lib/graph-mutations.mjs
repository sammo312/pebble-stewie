function createBuilderMeta(baseMeta) {
  return baseMeta || { variables: [], storageKeys: [], dataItems: [] }
}

function updateBuilderMeta(graph, mutator) {
  const meta = createBuilderMeta(graph._builderMeta)
  const nextMeta = mutator(meta)

  if (nextMeta === meta) {
    return graph
  }

  return {
    ...graph,
    _builderMeta: nextMeta
  }
}

export function setEntryScreenIdInGraph(graph, entryScreenId) {
  return { ...graph, entryScreenId }
}

export function setStorageNamespaceInGraph(graph, storageNamespace) {
  const next = { ...graph }
  if (storageNamespace) {
    next.storageNamespace = storageNamespace
  } else {
    delete next.storageNamespace
  }
  return next
}

export function addVariableToGraph(graph, key, defaultValue = '', typeHint = 'string') {
  return updateBuilderMeta(graph, (meta) => {
    if (meta.variables.some((variable) => variable.key === key)) {
      return meta
    }

    return {
      ...meta,
      variables: [...meta.variables, { key, defaultValue, typeHint }]
    }
  })
}

export function removeVariableFromGraph(graph, key) {
  return updateBuilderMeta(graph, (meta) => ({
    ...meta,
    variables: meta.variables.filter((variable) => variable.key !== key)
  }))
}

export function updateVariableInGraph(graph, key, field, value) {
  return updateBuilderMeta(graph, (meta) => ({
    ...meta,
    variables: meta.variables.map((variable) =>
      variable.key === key ? { ...variable, [field]: value } : variable
    )
  }))
}

export function addStorageKeyToGraph(graph, key, typeHint = 'string') {
  return updateBuilderMeta(graph, (meta) => {
    if (meta.storageKeys.some((storageItem) => storageItem.key === key)) {
      return meta
    }

    return {
      ...meta,
      storageKeys: [...meta.storageKeys, { key, typeHint }]
    }
  })
}

export function removeStorageKeyFromGraph(graph, key) {
  return updateBuilderMeta(graph, (meta) => ({
    ...meta,
    storageKeys: meta.storageKeys.filter((storageItem) => storageItem.key !== key)
  }))
}

export function updateStorageKeyInGraph(graph, key, field, value) {
  return updateBuilderMeta(graph, (meta) => ({
    ...meta,
    storageKeys: meta.storageKeys.map((storageItem) =>
      storageItem.key === key ? { ...storageItem, [field]: value } : storageItem
    )
  }))
}

export function addDataItemToGraph(graph, item) {
  return updateBuilderMeta(graph, (meta) => {
    const dataItems = Array.isArray(meta.dataItems) ? meta.dataItems : []
    if (dataItems.some((dataItem) => dataItem.key === item.key && dataItem.scope === item.scope)) {
      return meta
    }

    return {
      ...meta,
      dataItems: [...dataItems, item]
    }
  })
}

export function removeDataItemFromGraph(graph, key, scope) {
  return updateBuilderMeta(graph, (meta) => {
    const dataItems = Array.isArray(meta.dataItems) ? meta.dataItems : []
    return {
      ...meta,
      dataItems: dataItems.filter((dataItem) => !(dataItem.key === key && dataItem.scope === scope))
    }
  })
}

export function updateDataItemInGraph(graph, key, scope, field, value) {
  return updateBuilderMeta(graph, (meta) => {
    const dataItems = Array.isArray(meta.dataItems) ? meta.dataItems : []
    return {
      ...meta,
      dataItems: dataItems.map((dataItem) =>
        dataItem.key === key && dataItem.scope === scope
          ? { ...dataItem, [field]: value }
          : dataItem
      )
    }
  })
}

export function addMenuItemToScreen(screen, { ensureUniqueEntityId }) {
  const items = Array.isArray(screen.items) ? screen.items.slice() : []
  const id = ensureUniqueEntityId(items, 'item', 'item')
  items.push({ id, label: 'New Item', value: '', labelTemplate: '', run: null })
  return { ...screen, items }
}

export function removeMenuItemFromScreen(screen, index) {
  const items = Array.isArray(screen.items) ? screen.items.slice() : []
  items.splice(index, 1)
  return { ...screen, items }
}

export function updateMenuItemInScreen(screen, index, fieldId, value, { updateEntityField }) {
  const items = Array.isArray(screen.items) ? screen.items.slice() : []
  const current = items[index] || {}
  items[index] = updateEntityField(current, fieldId, value)
  return { ...screen, items }
}

export function addScreenActionToScreen(
  screen,
  { ensureUniqueEntityId, getScreenActions, screenUsesSelectDrawer, actionSlots }
) {
  const actions = getScreenActions(screen).slice()

  if (screenUsesSelectDrawer(screen)) {
    const id = ensureUniqueEntityId(actions, 'drawer_item', 'drawer_item')
    actions.push({
      id,
      label: 'Action Menu Item',
      value: '',
      run: null
    })
    return { ...screen, actions }
  }

  const usedSlots = new Set(actions.map((action) => action.slot))
  const slot = actionSlots.find((candidate) => !usedSlots.has(candidate)) || 'select'
  const id = ensureUniqueEntityId(actions, 'action', 'action')

  actions.push({
    slot,
    id,
    icon: 'check',
    label: 'Action',
    value: '',
    run: null
  })

  return { ...screen, actions }
}

export function removeScreenActionFromScreen(screen, index, { getScreenActions }) {
  const actions = getScreenActions(screen).slice()
  actions.splice(index, 1)
  return { ...screen, actions }
}

export function updateScreenActionInScreen(screen, index, fieldId, value, { getScreenActions, updateEntityField }) {
  const actions = getScreenActions(screen).slice()
  const current = actions[index] || {}
  actions[index] = updateEntityField(current, fieldId, value)
  return { ...screen, actions }
}

export function addScreenHookToScreen(screen, hookKey, { getScreenHookRuns, createDefaultScreenHookRun }) {
  const hooks = getScreenHookRuns(screen, hookKey).slice()
  hooks.push(createDefaultScreenHookRun())
  return {
    ...screen,
    [hookKey]: hooks
  }
}

export function removeScreenHookFromScreen(screen, hookKey, index, { getScreenHookRuns }) {
  const hooks = getScreenHookRuns(screen, hookKey).slice()
  hooks.splice(index, 1)

  const next = { ...screen }
  if (hooks.length) {
    next[hookKey] = hooks
  } else {
    delete next[hookKey]
  }

  return next
}

export function updateScreenHookInScreen(
  screen,
  hookKey,
  index,
  fieldId,
  value,
  { getScreenHookRuns, createDefaultScreenHookRun, updateRunField }
) {
  const hooks = getScreenHookRuns(screen, hookKey).slice()
  const currentRun = hooks[index] || createDefaultScreenHookRun()
  const nextEntity = updateRunField({ run: currentRun }, fieldId, value)

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
}

export function updateScreenTimerInScreen(
  screen,
  fieldId,
  value,
  { createDefaultScreenTimer, updateRunField }
) {
  if (fieldId === 'timer.durationMs') {
    const nextDuration = Math.max(100, Math.min(86400000, Number.parseInt(String(value || '0'), 10) || 5000))
    const currentTimer = screen.timer || createDefaultScreenTimer()
    return {
      ...screen,
      timer: {
        ...currentTimer,
        durationMs: nextDuration
      }
    }
  }

  const currentTimer = screen.timer || createDefaultScreenTimer()
  const nextEntity = updateRunField({ run: currentTimer.run }, fieldId, value)
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
}

export function toggleScreenTimerInScreen(screen, enabled, { createDefaultScreenTimer }) {
  if (!enabled) {
    const next = { ...screen }
    delete next.timer
    return next
  }

  return {
    ...screen,
    timer: screen.timer || createDefaultScreenTimer()
  }
}

const HANDLE_TO_SLOT = {
  'slot-up': 'up',
  'slot-select': 'select',
  'slot-down': 'down'
}

function updateScreenInGraph(graph, screenId, mutator) {
  const screen = graph.screens[screenId]
  if (!screen) {
    return graph
  }

  const nextScreen = mutator(screen)
  if (nextScreen === screen) {
    return graph
  }

  return {
    ...graph,
    screens: {
      ...graph.screens,
      [screenId]: nextScreen
    }
  }
}

export function createRunFromTargetId(targetId, existingRun = {}, { getRunTargetDefinition, pruneRunForType }) {
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

export function buildRunForCanvasTarget(graph, targetId, existingRun = {}, deps) {
  if (deps.isRunTargetId(targetId)) {
    return createRunFromTargetId(targetId, existingRun, deps)
  }

  if (graph.screens[targetId]) {
    return deps.pruneRunForType('navigate', { ...(existingRun || {}), screen: targetId })
  }

  return null
}

export function describeCanvasTarget(graph, targetId, { isRunTargetId, getRunTargetDefinition }) {
  if (isRunTargetId(targetId)) {
    return getRunTargetDefinition(targetId)?.title || targetId
  }

  const targetScreen = graph.screens[targetId]
  return targetScreen?.title || targetId
}

export function defaultCardActionLabelForLink(graph, slot, targetId, deps) {
  const targetName = describeCanvasTarget(graph, targetId, deps)
  return deps.isRunTargetId(targetId) ? `${slot} ${targetName}` : `${slot} → ${targetName}`
}

export function defaultMenuActionLabelForLink(graph, targetId, deps) {
  const targetName = describeCanvasTarget(graph, targetId, deps)
  return deps.isRunTargetId(targetId) ? targetName : `Open ${targetName}`
}

export function clearLinkByHandleInGraph(graph, sourceScreenId, sourceHandle, { getScreenActions }) {
  const screen = graph.screens[sourceScreenId]
  if (!screen) {
    return { graph, removed: false }
  }

  if (sourceHandle.startsWith('item-')) {
    const key = sourceHandle.slice('item-'.length)
    let removed = false
    const nextGraph = updateScreenInGraph(graph, sourceScreenId, (currentScreen) => {
      const items = Array.isArray(currentScreen.items) ? currentScreen.items : []
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
        return currentScreen
      }

      return {
        ...currentScreen,
        items: nextItems
      }
    })

    return { graph: nextGraph, removed }
  }

  if (sourceHandle.startsWith('action-') || sourceHandle.startsWith('slot-')) {
    const isSlot = sourceHandle.startsWith('slot-')
    const key = isSlot ? sourceHandle.slice('slot-'.length) : sourceHandle.slice('action-'.length)
    let removed = false
    const nextGraph = updateScreenInGraph(graph, sourceScreenId, (currentScreen) => {
      const actions = getScreenActions(currentScreen)
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
        return currentScreen
      }

      return {
        ...currentScreen,
        actions: nextActions
      }
    })

    return { graph: nextGraph, removed }
  }

  if (sourceHandle.startsWith('hook-')) {
    const parts = sourceHandle.slice('hook-'.length).split('-')
    const hookKey = parts[0]
    const hookIndex = Number.parseInt(parts[1], 10)
    let removed = false
    const nextGraph = updateScreenInGraph(graph, sourceScreenId, (currentScreen) => {
      const hooks = Array.isArray(currentScreen[hookKey]) ? [...currentScreen[hookKey]] : []
      if (!hooks[hookIndex]) {
        return currentScreen
      }

      removed = true
      hooks.splice(hookIndex, 1)
      return {
        ...currentScreen,
        [hookKey]: hooks
      }
    })

    return { graph: nextGraph, removed }
  }

  if (sourceHandle === 'timer-run' && screen.timer) {
    return {
      graph: updateScreenInGraph(graph, sourceScreenId, (currentScreen) => ({
        ...currentScreen,
        timer: { ...currentScreen.timer, run: null }
      })),
      removed: true
    }
  }

  return { graph, removed: false }
}

export function connectCanvasHandleInGraph(graph, connection, deps) {
  const { source, sourceHandle, target } = connection || {}
  if (!source || !sourceHandle || !target) {
    return { graph, kind: 'ignored' }
  }

  const screen = graph.screens[source]
  if (!screen) {
    return { graph, kind: 'ignored' }
  }

  if (HANDLE_TO_SLOT[sourceHandle]) {
    if (!deps.screenUsesButtonSlots(screen)) {
      return {
        graph,
        kind: 'error',
        message: 'Button slot links currently create card action-bar actions.'
      }
    }

    const slot = HANDLE_TO_SLOT[sourceHandle]
    const existingAction = deps.getScreenActions(screen).find((action) => action.slot === slot)

    if (existingAction) {
      const nextGraph = updateScreenInGraph(graph, source, (currentScreen) => {
        if (!currentScreen || currentScreen.type !== 'card') {
          return currentScreen
        }

        return {
          ...currentScreen,
          actions: deps.getScreenActions(currentScreen).map((action) => {
            if (action.slot !== slot) {
              return action
            }

            return {
              ...action,
              value: deps.isRunTargetId(target) ? slot : target,
              run: buildRunForCanvasTarget(graph, target, action.run || {}, deps)
            }
          })
        }
      })

      return {
        graph: nextGraph,
        kind: 'success',
        message: `Linked ${slot} to ${describeCanvasTarget(graph, target, deps)}`,
        focusSourceId: source
      }
    }

    const nextGraph = updateScreenInGraph(graph, source, (currentScreen) => {
      if (!currentScreen || currentScreen.type !== 'card') {
        return currentScreen
      }

      const actions = deps.getScreenActions(currentScreen).slice()
      actions.push({
        slot,
        id: deps.ensureUniqueEntityId(actions, `${slot}_action`, 'action'),
        icon: 'check',
        label: defaultCardActionLabelForLink(graph, slot, target, deps),
        value: deps.isRunTargetId(target) ? slot : target,
        run: buildRunForCanvasTarget(graph, target, {}, deps)
      })

      return {
        ...currentScreen,
        actions
      }
    })

    return {
      graph: nextGraph,
      kind: 'success',
      message: `Created ${slot} action to ${describeCanvasTarget(graph, target, deps)}`,
      focusSourceId: source
    }
  }

  if (sourceHandle === 'menu-action-create') {
    if (!deps.screenUsesSelectDrawer(screen)) {
      return {
        graph,
        kind: 'error',
        message: 'Action-menu links apply to scroll screens'
      }
    }

    if (deps.getScreenActions(screen).length >= deps.maxMenuActions) {
      return {
        graph,
        kind: 'error',
        message: 'Maximum action-menu items reached'
      }
    }

    const nextGraph = updateScreenInGraph(graph, source, (currentScreen) => {
      if (!currentScreen || !deps.screenUsesSelectDrawer(currentScreen)) {
        return currentScreen
      }

      const actions = deps.getScreenActions(currentScreen).slice()
      actions.push({
        id: deps.ensureUniqueEntityId(actions, 'drawer_item', 'drawer_item'),
        label: defaultMenuActionLabelForLink(graph, target, deps),
        value: deps.isRunTargetId(target) ? '' : target,
        run: buildRunForCanvasTarget(graph, target, {}, deps)
      })

      return {
        ...currentScreen,
        actions
      }
    })

    return {
      graph: nextGraph,
      kind: 'success',
      message: `Created action-menu item to ${describeCanvasTarget(graph, target, deps)}`,
      focusSourceId: source
    }
  }

  if (sourceHandle.startsWith('item-')) {
    if (screen.type !== 'menu') {
      return {
        graph,
        kind: 'error',
        message: 'Item links apply to menu screens'
      }
    }

    const key = sourceHandle.slice('item-'.length)
    const nextGraph = updateScreenInGraph(graph, source, (currentScreen) => {
      if (currentScreen.type !== 'menu') {
        return currentScreen
      }

      const items = Array.isArray(currentScreen.items) ? currentScreen.items.slice() : []
      return {
        ...currentScreen,
        items: items.map((item, idx) => {
          const matchId = item.id ? String(item.id) === key : false
          const matchIndex = !item.id && String(idx) === key
          if (!matchId && !matchIndex) {
            return item
          }

          return {
            ...item,
            run: buildRunForCanvasTarget(graph, target, item.run || {}, deps)
          }
        })
      }
    })

    return {
      graph: nextGraph,
      kind: 'success',
      message: `Linked item to ${describeCanvasTarget(graph, target, deps)}`,
      focusSourceId: source
    }
  }

  if (sourceHandle.startsWith('action-')) {
    if (!deps.screenSupportsActions(screen)) {
      return {
        graph,
        kind: 'error',
        message: 'Action links apply to screens with actions'
      }
    }

    const key = sourceHandle.slice('action-'.length)
    const nextGraph = updateScreenInGraph(graph, source, (currentScreen) => {
      if (!deps.screenSupportsActions(currentScreen)) {
        return currentScreen
      }

      const actions = deps.getScreenActions(currentScreen).slice()
      return {
        ...currentScreen,
        actions: actions.map((action, idx) => {
          const matchId = action.id ? String(action.id) === key : false
          const matchIndex = !action.id && String(idx) === key
          if (!matchId && !matchIndex) {
            return action
          }

          return {
            ...action,
            run: buildRunForCanvasTarget(graph, target, action.run || {}, deps),
            value: deps.isRunTargetId(target) ? action.value || action.label || action.id : target
          }
        })
      }
    })

    return {
      graph: nextGraph,
      kind: 'success',
      message: `Linked ${deps.screenUsesSelectDrawer(screen) ? 'action-menu item' : 'action'} to ${describeCanvasTarget(graph, target, deps)}`,
      focusSourceId: source
    }
  }

  return {
    graph,
    kind: 'error',
    message: 'Handle not linkable'
  }
}

export function updateMotionFieldInScreen(screen, fieldId, rawValue, deps) {
  const motion = deps.normalizeMotion(screen.motion || deps.createDefaultMotion())
  let value = rawValue
  if (fieldId === 'timelineMs') {
    value = deps.coerceDrawNumber(rawValue, Number(motion.timelineMs || 1800), 240, 20000)
  }

  const compiled = deps.buildCompiledMotionState({
    ...motion,
    [fieldId]: value
  }, screen.canvas)

  return {
    ...screen,
    motion: compiled.motion,
    drawing: compiled.drawing
  }
}

export function updateCanvasTemplateInScreen(screen, template, deps) {
  const nextCanvas =
    String(template || 'freeform') === 'header_list'
      ? deps.normalizeCanvas(screen.canvas?.template === 'header_list'
          ? screen.canvas
          : deps.createDefaultCanvas({ header: screen.title || 'Main Menu' }))
      : deps.normalizeCanvas({ template: 'freeform' })

  if (!screen.motion) {
    return {
      ...screen,
      canvas: nextCanvas
    }
  }

  const compiled = deps.buildCompiledMotionState(
    nextCanvas.template === 'header_list' ? deps.createDefaultCanvasMotion(nextCanvas) : screen.motion,
    nextCanvas
  )

  return {
    ...screen,
    canvas: compiled.canvas,
    motion: compiled.motion,
    drawing: compiled.drawing
  }
}

export function updateCanvasHeaderInScreen(screen, rawValue, deps) {
  const canvas = deps.normalizeCanvas(screen.canvas || deps.createDefaultCanvas({ header: screen.title || 'Main Menu' }))
  const nextCanvas = {
    ...canvas,
    header: String(rawValue || '').slice(0, deps.maxTitleLen || 30)
  }

  if (!screen.motion) {
    return {
      ...screen,
      canvas: nextCanvas
    }
  }

  const compiled = deps.buildCompiledMotionState(screen.motion, nextCanvas)
  return {
    ...screen,
    canvas: compiled.canvas,
    motion: compiled.motion,
    drawing: compiled.drawing
  }
}

export function addCanvasItemToScreen(screen, deps) {
  const canvas = deps.normalizeCanvas(screen.canvas || deps.createDefaultCanvas({ header: screen.title || 'Main Menu' }))
  const items = Array.isArray(canvas.items) ? canvas.items.slice() : []
  if (items.length >= deps.maxCanvasItems) {
    return screen
  }

  const id = deps.ensureUniqueEntityId(items, 'item', 'item')
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

  const compiled = deps.buildCompiledMotionState(screen.motion, nextCanvas)
  return {
    ...screen,
    canvas: compiled.canvas,
    motion: compiled.motion,
    drawing: compiled.drawing
  }
}

export function removeCanvasItemFromScreen(screen, index, deps) {
  const canvas = deps.normalizeCanvas(screen.canvas || deps.createDefaultCanvas({ header: screen.title || 'Main Menu' }))
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

  const compiled = deps.buildCompiledMotionState(screen.motion, nextCanvas)
  return {
    ...screen,
    canvas: compiled.canvas,
    motion: compiled.motion,
    drawing: compiled.drawing
  }
}

export function updateCanvasItemInScreen(screen, index, rawValue, deps) {
  const canvas = deps.normalizeCanvas(screen.canvas || deps.createDefaultCanvas({ header: screen.title || 'Main Menu' }))
  const items = Array.isArray(canvas.items) ? canvas.items.slice() : []
  const current = items[index]
  if (!current) {
    return screen
  }

  items[index] = {
    ...current,
    label: String(rawValue || '').slice(0, deps.maxOptionLabelLen || 18)
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

  const compiled = deps.buildCompiledMotionState(screen.motion, nextCanvas)
  return {
    ...screen,
    canvas: compiled.canvas,
    motion: compiled.motion,
    drawing: compiled.drawing
  }
}

export function addMotionTrackToScreen(screen, deps) {
  const nextMotion = deps.normalizeMotion(screen.motion || deps.createDefaultMotion())
  const nextTracks = Array.isArray(nextMotion.tracks) ? nextMotion.tracks.slice() : []
  nextTracks.push(
    deps.createDefaultMotionTrack(
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

  const compiled = deps.buildCompiledMotionState({
    ...nextMotion,
    tracks: nextTracks
  }, screen.canvas)
  return {
    ...screen,
    motion: compiled.motion,
    drawing: compiled.drawing
  }
}

export function removeMotionTrackFromScreen(screen, index, deps) {
  const motion = deps.normalizeMotion(screen.motion || deps.createDefaultMotion())
  const tracks = Array.isArray(motion.tracks) ? motion.tracks.slice() : []
  tracks.splice(index, 1)
  const compiled = deps.buildCompiledMotionState({
    ...motion,
    tracks
  }, screen.canvas)
  return {
    ...screen,
    motion: compiled.motion,
    drawing: compiled.drawing
  }
}

export function updateMotionTrackInScreen(screen, index, fieldId, rawValue, deps) {
  const motion = deps.normalizeMotion(screen.motion || deps.createDefaultMotion())
  const tracks = Array.isArray(motion.tracks) ? motion.tracks.slice() : []
  const current = tracks[index] || deps.createDefaultMotionTrack(tracks)
  let value = rawValue

  if (fieldId === 'fill') {
    value = !!rawValue
  } else if (fieldId === 'id') {
    const otherTracks = tracks.filter((_, trackIndex) => trackIndex !== index)
    value = deps.ensureUniqueEntityId(otherTracks, rawValue, current.id || 'track')
  } else if (fieldId === 'delayMs') {
    value = deps.coerceDrawNumber(rawValue, Number(current.delayMs || 0), 0, 20000)
  } else {
    value = String(rawValue || '')
  }

  tracks[index] = {
    ...current,
    [fieldId]: value
  }
  const compiled = deps.buildCompiledMotionState({
    ...motion,
    tracks
  }, screen.canvas)

  return {
    ...screen,
    motion: compiled.motion,
    drawing: compiled.drawing
  }
}

export function detachMotionToRawInScreen(screen, deps) {
  const next = {
    ...screen,
    drawing: screen.drawing || deps.createDefaultDrawing()
  }
  delete next.motion
  return next
}

export function enablePresetMotionInScreen(screen, deps) {
  const baseMotion =
    screen.motion ||
    (screen.canvas?.template === 'header_list'
      ? deps.createDefaultCanvasMotion(screen.canvas)
      : deps.createDefaultMotion())
  const compiled = deps.buildCompiledMotionState(baseMotion, screen.canvas)
  return {
    ...screen,
    motion: compiled.motion,
    drawing: compiled.drawing
  }
}

export function updateDrawFieldInScreen(screen, fieldId, rawValue, deps) {
  const drawing = screen.drawing || deps.createDefaultDrawing()
  let value = rawValue
  if (fieldId === 'timelineMs') {
    value = deps.coerceDrawNumber(rawValue, Number(drawing.timelineMs || 1800), 240, 20000)
  }

  return {
    ...screen,
    drawing: {
      ...drawing,
      [fieldId]: value
    }
  }
}

export function addDrawStepToScreen(screen, deps) {
  const nextDrawing = screen.drawing || deps.createDefaultDrawing()
  const nextSteps = Array.isArray(nextDrawing.steps) ? nextDrawing.steps.slice() : []
  nextSteps.push(deps.createDefaultDrawStep(nextSteps))
  return {
    ...screen,
    drawing: {
      ...nextDrawing,
      steps: deps.clampDrawStepCount(nextSteps)
    }
  }
}

export function removeDrawStepFromScreen(screen, index, deps) {
  const drawing = screen.drawing || deps.createDefaultDrawing()
  const steps = Array.isArray(drawing.steps) ? drawing.steps.slice() : []
  steps.splice(index, 1)
  return {
    ...screen,
    drawing: {
      ...drawing,
      steps
    }
  }
}

export function updateDrawStepInScreen(screen, index, fieldId, rawValue, deps) {
  const drawing = screen.drawing || deps.createDefaultDrawing()
  const steps = Array.isArray(drawing.steps) ? drawing.steps.slice() : []
  const current = steps[index] || deps.createDefaultDrawStep(steps)
  let value = rawValue

  if (fieldId === 'fill') {
    value = !!rawValue
  } else if (fieldId === 'id') {
    const otherSteps = steps.filter((_, stepIndex) => stepIndex !== index)
    value = deps.ensureUniqueEntityId(otherSteps, rawValue, current.id || 'step')
  } else if (deps.isDrawStepNumericField(fieldId)) {
    const { min, max } = deps.getDrawStepFieldLimit(fieldId)
    value = deps.coerceDrawNumber(rawValue, Number(current[fieldId] || 0), min, max)
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
      steps: deps.clampDrawStepCount(steps)
    }
  }
}
