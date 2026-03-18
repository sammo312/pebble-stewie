import { getScreenActions, runtimeValues, screenSupportsActions } from './constants'

export const PREVIEW_PLACEHOLDER_ID = '__preview_placeholder__'

function appendPreviewFooter(body, schemaId) {
  const footer = `dev ${schemaId}`
  return body ? `${body}\n\n${footer}` : footer
}

export function createPreviewRenderScreen(screen, schemaId, vars = {}, storage = {}, timer = { remaining: 0 }) {
  if (!screen) {
    return null
  }

  const context = runtimeValues.buildTemplateContext(screen, { vars, storage, timer })
  const rendered = { ...screen }
  if (screen.titleTemplate) {
    rendered.title = runtimeValues.renderTemplate(screen.titleTemplate, context)
  }
  if (screen.bodyTemplate) {
    rendered.body = runtimeValues.renderTemplate(screen.bodyTemplate, context)
  }
  if (Array.isArray(screen.items)) {
    rendered.items = screen.items.map((item) => ({
      ...item,
      label: item.labelTemplate ? runtimeValues.renderTemplate(item.labelTemplate, context) : item.label
    }))
  }
  if (screenSupportsActions(screen)) {
    rendered.actions = getScreenActions(screen).map((action) => ({
      ...action,
      label: action.labelTemplate ? runtimeValues.renderTemplate(action.labelTemplate, context) : action.label
    }))
  }

  return {
    ...rendered,
    body: appendPreviewFooter(rendered.body || '', schemaId)
  }
}

export function renderPreviewValueTemplate(value, screen, vars = {}, storage = {}, timer = { remaining: 0 }) {
  return runtimeValues.resolveTemplateValue(value, screen, { vars, storage, timer })
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
