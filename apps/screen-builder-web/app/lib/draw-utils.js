'use client'

import { constants, motionCompiler } from './constants'
import { ensureUniqueEntityId } from './graph-utils'

export const DRAW_STAGE_WIDTH = 144
export const DRAW_STAGE_HEIGHT = 168

function titleCaseLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export const DRAW_PLAY_MODE_OPTIONS = (motionCompiler.DRAW_PLAY_MODES || []).map((value) => ({
  value,
  label: titleCaseLabel(value)
}))

export const DRAW_BACKGROUND_OPTIONS = (motionCompiler.DRAW_BACKGROUNDS || []).map((value) => ({
  value,
  label: titleCaseLabel(value)
}))

export const DRAW_KIND_OPTIONS = (motionCompiler.DRAW_KINDS || []).map((value) => ({
  value,
  label: titleCaseLabel(value)
}))

export const DRAW_COLOR_OPTIONS = [
  { value: 'ink', label: 'Ink' },
  { value: 'accent', label: 'Mint' },
  { value: 'accent2', label: 'Amber' },
  { value: 'danger', label: 'Danger' }
]

export const MOTION_PRESET_OPTIONS = (motionCompiler.MOTION_PRESETS || []).map((value) => ({
  value,
  label: titleCaseLabel(value)
}))

export const MOTION_SPEED_OPTIONS = (motionCompiler.MOTION_SPEEDS || []).map((value) => ({
  value,
  label: titleCaseLabel(value)
}))

export const MOTION_INTENSITY_OPTIONS = (motionCompiler.MOTION_INTENSITIES || []).map((value) => ({
  value,
  label: titleCaseLabel(value)
}))

export const MOTION_PLACEMENT_OPTIONS = (motionCompiler.MOTION_PLACEMENTS || []).map((value) => ({
  value,
  label: titleCaseLabel(value)
}))

export const CANVAS_TEMPLATE_OPTIONS = (motionCompiler.CANVAS_TEMPLATES || []).map((value) => ({
  value,
  label: titleCaseLabel(value)
}))

const DRAW_PALETTES = {
  grid: {
    stage: '#050505',
    stageSecondary: '#0d0d0f',
    grid: 'rgba(255, 255, 255, 0.08)',
    frame: 'rgba(255, 255, 255, 0.12)'
  },
  dark: {
    stage: '#020202',
    stageSecondary: '#080808',
    grid: 'rgba(255, 255, 255, 0.04)',
    frame: 'rgba(255, 255, 255, 0.12)'
  },
  light: {
    stage: '#f1f1f1',
    stageSecondary: '#e4e4e4',
    grid: 'rgba(8, 8, 8, 0.08)',
    frame: 'rgba(8, 8, 8, 0.14)'
  }
}

const DRAW_COLORS = {
  ink: '#f4f4f5',
  accent: '#7dd3fc',
  accent2: '#fbbf24',
  danger: '#f87171'
}

export function getDrawPalette(background) {
  return DRAW_PALETTES[background] || DRAW_PALETTES.grid
}

export function getDrawColorValue(color, background = 'grid') {
  if (color === 'ink' && background === 'light') {
    return '#111111'
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

export function createDefaultMotionTrack(existingTracks = [], overrides = {}) {
  return motionCompiler.createDefaultMotionTrack(existingTracks, overrides)
}

export function createDefaultMotion(overrides = {}) {
  return motionCompiler.createDefaultMotion(overrides)
}

export function createDefaultCanvas(overrides = {}) {
  return motionCompiler.createDefaultCanvas(overrides)
}

export function createDefaultCanvasMotion(canvas, overrides = {}) {
  return motionCompiler.createDefaultCanvasMotion(canvas, overrides)
}

export function createDefaultDrawing() {
  return motionCompiler.compileMotionToDrawing(createDefaultMotion()).drawing
}

export function compileMotionToDrawing(motion, canvas) {
  return motionCompiler.compileMotionToDrawing(motion, { canvas }).drawing
}

export function normalizeMotion(motion) {
  return motionCompiler.normalizeMotion(motion)
}

export function normalizeCanvas(canvas) {
  return motionCompiler.normalizeCanvas(canvas)
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
  const motion = screen?.motion || {}
  const drawing = screen?.drawing || {}
  const tracks = Array.isArray(motion.tracks) ? motion.tracks : []
  const steps = Array.isArray(drawing.steps) ? drawing.steps : []
  return {
    stepCount: tracks.length || steps.length,
    cycleMs: getDrawCycleMs(drawing),
    playMode: drawing.playMode || 'loop',
    background: drawing.background || 'grid',
    authoringMode: tracks.length > 0 ? 'preset' : 'raw',
    canvasTemplate: screen?.canvas?.template || 'freeform'
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
