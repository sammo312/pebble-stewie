'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/app/components/ui/select'
import DrawAnimationPreview from '@/app/components/draw-animation-preview'
import {
  CANVAS_TEMPLATE_OPTIONS,
  DRAW_BACKGROUND_OPTIONS,
  DRAW_COLOR_OPTIONS,
  DRAW_KIND_OPTIONS,
  DRAW_PLAY_MODE_OPTIONS,
  MOTION_INTENSITY_OPTIONS,
  MOTION_PLACEMENT_OPTIONS,
  MOTION_PRESET_OPTIONS,
  MOTION_SPEED_OPTIONS
} from '@/app/lib/draw-utils'
import { ChevronDown, ChevronRight, Plus, Sparkles, Wand2, X } from 'lucide-react'

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

function SelectField({ label, value, options, onChange }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="field-input h-9 w-full border-line bg-black text-left text-xs text-ink">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-line bg-panel text-ink">
          {options.map((option) => (
            <SelectItem value={option.value} key={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function RawStepEditor({ steps, removeDrawStep, updateDrawStep }) {
  return (
    <>
      {steps.map((step, index) => (
        <div className="list-card" key={`${step.id || 'step'}-${index}`}>
          <div className="list-card-head">
            <div className="flex items-center gap-2">
              <strong className="text-xs">{step.label || `Step ${index + 1}`}</strong>
              <Badge variant="outline" className="h-4 border-line px-1 text-[9px] text-ink-dim">
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

            <SelectField
              label="Shape"
              value={step.kind || 'circle'}
              options={DRAW_KIND_OPTIONS}
              onChange={(value) => updateDrawStep(index, 'kind', value)}
            />

            <SelectField
              label="Color"
              value={step.color || 'accent'}
              options={DRAW_COLOR_OPTIONS}
              onChange={(value) => updateDrawStep(index, 'color', value)}
            />

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
    </>
  )
}

function CompiledStepSummary({ steps }) {
  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <div className="list-card" key={`${step.id || 'compiled'}-${index}`}>
          <div className="list-card-head">
            <strong className="text-xs">{step.label || `Step ${index + 1}`}</strong>
            <Badge variant="outline" className="h-4 border-line px-1 text-[9px] text-ink-dim">
              {step.kind}
            </Badge>
          </div>
          <div className="text-[11px] leading-5 text-ink-dim">
            {`start ${step.x},${step.y} -> ${step.toX},${step.toY} · ${step.durationMs}ms · ${step.color}`}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function DrawAnimationInspector({
  screen,
  maxDrawSteps,
  updateCanvasTemplate,
  updateCanvasHeader,
  addCanvasItem,
  removeCanvasItem,
  updateCanvasItem,
  updateMotionField,
  addMotionTrack,
  removeMotionTrack,
  updateMotionTrack,
  detachMotionToRaw,
  enablePresetMotion,
  updateDrawField,
  addDrawStep,
  removeDrawStep,
  updateDrawStep
}) {
  const motion = screen?.motion || null
  const canvas = screen?.canvas || { template: 'freeform' }
  const drawing = screen?.drawing || { steps: [] }
  const tracks = Array.isArray(motion?.tracks) ? motion.tracks : []
  const steps = Array.isArray(drawing.steps) ? drawing.steps : []
  const isPresetMode = tracks.length > 0
  const isHeaderList = canvas.template === 'header_list'
  const [advancedOpen, setAdvancedOpen] = useState(!isPresetMode)
  const stepLimit = maxDrawSteps || 6
  const canvasTargetOptions = useMemo(() => {
    const options = [{ value: 'freeform', label: 'Freeform Stage' }]
    if (isHeaderList) {
      options.splice(0, 1, { value: 'header', label: 'Header' }, { value: 'items', label: 'All Items' })
      ;(canvas.items || []).forEach((item) => {
        options.push({ value: item.id, label: `Item: ${item.label}` })
      })
    }
    return options
  }, [canvas.items, isHeaderList])

  useEffect(() => {
    setAdvancedOpen(!isPresetMode)
  }, [isPresetMode, screen?.id])

  const stageField = useMemo(() => {
    if (isPresetMode) {
      return {
        playMode: motion.playMode || 'ping_pong',
        background: motion.background || 'grid',
        timelineMs: motion.timelineMs || 1800
      }
    }
    return {
      playMode: drawing.playMode || 'loop',
      background: drawing.background || 'grid',
      timelineMs: drawing.timelineMs || 1800
    }
  }, [drawing.background, drawing.playMode, drawing.timelineMs, isPresetMode, motion])

  return (
    <div className="space-y-3">
      <div className="draw-note">
        {isPresetMode
          ? 'Compose the custom draw screen here and animate named elements. The watch still renders compiled native draw steps underneath.'
          : 'This screen is in advanced raw mode. You are editing the native draw timeline directly.'}
      </div>

      <DrawAnimationPreview screen={screen} />

      {isPresetMode ? (
        <div className="space-y-3 border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.12em] text-ink-dim">Canvas</span>
            <Badge variant="outline" className="h-4 border-line px-1 text-[9px] text-ink-dim">
              {canvas.template}
            </Badge>
          </div>

          <div className="field-grid">
            <SelectField
              label="Template"
              value={canvas.template || 'freeform'}
              options={CANVAS_TEMPLATE_OPTIONS}
              onChange={updateCanvasTemplate}
            />
          </div>

          {isHeaderList ? (
            <>
              <div>
                <label className="field-label">Header</label>
                <input
                  className="field-input"
                  value={canvas.header || ''}
                  onChange={(event) => updateCanvasHeader(event.target.value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-[0.12em] text-ink-dim">Menu Items</span>
                  <Badge variant="outline" className="h-4 border-line px-1 text-[9px] text-ink-dim">
                    {(canvas.items || []).length}/4
                  </Badge>
                </div>
                <Button size="xs" onClick={addCanvasItem}>
                  <Plus className="size-3" /> Add Item
                </Button>
              </div>

              {(canvas.items || []).map((item, index) => (
                <div className="list-card" key={item.id || `item-${index}`}>
                  <div className="list-card-head">
                    <strong className="text-xs">{item.id}</strong>
                    <Button size="xs" variant="ghost" onClick={() => removeCanvasItem(index)}>
                      <X className="size-3" />
                    </Button>
                  </div>
                  <input
                    className="field-input"
                    value={item.label || ''}
                    onChange={(event) => updateCanvasItem(index, event.target.value)}
                  />
                </div>
              ))}
            </>
          ) : null}
        </div>
      ) : null}

      <div className="field-grid">
        <SelectField
          label="Playback"
          value={stageField.playMode}
          options={DRAW_PLAY_MODE_OPTIONS}
          onChange={(value) => (isPresetMode ? updateMotionField('playMode', value) : updateDrawField('playMode', value))}
        />

        <SelectField
          label="Stage"
          value={stageField.background}
          options={DRAW_BACKGROUND_OPTIONS}
          onChange={(value) => (isPresetMode ? updateMotionField('background', value) : updateDrawField('background', value))}
        />

        <NumberField
          label="Timeline (ms)"
          value={stageField.timelineMs}
          onChange={(value) => (isPresetMode ? updateMotionField('timelineMs', value) : updateDrawField('timelineMs', value))}
        />
      </div>

      {isPresetMode ? (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.12em] text-ink-dim">Motion Tracks</span>
              <Badge variant="outline" className="h-4 border-line px-1 text-[9px] text-ink-dim">
                {tracks.length}/{stepLimit}
              </Badge>
            </div>
            <Button size="xs" onClick={addMotionTrack}>
              <Plus className="size-3" /> Add Track
            </Button>
          </div>

          {tracks.map((track, index) => (
            <div className="list-card" key={`${track.id || 'track'}-${index}`}>
              <div className="list-card-head">
                <div className="flex items-center gap-2">
                  <strong className="text-xs">{track.label || `Track ${index + 1}`}</strong>
                  <Badge variant="outline" className="h-4 border-line px-1 text-[9px] text-ink-dim">
                    {track.preset}
                  </Badge>
                </div>
                <Button size="xs" variant="ghost" onClick={() => removeMotionTrack(index)}>
                  <X className="size-3" />
                </Button>
              </div>

              <div className="field-grid compact">
                <div>
                  <label className="field-label">Track ID</label>
                  <input
                    className="field-input"
                    value={track.id || ''}
                    onChange={(event) => updateMotionTrack(index, 'id', event.target.value)}
                  />
                </div>

                <div>
                  <label className="field-label">Label</label>
                  <input
                    className="field-input"
                    value={track.label || ''}
                    onChange={(event) => updateMotionTrack(index, 'label', event.target.value)}
                  />
                </div>

                <SelectField
                  label="Preset"
                  value={track.preset || 'fade'}
                  options={MOTION_PRESET_OPTIONS}
                  onChange={(value) => updateMotionTrack(index, 'preset', value)}
                />

                {isHeaderList ? (
                  <SelectField
                    label="Target"
                    value={track.target || 'items'}
                    options={canvasTargetOptions}
                    onChange={(value) => updateMotionTrack(index, 'target', value)}
                  />
                ) : (
                  <>
                    <SelectField
                      label="Element"
                      value={track.kind || 'circle'}
                      options={DRAW_KIND_OPTIONS}
                      onChange={(value) => updateMotionTrack(index, 'kind', value)}
                    />

                    <SelectField
                      label="Placement"
                      value={track.placement || 'middle'}
                      options={MOTION_PLACEMENT_OPTIONS}
                      onChange={(value) => updateMotionTrack(index, 'placement', value)}
                    />
                  </>
                )}

                <SelectField
                  label="Color"
                  value={track.color || 'accent'}
                  options={DRAW_COLOR_OPTIONS}
                  onChange={(value) => updateMotionTrack(index, 'color', value)}
                />

                <SelectField
                  label="Speed"
                  value={track.speed || 'normal'}
                  options={MOTION_SPEED_OPTIONS}
                  onChange={(value) => updateMotionTrack(index, 'speed', value)}
                />

                <SelectField
                  label="Intensity"
                  value={track.intensity || 'medium'}
                  options={MOTION_INTENSITY_OPTIONS}
                  onChange={(value) => updateMotionTrack(index, 'intensity', value)}
                />

                <NumberField
                  label="Delay (ms)"
                  value={track.delayMs || 0}
                  onChange={(value) => updateMotionTrack(index, 'delayMs', value)}
                />

                {isHeaderList ? (
                  <NumberField
                    label="Stagger (ms)"
                    value={track.staggerMs || 0}
                    onChange={(value) => updateMotionTrack(index, 'staggerMs', value)}
                  />
                ) : null}

                {!isHeaderList ? (
                  <div className="col-span-2">
                    <label className="draw-checkbox">
                      <input
                        type="checkbox"
                        checked={!!track.fill}
                        onChange={(event) => updateMotionTrack(index, 'fill', event.target.checked)}
                      />
                      Filled element
                    </label>
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          <div className="border-t border-line pt-2">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() => setAdvancedOpen((open) => !open)}
            >
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-ink-dim">
                <Wand2 className="size-3.5" />
                <span>Advanced Raw Steps</span>
              </div>
              {advancedOpen ? <ChevronDown className="size-3 text-ink-dim" /> : <ChevronRight className="size-3 text-ink-dim" />}
            </button>

            {advancedOpen ? (
              <div className="mt-3 space-y-3">
                <div className="draw-note">
                  These raw steps are compiled from the preset tracks above. Switch to raw mode only if you want to stop using presets for this screen.
                </div>
                <CompiledStepSummary steps={steps} />
                <Button size="xs" variant="outline" onClick={detachMotionToRaw}>
                  <Sparkles className="size-3" /> Switch To Raw Editing
                </Button>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.12em] text-ink-dim">Raw Motion Steps</span>
              <Badge variant="outline" className="h-4 border-line px-1 text-[9px] text-ink-dim">
                {steps.length}/{stepLimit}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button size="xs" variant="outline" onClick={enablePresetMotion}>
                <Sparkles className="size-3" /> Use Presets
              </Button>
              <Button size="xs" onClick={addDrawStep}>
                <Plus className="size-3" /> Add Raw Step
              </Button>
            </div>
          </div>

          <RawStepEditor
            steps={steps}
            removeDrawStep={removeDrawStep}
            updateDrawStep={updateDrawStep}
          />
        </>
      )}
    </div>
  )
}
