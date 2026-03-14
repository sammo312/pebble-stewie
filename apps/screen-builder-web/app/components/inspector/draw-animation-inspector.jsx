'use client'

import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import DrawAnimationPreview from '@/app/components/draw-animation-preview'
import {
  DRAW_BACKGROUND_OPTIONS,
  DRAW_COLOR_OPTIONS,
  DRAW_KIND_OPTIONS,
  DRAW_PLAY_MODE_OPTIONS
} from '@/app/lib/draw-utils'
import { Plus, X } from 'lucide-react'

function NumberField({ label, value, onChange, step = '1' }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input
        className="field-input"
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

export default function DrawAnimationInspector({
  screen,
  maxDrawSteps,
  updateDrawField,
  addDrawStep,
  removeDrawStep,
  updateDrawStep
}) {
  const drawing = screen?.drawing || { steps: [] }
  const steps = Array.isArray(drawing.steps) ? drawing.steps : []

  return (
    <div className="space-y-3">
      <div className="draw-note">
        Author animated Pebble graphics as timeline steps. The watch runtime now renders this as a custom draw layer, while this inline stage stays useful for fast editing.
      </div>

      <DrawAnimationPreview screen={screen} compact />

      <div className="field-grid">
        <div>
          <label className="field-label">Playback</label>
          <select
            className="field-input"
            value={drawing.playMode || 'loop'}
            onChange={(event) => updateDrawField('playMode', event.target.value)}
          >
            {DRAW_PLAY_MODE_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">Stage</label>
          <select
            className="field-input"
            value={drawing.background || 'grid'}
            onChange={(event) => updateDrawField('background', event.target.value)}
          >
            {DRAW_BACKGROUND_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <NumberField
          label="Timeline (ms)"
          value={drawing.timelineMs || 1800}
          onChange={(value) => updateDrawField('timelineMs', value)}
        />

        <div>
          <label className="field-label">Pebble Mapping</label>
          <div className="draw-note">
            Use step labels like draw-command group names. Motion paths stand in for `GRect` transforms, and `text` blocks approximate label overlays.
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.12em] text-ink-dim">Motion Steps</span>
          <Badge variant="outline" className="text-[9px] h-4 border-line text-ink-dim px-1">
            {steps.length}/{maxDrawSteps}
          </Badge>
        </div>
        <Button size="xs" onClick={addDrawStep}>
          <Plus className="size-3" /> Add Motion Step
        </Button>
      </div>

      {steps.map((step, index) => (
        <div className="list-card" key={`${step.id || 'step'}-${index}`}>
          <div className="list-card-head">
            <div className="flex items-center gap-2">
              <strong className="text-xs">{step.label || `Step ${index + 1}`}</strong>
              <Badge variant="outline" className="text-[9px] h-4 border-line text-ink-dim px-1">
                {step.kind}
              </Badge>
            </div>
            <Button size="xs" variant="ghost" onClick={() => removeDrawStep(index)}>
              <X className="size-3" />
            </Button>
          </div>

          <div className="field-grid compact">
            <div>
              <label className="field-label">Step ID</label>
              <input
                className="field-input"
                value={step.id || ''}
                onChange={(event) => updateDrawStep(index, 'id', event.target.value)}
              />
            </div>

            <div>
              <label className="field-label">Label</label>
              <input
                className="field-input"
                value={step.label || ''}
                onChange={(event) => updateDrawStep(index, 'label', event.target.value)}
              />
            </div>

            <div>
              <label className="field-label">Shape</label>
              <select
                className="field-input"
                value={step.kind || 'circle'}
                onChange={(event) => updateDrawStep(index, 'kind', event.target.value)}
              >
                {DRAW_KIND_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">Color</label>
              <select
                className="field-input"
                value={step.color || 'accent'}
                onChange={(event) => updateDrawStep(index, 'color', event.target.value)}
              >
                {DRAW_COLOR_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <NumberField label="Start X" value={step.x} onChange={(value) => updateDrawStep(index, 'x', value)} />
            <NumberField label="Start Y" value={step.y} onChange={(value) => updateDrawStep(index, 'y', value)} />
            <NumberField label="End X" value={step.toX} onChange={(value) => updateDrawStep(index, 'toX', value)} />
            <NumberField label="End Y" value={step.toY} onChange={(value) => updateDrawStep(index, 'toY', value)} />
            <NumberField label="Width" value={step.width} onChange={(value) => updateDrawStep(index, 'width', value)} />
            <NumberField label="Height" value={step.height} onChange={(value) => updateDrawStep(index, 'height', value)} />
            <NumberField label="Delay (ms)" value={step.delayMs} onChange={(value) => updateDrawStep(index, 'delayMs', value)} />
            <NumberField label="Duration (ms)" value={step.durationMs} onChange={(value) => updateDrawStep(index, 'durationMs', value)} />
            <NumberField label="From Scale" value={step.fromScale} step="0.05" onChange={(value) => updateDrawStep(index, 'fromScale', value)} />
            <NumberField label="To Scale" value={step.toScale} step="0.05" onChange={(value) => updateDrawStep(index, 'toScale', value)} />
            <NumberField label="From Opacity" value={step.fromOpacity} step="0.05" onChange={(value) => updateDrawStep(index, 'fromOpacity', value)} />
            <NumberField label="To Opacity" value={step.toOpacity} step="0.05" onChange={(value) => updateDrawStep(index, 'toOpacity', value)} />

            <div className="col-span-2">
              <label className="draw-checkbox">
                <input
                  type="checkbox"
                  checked={!!step.fill}
                  onChange={(event) => updateDrawStep(index, 'fill', event.target.checked)}
                />
                Filled shape
              </label>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
