import { MarkerType } from '@xyflow/react'
import {
  RUN_TARGETS,
  isRunTargetId,
  screenUsesButtonSlots,
  screenUsesSelectDrawer,
  screenSupportsActions,
  getScreenActions
} from './constants'

const CONTENT_TEMPLATE_FIELDS = {
  title: 'titleTemplate',
  body: 'bodyTemplate',
  label: 'labelTemplate'
}

export function getScreenHookRuns(screen, hookKey) {
  if (!screen || (hookKey !== 'onEnter' && hookKey !== 'onExit')) {
    return []
  }
  return Array.isArray(screen[hookKey]) ? screen[hookKey] : []
}

export function getScreenTimerRun(screen) {
  return screen?.timer?.run || null
}

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

export function getContentTemplateFieldId(fieldId) {
  return CONTENT_TEMPLATE_FIELDS[fieldId] || ''
}

export function isTemplatedContentField(fieldId) {
  return !!getContentTemplateFieldId(fieldId)
}

function hasTemplateTokens(value) {
  return /\{\{|\}\}/.test(String(value || ''))
}

export function getDisplayFieldValue(entity, fieldId) {
  const templateFieldId = getContentTemplateFieldId(fieldId)
  if (templateFieldId) {
    const templateValue = getNestedValue(entity, templateFieldId)
    if (templateValue !== '') {
      return templateValue
    }
  }

  return getNestedValue(entity, fieldId)
}

export function updateTemplatedContentField(entity, fieldId, value) {
  const templateFieldId = getContentTemplateFieldId(fieldId)
  if (!templateFieldId) {
    return setNestedValue(entity, fieldId, value)
  }

  if (hasTemplateTokens(value)) {
    return setNestedValue(entity, templateFieldId, value)
  }

  const next = setNestedValue(entity, fieldId, value)
  return setNestedValue(next, templateFieldId, '')
}

function defaultRunTypeForFieldPath(path) {
  if (!path) {
    return 'navigate'
  }
  if (path === 'screen' || path.startsWith('condition.')) {
    return 'navigate'
  }
  if (path === 'prompt') {
    return 'agent_prompt'
  }
  if (path === 'command') {
    return 'agent_command'
  }
  if (path === 'key' || path === 'value') {
    return 'set_var'
  }
  if (path === 'variable') {
    return 'dictation'
  }
  if (path === 'vibe' || path === 'light') {
    return 'effect'
  }
  return 'navigate'
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
  if (type === 'navigate' && run.condition && typeof run.condition === 'object') {
    const condition = {}
    if (run.condition.var) {
      condition.var = run.condition.var
    }
    if (run.condition.op) {
      condition.op = run.condition.op
    }
    if (run.condition.value !== undefined && run.condition.value !== null && run.condition.value !== '') {
      condition.value = run.condition.value
    }
    if (condition.var || condition.op || condition.value !== undefined) {
      next.condition = condition
    }
  }
  if (type === 'set_var' && run.key) {
    next.key = run.key
  }
  if (type === 'set_var' && run.value !== undefined && run.value !== null && run.value !== '') {
    next.value = run.value
  }
  if (type === 'store' && run.key) {
    next.key = run.key
  }
  if (type === 'store' && run.value !== undefined && run.value !== null && run.value !== '') {
    next.value = run.value
  }
  if (type === 'agent_prompt' && run.prompt) {
    next.prompt = run.prompt
  }
  if (type === 'agent_command' && run.command) {
    next.command = run.command
  }
  if (type === 'dictation' && run.variable) {
    next.variable = run.variable
  }
  if (type === 'dictation' && run.screen) {
    next.screen = run.screen
  }
  if (type === 'dictation' && run.then && typeof run.then === 'object' && run.then.type) {
    next.then = run.then
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
  const runPath = fieldId.slice('run.'.length)
  const runKey = runPath.split('.')[0]

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

  const runType = entity.run && entity.run.type ? entity.run.type : defaultRunTypeForFieldPath(runPath)
  const runBase = entity.run && entity.run.type ? { ...entity.run } : { type: runType }
  const nextRun = setNestedValue(runBase, runPath, value)

  if (!entity.run || !entity.run.type) {
    return {
      ...entity,
      run: pruneRunForType(runType, nextRun)
    }
  }

  return {
    ...entity,
    run: pruneRunForType(runType, nextRun)
  }
}

export function updateEntityField(entity, fieldId, value) {
  if (fieldId.startsWith('run.')) {
    return updateRunField(entity, fieldId, value)
  }

  if (isTemplatedContentField(fieldId)) {
    return updateTemplatedContentField(entity, fieldId, value)
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
  if (runType === 'navigate' && fieldId.startsWith('run.condition.')) {
    return true
  }
  if (runType === 'set_var') {
    return fieldId === 'run.key' || fieldId === 'run.value'
  }
  if (runType === 'store') {
    return fieldId === 'run.key' || fieldId === 'run.value'
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
  if (runType === 'dictation') {
    return fieldId === 'run.variable' || fieldId === 'run.screen'
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
  if (run.type === 'set_var') {
    return !!String(run.key || '').trim() && String(run.value || '').trim() !== ''
  }
  if (run.type === 'store') {
    return !!String(run.key || '').trim() && String(run.value || '').trim() !== ''
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
  if (run.type === 'dictation') {
    return !!String(run.variable || '').trim()
  }

  return false
}

export function describeRunTarget(run) {
  if (!run || !run.type) {
    return 'unmapped'
  }

  if (run.type === 'navigate') {
    if (!run.screen) {
      return 'navigation target missing'
    }
    if (run.condition && run.condition.var && run.condition.op) {
      const compareValue = run.condition.value !== undefined && run.condition.value !== null && run.condition.value !== ''
        ? ` ${run.condition.value}`
        : ''
      return `\u2192 ${run.screen} if ${run.condition.var} ${run.condition.op}${compareValue}`
    }
    return `\u2192 ${run.screen}`
  }
  if (run.type === 'set_var') {
    if (!run.key) return 'variable target missing'
    const value = String(run.value || '')
    if (value === 'increment') return `\u2192 increment ${run.key}`
    if (value === 'decrement') return `\u2192 decrement ${run.key}`
    if (value === 'toggle') return `\u2192 toggle ${run.key}`
    return `\u2192 set ${run.key} = ${value}`
  }
  if (run.type === 'store') {
    return run.key ? `\u2192 store ${run.key} = ${String(run.value || '')}` : 'storage target missing'
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
  if (run.type === 'dictation') {
    if (!run.variable) return 'dictation variable missing'
    return `\u2192 dictate \u2192 ${run.variable}${run.screen ? ` \u2192 ${run.screen}` : ''}`
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

function collectTemplateReferenceKeys(text, scope, output) {
  if (!text || !scope || !output) {
    return
  }

  const pattern = new RegExp(`\\{\\{\\s*${scope}\\.([a-zA-Z0-9_-]+)(?:\\.[a-zA-Z0-9_.-]+)?\\s*\\}\\}`, 'g')
  let match = pattern.exec(String(text))
  while (match) {
    if (match[1]) {
      output.add(String(match[1]))
    }
    match = pattern.exec(String(text))
  }
}

function collectRunReferenceKeys(run, variableKeys, storageKeys) {
  if (!run || typeof run !== 'object') {
    return
  }

  if (run.type === 'set_var' && run.key) {
    variableKeys.add(String(run.key))
  }
  if (run.type === 'dictation' && run.variable) {
    variableKeys.add(String(run.variable))
  }
  if (run.type === 'store' && run.key) {
    storageKeys.add(String(run.key))
  }
  if (run.type === 'navigate' && run.condition?.var) {
    variableKeys.add(String(run.condition.var))
  }

  collectTemplateReferenceKeys(run.value, 'var', variableKeys)
  collectTemplateReferenceKeys(run.value, 'storage', storageKeys)
  collectTemplateReferenceKeys(run.prompt, 'var', variableKeys)
  collectTemplateReferenceKeys(run.prompt, 'storage', storageKeys)
  collectTemplateReferenceKeys(run.command, 'var', variableKeys)
  collectTemplateReferenceKeys(run.command, 'storage', storageKeys)

  if (run.then && typeof run.then === 'object' && run.then.type) {
    collectRunReferenceKeys(run.then, variableKeys, storageKeys)
  }
}

export function collectGraphReferenceCatalog(graph, selectedScreenId = '') {
  const screens = graph?.screens || {}
  const screenIds = Object.keys(screens)
  const inferredVarKeys = new Set()
  const inferredStorageKeys = new Set()
  const selectedScreen = selectedScreenId ? screens[selectedScreenId] : null
  const bindingKeys = new Set(
    selectedScreen?.bindings && typeof selectedScreen.bindings === 'object'
      ? Object.keys(selectedScreen.bindings)
      : []
  )

  screenIds.forEach((screenId) => {
    const screen = screens[screenId]
    if (!screen) {
      return
    }

    collectTemplateReferenceKeys(getDisplayFieldValue(screen, 'title'), 'var', inferredVarKeys)
    collectTemplateReferenceKeys(getDisplayFieldValue(screen, 'title'), 'storage', inferredStorageKeys)
    collectTemplateReferenceKeys(getDisplayFieldValue(screen, 'body'), 'var', inferredVarKeys)
    collectTemplateReferenceKeys(getDisplayFieldValue(screen, 'body'), 'storage', inferredStorageKeys)

    if (screen.bindings && typeof screen.bindings === 'object') {
      Object.values(screen.bindings).forEach((binding) => {
        const source = String(binding?.source || '')
        if (source.startsWith('storage.')) {
          inferredStorageKeys.add(source.slice('storage.'.length))
        }
      })
    }

    ;(screen.items || []).forEach((item) => {
      collectTemplateReferenceKeys(getDisplayFieldValue(item, 'label'), 'var', inferredVarKeys)
      collectTemplateReferenceKeys(getDisplayFieldValue(item, 'label'), 'storage', inferredStorageKeys)
      collectRunReferenceKeys(item?.run, inferredVarKeys, inferredStorageKeys)
    })

    getScreenActions(screen).forEach((action) => {
      collectTemplateReferenceKeys(getDisplayFieldValue(action, 'label'), 'var', inferredVarKeys)
      collectTemplateReferenceKeys(getDisplayFieldValue(action, 'label'), 'storage', inferredStorageKeys)
      collectRunReferenceKeys(action?.run, inferredVarKeys, inferredStorageKeys)
    })

    getScreenHookRuns(screen, 'onEnter').forEach((run) => collectRunReferenceKeys(run, inferredVarKeys, inferredStorageKeys))
    getScreenHookRuns(screen, 'onExit').forEach((run) => collectRunReferenceKeys(run, inferredVarKeys, inferredStorageKeys))
    collectRunReferenceKeys(getScreenTimerRun(screen), inferredVarKeys, inferredStorageKeys)
  })

  const meta = graph?._builderMeta
  const dataItems = Array.isArray(meta?.dataItems) && meta.dataItems.length > 0 ? meta.dataItems : null
  const declaredVariables = dataItems
    ? dataItems.filter((d) => d.scope === 'session').map((d) => ({ key: d.key, defaultValue: d.defaultValue || '', typeHint: d.typeHint || 'string' }))
    : (Array.isArray(meta?.variables) ? meta.variables : [])
  const declaredStorageKeys = dataItems
    ? dataItems.filter((d) => d.scope === 'persistent').map((d) => ({ key: d.key, typeHint: d.typeHint || 'string' }))
    : (Array.isArray(meta?.storageKeys) ? meta.storageKeys : [])
  const declaredDeviceItems = dataItems
    ? dataItems.filter((d) => d.scope === 'device')
    : []
  const declaredVarKeySet = new Set(declaredVariables.map((v) => v.key))
  const declaredStorageKeySet = new Set(declaredStorageKeys.map((s) => s.key))

  const allVarKeys = new Set([...inferredVarKeys, ...declaredVarKeySet])
  const allStorageKeys = new Set([...inferredStorageKeys, ...declaredStorageKeySet])

  const undeclaredVariableKeys = Array.from(inferredVarKeys).filter((k) => !declaredVarKeySet.has(k)).sort()
  const undeclaredStorageKeys = Array.from(inferredStorageKeys).filter((k) => !declaredStorageKeySet.has(k)).sort()

  return {
    screenOptions: screenIds.map((screenId) => {
      const screen = screens[screenId]
      const title = String(screen?.title || '')
      return {
        value: screenId,
        label: title && title !== screenId ? `${screenId} - ${title}` : screenId
      }
    }),
    variableKeys: Array.from(allVarKeys).filter(Boolean).sort(),
    storageKeys: Array.from(allStorageKeys).filter(Boolean).sort(),
    bindingKeys: Array.from(bindingKeys).filter(Boolean).sort(),
    declaredVariables,
    declaredStorageKeys,
    declaredDeviceItems,
    dataItems: dataItems || [],
    undeclaredVariableKeys,
    undeclaredStorageKeys
  }
}

export function inferBuilderMetaFromGraph(graph) {
  const catalog = collectGraphReferenceCatalog(graph, '')
  const variables = catalog.variableKeys.map((key) => ({ key, defaultValue: '', typeHint: 'string' }))
  const storageKeys = catalog.storageKeys.map((key) => ({ key, typeHint: 'string' }))

  const dataItems = [
    ...variables.map((v) => ({ key: v.key, scope: 'session', defaultValue: v.defaultValue, typeHint: v.typeHint })),
    ...storageKeys.map((s) => ({ key: s.key, scope: 'persistent', typeHint: s.typeHint }))
  ]

  const screens = graph?.screens || {}
  Object.values(screens).forEach((screen) => {
    if (screen.bindings && typeof screen.bindings === 'object') {
      Object.entries(screen.bindings).forEach(([alias, binding]) => {
        if (!dataItems.some((d) => d.key === alias && d.scope === 'device')) {
          dataItems.push({
            key: alias,
            scope: 'device',
            source: binding.source || '',
            live: !!binding.live,
            refreshMs: binding.refreshMs || 0
          })
        }
      })
    }
  })

  return { variables, storageKeys, dataItems }
}

export function compileVariableDefaults(graph) {
  const meta = graph?._builderMeta
  const dataItems = Array.isArray(meta?.dataItems) && meta.dataItems.length > 0 ? meta.dataItems : null
  const sessionVars = dataItems
    ? dataItems.filter((d) => d.scope === 'session' && d.key && d.defaultValue !== '' && d.defaultValue != null)
    : (Array.isArray(meta?.variables) ? meta.variables : []).filter((v) => v.key && v.defaultValue !== '' && v.defaultValue != null)

  const deviceItems = dataItems
    ? dataItems.filter((d) => d.scope === 'device' && d.key && d.source)
    : []

  let result = graph

  if (sessionVars.length > 0) {
    const entryId = result.entryScreenId
    const entryScreen = result.screens?.[entryId]
    if (entryScreen) {
      const existingOnEnter = Array.isArray(entryScreen.onEnter) ? entryScreen.onEnter : []
      const existingSetVarKeys = new Set(
        existingOnEnter.filter((r) => r?.type === 'set_var' && r.key).map((r) => r.key)
      )
      const initRuns = sessionVars
        .filter((v) => !existingSetVarKeys.has(v.key))
        .map((v) => ({ type: 'set_var', key: v.key, value: v.defaultValue }))

      if (initRuns.length > 0) {
        result = {
          ...result,
          screens: {
            ...result.screens,
            [entryId]: {
              ...entryScreen,
              onEnter: [...initRuns, ...existingOnEnter]
            }
          }
        }
      }
    }
  }

  if (deviceItems.length > 0) {
    const screens = { ...result.screens }
    const screenIds = Object.keys(screens)

    deviceItems.forEach((item) => {
      const tokenPattern = new RegExp(`\\{\\{\\s*${item.key}[\\.\\s}]`)
      screenIds.forEach((screenId) => {
        const screen = screens[screenId]
        const texts = [
          screen.title, screen.titleTemplate,
          screen.body, screen.bodyTemplate,
          ...(screen.items || []).flatMap((i) => [i.label, i.labelTemplate]),
          ...(Array.isArray(screen.actions) ? screen.actions : []).flatMap((a) => [a.label, a.labelTemplate])
        ].filter(Boolean)

        const usesToken = texts.some((t) => tokenPattern.test(String(t)))
        if (!usesToken) return

        const existingBindings = screen.bindings && typeof screen.bindings === 'object' ? screen.bindings : {}
        if (existingBindings[item.key]) return

        screens[screenId] = {
          ...screen,
          bindings: {
            ...existingBindings,
            [item.key]: {
              source: item.source,
              ...(item.live ? { live: true } : {}),
              ...(item.refreshMs ? { refreshMs: item.refreshMs } : {})
            }
          }
        }
      })
    })

    result = { ...result, screens }
  }

  return result
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
        const target = item.run.type === 'navigate' ? item.run.screen : RUN_TARGETS.find((candidate) => candidate.runType === item.run.type)?.id
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
      const target = action.run.type === 'navigate' ? action.run.screen : RUN_TARGETS.find((candidate) => candidate.runType === action.run.type)?.id
      if (!target) {
        return
      }
      const sourceHandle = isSlotted && action.slot
        ? `slot-${action.slot}`
        : `action-${action.id || index}`
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

    // Lifecycle hooks
    ;['onEnter', 'onExit'].forEach((hookKey) => {
      getScreenHookRuns(screen, hookKey).forEach((run, hookIndex) => {
        if (!run || !isRunConfigured(run)) {
          return
        }
        const target = run.type === 'navigate' ? run.screen : RUN_TARGETS.find((candidate) => candidate.runType === run.type)?.id
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

    // Timer run
    const timerRun = getScreenTimerRun(screen)
    if (timerRun && isRunConfigured(timerRun)) {
      const target = timerRun.type === 'navigate' ? timerRun.screen : RUN_TARGETS.find((candidate) => candidate.runType === timerRun.type)?.id
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

export function buildGraphNodes(graph, previewGraph, positions, selectedId, activeRunTargetIds, runTargetPositions, callbacks = {}) {
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
