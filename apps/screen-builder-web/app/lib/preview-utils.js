import { VOICE_ITEM_IDS } from '../pebble-protocol'
import { getScreenActions, screenSupportsActions } from './constants'

export const PREVIEW_PLACEHOLDER_ID = '__preview_placeholder__'

function appendPreviewFooter(body, schemaId) {
  const footer = `dev ${schemaId}`
  return body ? `${body}\n\n${footer}` : footer
}

export function createPreviewRenderScreen(screen, schemaId) {
  if (!screen) {
    return null
  }

  return {
    ...screen,
    body: appendPreviewFooter(screen.body || '', schemaId)
  }
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

export function createVoicePreviewScreen(action, returnScreenId) {
  let body = 'No transcript captured. Try again.'

  if (action.itemId === VOICE_ITEM_IDS.NOT_SUPPORTED) {
    body = 'Voice dictation is not supported on this watch.'
  } else if (action.itemId === VOICE_ITEM_IDS.ERROR) {
    body = 'Dictation failed. Try again.'
  } else if (action.text) {
    body = `Transcript:\n${action.text}`
  }

  return {
    id: PREVIEW_PLACEHOLDER_ID,
    type: 'card',
    title: 'Voice',
    body,
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
