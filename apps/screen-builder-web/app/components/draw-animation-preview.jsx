'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { Badge } from '@/app/components/ui/badge'
import {
  DRAW_STAGE_HEIGHT,
  DRAW_STAGE_WIDTH,
  describeDrawScreen,
  getDrawColorValue,
  getDrawCycleMs,
  getDrawPalette
} from '@/app/lib/draw-utils'

function lerp(start, end, progress) {
  return start + (end - start) * progress
}

function getPhaseMs(elapsedMs, cycleMs, playMode) {
  if (cycleMs <= 0) {
    return 0
  }

  if (playMode === 'once') {
    return Math.min(elapsedMs, cycleMs)
  }

  if (playMode === 'ping_pong') {
    const full = cycleMs * 2
    const position = elapsedMs % full
    return position <= cycleMs ? position : full - position
  }

  return elapsedMs % cycleMs
}

function getStepState(step, phaseMs) {
  const start = Number(step?.delayMs || 0)
  const duration = Math.max(Number(step?.durationMs || 0), 1)
  const progress =
    phaseMs <= start ? 0 : phaseMs >= start + duration ? 1 : (phaseMs - start) / duration

  return {
    x: lerp(Number(step?.x || 0), Number(step?.toX || step?.x || 0), progress),
    y: lerp(Number(step?.y || 0), Number(step?.toY || step?.y || 0), progress),
    scale: lerp(Number(step?.fromScale || 1), Number(step?.toScale || 1), progress),
    opacity: lerp(Number(step?.fromOpacity || 1), Number(step?.toOpacity || 1), progress)
  }
}

function renderShape(step, state, background) {
  const color = getDrawColorValue(step.color, background)
  const width = Number(step?.width || 24)
  const height = Number(step?.height || 24)

  if (step.kind === 'rect') {
    return (
      <g transform={`translate(${state.x} ${state.y}) scale(${state.scale})`} opacity={state.opacity}>
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          rx={Math.min(8, Math.round(Math.min(width, height) / 3))}
          fill={step.fill ? color : 'transparent'}
          stroke={color}
          strokeWidth="2"
        />
      </g>
    )
  }

  if (step.kind === 'text') {
    return (
      <text
        x={state.x}
        y={state.y}
        fill={color}
        fontSize={Math.max(12, Math.round((height || 18) * state.scale))}
        fontFamily="IBM Plex Mono, monospace"
        fontWeight="600"
        opacity={state.opacity}
      >
        {step.label || 'TXT'}
      </text>
    )
  }

  const radius = Math.max(6, Math.round(Math.min(width, height) / 2))
  return (
    <circle
      cx={state.x + radius}
      cy={state.y + radius}
      r={radius * state.scale}
      fill={step.fill ? color : 'transparent'}
      stroke={color}
      strokeWidth="2"
      opacity={state.opacity}
    />
  )
}

export default function DrawAnimationPreview({ screen, compact = false }) {
  const drawing = screen?.drawing
  const [elapsedMs, setElapsedMs] = useState(0)
  const patternId = useId().replace(/:/g, '_')
  const cycleMs = useMemo(() => getDrawCycleMs(drawing), [drawing])
  const phaseMs = getPhaseMs(elapsedMs, cycleMs, drawing?.playMode || 'loop')
  const summary = describeDrawScreen(screen)
  const palette = getDrawPalette(drawing?.background || 'grid')

  useEffect(() => {
    let frameId = 0
    const start = performance.now()

    const tick = (now) => {
      setElapsedMs(now - start)
      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [cycleMs, drawing?.background, drawing?.playMode, drawing?.steps])

  if (!drawing) {
    return null
  }

  return (
    <div className={`draw-preview-shell ${compact ? 'draw-preview-shell-compact' : ''}`}>
      <div className="draw-preview-head">
        <div className="draw-preview-meta">
          <span>draw</span>
          <span>{summary.stepCount} {summary.authoringMode === 'preset' ? 'track' : 'step'}{summary.stepCount === 1 ? '' : 's'}</span>
        </div>
        {!compact ? (
          <div className="draw-preview-badges">
            <Badge variant="outline" className="h-4 border-line bg-black px-1 text-[9px] text-ink-dim">
              {summary.authoringMode}
            </Badge>
            <Badge variant="outline" className="h-4 border-line bg-black px-1 text-[9px] text-ink-dim">
              {summary.playMode}
            </Badge>
            <Badge variant="outline" className="h-4 border-line bg-black px-1 text-[9px] text-ink-dim">
              {summary.cycleMs}ms
            </Badge>
          </div>
        ) : null}
      </div>

      <div className="draw-stage-frame" style={{ background: `linear-gradient(180deg, ${palette.stageSecondary}, ${palette.stage})` }}>
        <svg
          viewBox={`0 0 ${DRAW_STAGE_WIDTH} ${DRAW_STAGE_HEIGHT}`}
          className={`draw-stage-svg draw-stage-${drawing.background || 'grid'}`}
        >
          <defs>
            <pattern id={patternId} width="12" height="12" patternUnits="userSpaceOnUse">
              <path d="M 12 0 L 0 0 0 12" fill="none" stroke={palette.grid} strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={DRAW_STAGE_WIDTH} height={DRAW_STAGE_HEIGHT} fill={palette.stage} />
          {(drawing.background || 'grid') === 'grid' && (
            <rect width={DRAW_STAGE_WIDTH} height={DRAW_STAGE_HEIGHT} fill={`url(#${patternId})`} />
          )}

          {(drawing.steps || []).map((step, index) => {
            const state = getStepState(step, phaseMs)
            const guideColor = getDrawColorValue(step.color, drawing.background)
            return (
              <g key={`${step.id || 'step'}-${index}`}>
                {!compact ? (
                  <line
                    x1={Number(step.x || 0)}
                    y1={Number(step.y || 0)}
                    x2={Number(step.toX || step.x || 0)}
                    y2={Number(step.toY || step.y || 0)}
                    stroke={guideColor}
                    strokeOpacity="0.28"
                    strokeDasharray="4 4"
                  />
                ) : null}
                {renderShape(step, state, drawing.background)}
              </g>
            )
          })}
        </svg>
      </div>

      {!compact ? (
        <div className="draw-step-legend">
          {(drawing.steps || []).map((step, index) => (
            <div className="draw-step-pill" key={`${step.id || 'step'}-legend-${index}`}>
              <span className="draw-step-dot" style={{ background: getDrawColorValue(step.color, drawing.background) }} />
              <span>{step.label || step.id || `Step ${index + 1}`}</span>
              <span className="draw-step-meta">{step.kind} · {step.durationMs}ms</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
