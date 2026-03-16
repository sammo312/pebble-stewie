import { getScreenActions, screenSupportsActions } from './constants'

export const PREVIEW_PLACEHOLDER_ID = '__preview_placeholder__'

const PREVIEW_MISSING = Symbol('preview-missing')

function getNestedPreviewValue(context, path) {
  const parts = String(path || '').split('.')
  let cursor = context
  for (let i = 0; i < parts.length; i += 1) {
    const key = parts[i]
    if (!key) {
      continue
    }
    if (!cursor || typeof cursor !== 'object' || !Object.prototype.hasOwnProperty.call(cursor, key)) {
      return PREVIEW_MISSING
    }
    cursor = cursor[key]
  }

  return cursor
}

function buildPreviewTemplateContext(screen, vars, storage, timer) {
  const now = new Date()
  const context = {
    var: vars || {},
    storage: storage || {},
    timer: timer || { remaining: 0 }
  }
  const bindings = screen?.bindings && typeof screen.bindings === 'object' ? screen.bindings : {}
  Object.entries(bindings).forEach(([bindingKey, binding]) => {
    const source = String(binding?.source || '')
    if (source === 'device.time') {
      context[bindingKey] = {
        localString: now.toLocaleString(),
        localTime: now.toLocaleTimeString(),
        iso: now.toISOString(),
        timestamp: now.getTime()
      }
      return
    }

    if (source.startsWith('storage.')) {
      const storageKey = source.slice('storage.'.length)
      context[bindingKey] = storageKey ? context.storage[storageKey] ?? '' : ''
      return
    }

    context[bindingKey] = ''
  })
  return context
}

function renderPreviewTemplate(template, context) {
  if (template === undefined || template === null) {
    return ''
  }

  return String(template).replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, path) => {
    const value = getNestedPreviewValue(context, String(path || ''))
    if (value === PREVIEW_MISSING) {
      return ''
    }
    return value === undefined || value === null ? '' : String(value)
  })
}

function appendPreviewFooter(body, schemaId) {
  const footer = `dev ${schemaId}`
  return body ? `${body}\n\n${footer}` : footer
}

export function createPreviewRenderScreen(screen, schemaId, vars = {}, storage = {}, timer = { remaining: 0 }) {
  if (!screen) {
    return null
  }

  const context = buildPreviewTemplateContext(screen, vars, storage, timer)
  const rendered = { ...screen }
  if (screen.titleTemplate) {
    rendered.title = renderPreviewTemplate(screen.titleTemplate, context)
  }
  if (screen.bodyTemplate) {
    rendered.body = renderPreviewTemplate(screen.bodyTemplate, context)
  }
  if (Array.isArray(screen.items)) {
    rendered.items = screen.items.map((item) => ({
      ...item,
      label: item.labelTemplate ? renderPreviewTemplate(item.labelTemplate, context) : item.label
    }))
  }
  if (screenSupportsActions(screen)) {
    rendered.actions = getScreenActions(screen).map((action) => ({
      ...action,
      label: action.labelTemplate ? renderPreviewTemplate(action.labelTemplate, context) : action.label
    }))
  }

  return {
    ...rendered,
    body: appendPreviewFooter(rendered.body || '', schemaId)
  }
}

export function renderPreviewValueTemplate(value, screen, vars = {}, storage = {}, timer = { remaining: 0 }) {
  return renderPreviewTemplate(value, buildPreviewTemplateContext(screen, vars, storage, timer))
}

export function createPreviewPlaceholderScreen(run, sourceLabel, returnScreenId, schemaId) {
  const type = run && run.type ? String(run.type) : 'action'
  const title =
    type === 'agent_prompt'
      ? 'Agent Prompt'
      : type === 'agent_command'
        ? 'Agent Command'
        : type === 'effect'
          ? 'Native Effect'
          : 'Action'
  const detail =
    type === 'agent_prompt'
      ? `Prompt:\n${String(run.prompt || '(empty prompt)')}`
      : type === 'agent_command'
        ? `Command:\n${String(run.command || '(empty command)')}`
        : type === 'effect'
          ? `Effect:\n${String(run.vibe || 'no vibration')}${run.light ? ' + light' : ''}`
          : `Unsupported preview action:\n${type}`

  return {
    id: PREVIEW_PLACEHOLDER_ID,
    type: 'card',
    title,
    body: `${sourceLabel}\n\n${detail}`,
    actions: [
      {
        slot: 'select',
        id: 'back',
        icon: 'check',
        label: 'Back',
        value: returnScreenId,
        run: returnScreenId ? { type: 'navigate', screen: returnScreenId } : null
      }
    ]
  }
}

export function getMenuItemFromPreviewAction(action, screen) {
  const items = Array.isArray(screen?.items) ? screen.items : []
  if (action.itemId) {
    const directMatch = items.find((item) => item && item.id === action.itemId)
    if (directMatch) {
      return directMatch
    }
  }

  if (Number.isInteger(action.index) && action.index >= 0 && action.index < items.length) {
    return items[action.index]
  }

  return null
}

export function getMenuActionFromPreviewAction(action, screen) {
  if (Number.isInteger(action?.index) && action.index >= 0) {
    return null
  }

  const actions = getScreenActions(screen)
  if (!action.itemId) {
    return null
  }

  return actions.find((candidate) => candidate && candidate.id === action.itemId) || null
}
