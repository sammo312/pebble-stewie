'use client'

import { constants } from './constants'
import { ensureUniqueEntityId } from './graph-utils'

export const DRAW_STAGE_WIDTH = 144
export const DRAW_STAGE_HEIGHT = 168

export const DRAW_PLAY_MODE_OPTIONS = [
  { value: 'loop', label: 'Loop' },
  { value: 'once', label: 'Once' },
  { value: 'ping_pong', label: 'Ping Pong' }
]

export const DRAW_BACKGROUND_OPTIONS = [
  { value: 'grid', label: 'Grid' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' }
]

export const DRAW_KIND_OPTIONS = [
  { value: 'circle', label: 'Circle' },
  { value: 'rect', label: 'Rect' },
  { value: 'text', label: 'Text' }
]

export const DRAW_COLOR_OPTIONS = [
  { value: 'ink', label: 'Ink' },
  { value: 'accent', label: 'Mint' },
  { value: 'accent2', label: 'Amber' },
  { value: 'danger', label: 'Danger' }
]

const DRAW_PALETTES = {
  grid: {
    stage: '#0e1624',
    stageSecondary: '#152033',
    grid: 'rgba(114, 228, 255, 0.16)',
    frame: 'rgba(114, 228, 255, 0.22)'
  },
  dark: {
    stage: '#09111b',
    stageSecondary: '#152033',
    grid: 'rgba(255, 255, 255, 0.06)',
    frame: 'rgba(255, 255, 255, 0.12)'
  },
  light: {
    stage: '#edf4ff',
    stageSecondary: '#dce8fb',
    grid: 'rgba(8, 12, 20, 0.08)',
    frame: 'rgba(8, 12, 20, 0.14)'
  }
}

const DRAW_COLORS = {
  ink: '#eaf2ff',
  accent: '#34c6a7',
  accent2: '#ffb347',
  danger: '#ff6b6b'
}

export function getDrawPalette(background) {
  return DRAW_PALETTES[background] || DRAW_PALETTES.grid
}

export function getDrawColorValue(color, background = 'grid') {
  if (color === 'ink' && background === 'light') {
    return '#142033'
  }
  return DRAW_COLORS[color] || DRAW_COLORS.accent
}

export function createDefaultDrawStep(existingSteps = [], overrides = {}) {
  const index = existingSteps.length + 1
  const stepId = ensureUniqueEntityId(existingSteps, 'step', 'step')
  return {
    id: stepId,
    kind: 'circle',
    label: `Step ${index}`,
    x: 16 + (index - 1) * 12,
    y: 28 + (index - 1) * 18,
    toX: 74,
    toY: 44 + (index - 1) * 16,
    width: 24,
    height: 24,
    delayMs: (index - 1) * 120,
    durationMs: 760,
    fromScale: 0.7,
    toScale: 1,
    fromOpacity: 0.25,
    toOpacity: 1,
    fill: false,
    color: index % 2 === 0 ? 'accent2' : 'accent',
    ...overrides
  }
}

export function createDefaultDrawing() {
  const steps = []
  steps.push(
    createDefaultDrawStep(steps, {
      label: 'Orbit',
      kind: 'circle',
      x: 14,
      y: 24,
      toX: 80,
      toY: 54,
      width: 28,
      height: 28,
      durationMs: 780,
      color: 'accent'
    })
  )
  steps.push(
    createDefaultDrawStep(steps, {
      label: 'Sweep',
      kind: 'rect',
      x: 18,
      y: 96,
      toX: 80,
      toY: 96,
      width: 36,
      height: 12,
      delayMs: 180,
      durationMs: 920,
      fromScale: 0.8,
      color: 'accent2',
      fill: true
    })
  )
  steps.push(
    createDefaultDrawStep(steps, {
      label: 'Hi',
      kind: 'text',
      x: 22,
      y: 146,
      toX: 74,
      toY: 138,
      width: 42,
      height: 16,
      delayMs: 320,
      durationMs: 1080,
      fromScale: 0.8,
      toScale: 1.15,
      color: 'ink',
      fill: true
    })
  )

  return {
    playMode: 'loop',
    background: 'grid',
    timelineMs: 1800,
    steps
  }
}

export function coerceDrawNumber(rawValue, fallback, min, max) {
  const parsed = Number(rawValue)
  let next = Number.isFinite(parsed) ? parsed : fallback
  if (typeof min === 'number') {
    next = Math.max(min, next)
  }
  if (typeof max === 'number') {
    next = Math.min(max, next)
  }
  return next
}

export function getDrawCycleMs(drawing) {
  const steps = Array.isArray(drawing?.steps) ? drawing.steps : []
  const stepEndMs = steps.reduce((max, step) => {
    const stepStart = Number(step?.delayMs || 0)
    const stepDuration = Number(step?.durationMs || 0)
    return Math.max(max, stepStart + stepDuration)
  }, 0)
  const configured = Number(drawing?.timelineMs || 0)
  return Math.max(configured || 0, stepEndMs || 0, 240)
}

export function describeDrawScreen(screen) {
  const drawing = screen?.drawing || {}
  const steps = Array.isArray(drawing.steps) ? drawing.steps : []
  return {
    stepCount: steps.length,
    cycleMs: getDrawCycleMs(drawing),
    playMode: drawing.playMode || 'loop',
    background: drawing.background || 'grid'
  }
}

export function isDrawStepNumericField(fieldId) {
  return [
    'x',
    'y',
    'toX',
    'toY',
    'width',
    'height',
    'delayMs',
    'durationMs',
    'fromScale',
    'toScale',
    'fromOpacity',
    'toOpacity'
  ].includes(fieldId)
}

export function getDrawStepFieldLimit(fieldId) {
  if (fieldId === 'x' || fieldId === 'toX') return { min: 0, max: DRAW_STAGE_WIDTH }
  if (fieldId === 'y' || fieldId === 'toY') return { min: 0, max: DRAW_STAGE_HEIGHT }
  if (fieldId === 'width' || fieldId === 'height') return { min: 4, max: 96 }
  if (fieldId === 'delayMs' || fieldId === 'durationMs') return { min: 0, max: 20000 }
  if (fieldId === 'fromScale' || fieldId === 'toScale') return { min: 0.1, max: 4 }
  if (fieldId === 'fromOpacity' || fieldId === 'toOpacity') return { min: 0.05, max: 1 }
  return { min: undefined, max: undefined }
}

export function clampDrawStepCount(steps) {
  return (steps || []).slice(0, constants.MAX_DRAW_STEPS || 6)
}
