import { isRunTargetId } from './constants.js'
export { collectGraphReferenceCatalog, inferBuilderMetaFromGraph, compileVariableDefaults } from './graph-analysis.mjs'
export {
  computeAutoPosition,
  computeRunTargetPosition,
  buildGraphEdges,
  buildGraphNodes
} from './graph-canvas.mjs'
export {
  describeRunTarget,
  getScreenHookRuns,
  getScreenTimerRun,
  isEntityWired,
  isRunConfigured
} from './graph-run-helpers.mjs'
export {
  countUnmappedEntities,
  getRunTargetNodeIdForType,
  getCanvasTargetIdForRun,
  collectRequiredRunTargetIds,
  collectNodeUsages,
  collectRunTargetUsageSummary,
  remapNavigateTargets
} from './graph-usage.mjs'

const CONTENT_TEMPLATE_FIELDS = {
  title: 'titleTemplate',
  body: 'bodyTemplate',
  label: 'labelTemplate'
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
