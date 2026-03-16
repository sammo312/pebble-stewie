'use client'

import { useMemo } from 'react'
import { inferIntentFromRun, compileIntentToRun, getIntentOptionsForSchema } from '@/app/lib/action-intents'
import { schemaRegistry, FIELD_DESCRIPTIONS } from '@/app/lib/constants'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/app/components/ui/select'
import InfoPopover from '@/app/components/ui/info-popover'

const NONE_VALUE = '__none__'

function IntentSelect({ intentId, options, onChange }) {
  return (
    <div className="field-shell">
      <div className="field-label">
        <span>Action</span>
        <InfoPopover
          title="Action"
          description="What happens when this item is tapped."
        />
      </div>
      <Select
        value={intentId || NONE_VALUE}
        onValueChange={(v) => onChange(v === NONE_VALUE ? '' : v)}
      >
        <SelectTrigger className="field-input h-auto w-full border-line text-left text-xs">
          <SelectValue placeholder="Choose action" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE} className="text-xs text-ink-dim">None</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function VariableKeyInput({ value, options, onChange, label = 'Variable' }) {
  return (
    <div className="field-shell">
      <div className="field-label"><span>{label}</span></div>
      <input
        className="field-input"
        value={value || ''}
        placeholder={`${label.toLowerCase()} name`}
        onChange={(e) => onChange(e.target.value)}
      />
      {options.length > 0 && (
        <div className="field-assist-row">
          {options.map((opt) => (
            <button
              key={opt.value || opt}
              type="button"
              className="token-chip"
              onClick={() => onChange(opt.value || opt)}
            >
              {opt.label || opt.value || opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ScreenSelect({ value, options, onChange }) {
  return (
    <div className="field-shell">
      <div className="field-label">
        <span>Go To Screen</span>
        <InfoPopover title="Go To Screen" description={FIELD_DESCRIPTIONS['run.screen']} />
      </div>
      <Select
        value={value || NONE_VALUE}
        onValueChange={(v) => onChange(v === NONE_VALUE ? '' : v)}
      >
        <SelectTrigger className="field-input h-auto w-full border-line text-left text-xs">
          <SelectValue placeholder="Select screen" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE} className="text-xs text-ink-dim">Select...</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function TextInput({ value, onChange, label, placeholder, description }) {
  return (
    <div className="field-shell">
      <div className="field-label">
        <span>{label}</span>
        {description && <InfoPopover title={label} description={description} />}
      </div>
      <input
        className="field-input"
        value={value || ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function ConditionGroup({ condition, variableOptions, onChange }) {
  const condVar = condition?.var || ''
  const condOp = condition?.op || ''
  const condValue = condition?.value || ''

  function update(field, value) {
    onChange({ ...condition, [field]: value })
  }

  return (
    <div className="field-shell">
      <div className="field-label">
        <span>Condition</span>
        <InfoPopover title="Condition" description="Only navigate when this variable passes the check." />
      </div>
      <div className="flex items-center gap-1.5">
        <input
          className="field-input flex-1"
          value={condVar}
          placeholder="var"
          onChange={(e) => update('var', e.target.value)}
        />
        <Select value={condOp || NONE_VALUE} onValueChange={(v) => update('op', v === NONE_VALUE ? '' : v)}>
          <SelectTrigger className="field-input h-auto w-16 border-line text-left text-xs">
            <SelectValue placeholder="op" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE} className="text-xs text-ink-dim">-</SelectItem>
            {['eq', 'neq', 'gt', 'gte', 'lt', 'lte'].map((op) => (
              <SelectItem key={op} value={op} className="text-xs">{op}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          className="field-input w-16"
          value={condValue}
          placeholder="val"
          onChange={(e) => update('value', e.target.value)}
        />
      </div>
      {variableOptions.length > 0 && (
        <div className="field-assist-row">
          {variableOptions.slice(0, 6).map((opt) => (
            <button
              key={opt.value || opt}
              type="button"
              className="token-chip"
              onClick={() => update('var', opt.value || opt)}
            >
              {opt.label || opt.value || opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const DICTATION_THEN_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'navigate', label: 'Go To Screen' },
  { value: 'agent_prompt', label: 'Ask Agent' }
]

function DictationFields({ params, variableOptions, screenOptions, onParamChange }) {
  const thenRun = params.then || {}
  const thenType = thenRun.type || ''
  const varName = params.variable || ''

  function updateThen(nextThen) {
    onParamChange('then', nextThen && nextThen.type ? nextThen : null)
  }

  function handleThenTypeChange(type) {
    if (!type) {
      updateThen(null)
      onParamChange('screen', '')
      return
    }
    if (type === 'navigate') {
      updateThen(null)
      // Use the screen field (navigate after dictation is the default behavior)
      return
    }
    if (type === 'agent_prompt') {
      onParamChange('screen', '')
      updateThen({
        type: 'agent_prompt',
        prompt: varName ? `{{var.${varName}}}` : ''
      })
    }
  }

  // Determine the effective "then" mode from the run state
  const effectiveThenType = thenType === 'agent_prompt' ? 'agent_prompt' : params.screen ? 'navigate' : ''

  return (
    <>
      <VariableKeyInput
        value={varName}
        options={variableOptions}
        label="Store Transcript In"
        onChange={(v) => {
          onParamChange('variable', v)
          // Auto-update agent prompt template if then is agent_prompt
          if (thenType === 'agent_prompt' && v) {
            updateThen({ ...thenRun, prompt: `{{var.${v}}}` })
          }
        }}
      />
      <div className="field-shell">
        <div className="field-label">
          <span>Then</span>
          <InfoPopover
            title="Then"
            description="What to do after dictation completes. Navigate sends the user to a screen. Ask Agent sends the transcript to the AI agent."
          />
        </div>
        <Select
          value={effectiveThenType || NONE_VALUE}
          onValueChange={(v) => handleThenTypeChange(v === NONE_VALUE ? '' : v)}
        >
          <SelectTrigger className="field-input h-auto w-full border-line text-left text-xs">
            <SelectValue placeholder="Choose..." />
          </SelectTrigger>
          <SelectContent>
            {DICTATION_THEN_OPTIONS.map((opt) => (
              <SelectItem key={opt.value || NONE_VALUE} value={opt.value || NONE_VALUE} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {effectiveThenType === 'navigate' && (
        <ScreenSelect
          value={params.screen || ''}
          options={screenOptions}
          onChange={(v) => onParamChange('screen', v)}
        />
      )}
      {effectiveThenType === 'agent_prompt' && (
        <TextInput
          value={thenRun.prompt || ''}
          label="Agent Prompt"
          placeholder="{{var.transcript}}"
          description="The prompt sent to the agent. Use {{var.NAME}} to include the transcript."
          onChange={(v) => updateThen({ ...thenRun, type: 'agent_prompt', prompt: v })}
        />
      )}
    </>
  )
}

function VibeSelect({ value, vibeOptions, onChange }) {
  return (
    <div className="field-shell">
      <div className="field-label"><span>Vibration</span></div>
      <Select value={value || NONE_VALUE} onValueChange={(v) => onChange(v === NONE_VALUE ? '' : v)}>
        <SelectTrigger className="field-input h-auto w-full border-line text-left text-xs">
          <SelectValue placeholder="None" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE} className="text-xs text-ink-dim">None</SelectItem>
          {vibeOptions.map((v) => (
            <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default function IntentActionEditor({
  entity,
  index,
  updateFn,
  schemaVersion,
  graphReferenceCatalog = {},
  currentScreen
}) {
  const run = entity?.run || {}
  const { intentId, params } = useMemo(() => inferIntentFromRun(run), [run])

  const descriptor = useMemo(() => schemaRegistry.getSchemaDescriptor(schemaVersion), [schemaVersion])
  const intentOptions = useMemo(() => getIntentOptionsForSchema(descriptor), [descriptor])
  const vibeTypes = descriptor?.enums?.vibeTypes || []

  const variableOptions = (graphReferenceCatalog.variableKeys || []).map((k) => ({ value: k, label: k }))
  const storageOptions = (graphReferenceCatalog.storageKeys || []).map((k) => ({ value: k, label: k }))
  const screenOptions = graphReferenceCatalog.screenOptions || []

  function applyRun(nextRun) {
    if (!nextRun.type) {
      updateFn(index, { id: 'run.type', type: 'enum' }, '')
      return
    }
    updateFn(index, { id: 'run.type', type: 'enum' }, nextRun.type)

    if (nextRun.screen !== undefined) {
      updateFn(index, { id: 'run.screen', type: 'text' }, nextRun.screen)
    }
    if (nextRun.key !== undefined) {
      updateFn(index, { id: 'run.key', type: 'text' }, nextRun.key)
    }
    if (nextRun.value !== undefined) {
      updateFn(index, { id: 'run.value', type: 'text' }, nextRun.value)
    }
    if (nextRun.prompt !== undefined) {
      updateFn(index, { id: 'run.prompt', type: 'text' }, nextRun.prompt)
    }
    if (nextRun.command !== undefined) {
      updateFn(index, { id: 'run.command', type: 'text' }, nextRun.command)
    }
    if (nextRun.variable !== undefined) {
      updateFn(index, { id: 'run.variable', type: 'text' }, nextRun.variable)
    }
    if (nextRun.then !== undefined) {
      updateFn(index, { id: 'run.then', type: 'object' }, nextRun.then)
    }
    if (nextRun.vibe !== undefined) {
      updateFn(index, { id: 'run.vibe', type: 'enum' }, nextRun.vibe)
    }
    if (nextRun.light !== undefined) {
      updateFn(index, { id: 'run.light', type: 'boolean' }, nextRun.light)
    }
    if (nextRun.condition !== undefined) {
      if (nextRun.condition?.var) updateFn(index, { id: 'run.condition.var', type: 'text' }, nextRun.condition.var)
      if (nextRun.condition?.op) updateFn(index, { id: 'run.condition.op', type: 'enum' }, nextRun.condition.op)
      if (nextRun.condition?.value !== undefined) updateFn(index, { id: 'run.condition.value', type: 'text' }, nextRun.condition.value)
    }
  }

  function handleIntentChange(newIntentId) {
    if (!newIntentId) {
      applyRun({})
      return
    }
    const nextRun = compileIntentToRun(newIntentId, params, run)
    applyRun(nextRun)
  }

  function handleParamChange(paramKey, paramValue) {
    const nextParams = { ...params, [paramKey]: paramValue }
    const nextRun = compileIntentToRun(intentId, nextParams, run)
    applyRun(nextRun)
  }

  return (
    <div className="col-span-2 space-y-2">
      <IntentSelect
        intentId={intentId}
        options={intentOptions}
        onChange={handleIntentChange}
      />

      {intentId === 'navigate' && (
        <>
          <ScreenSelect
            value={params.screen || ''}
            options={screenOptions}
            onChange={(v) => handleParamChange('screen', v)}
          />
          <ConditionGroup
            condition={params.condition}
            variableOptions={variableOptions}
            onChange={(c) => handleParamChange('condition', c)}
          />
        </>
      )}

      {(intentId === 'increment' || intentId === 'decrement' || intentId === 'toggle') && (
        <VariableKeyInput
          value={params.variableKey || ''}
          options={variableOptions}
          onChange={(v) => handleParamChange('variableKey', v)}
        />
      )}

      {intentId === 'set_to' && (
        <>
          <VariableKeyInput
            value={params.variableKey || ''}
            options={variableOptions}
            onChange={(v) => handleParamChange('variableKey', v)}
          />
          <TextInput
            value={params.literalValue || ''}
            label="Value"
            placeholder="true, 42, literal:text..."
            description={FIELD_DESCRIPTIONS['run.value']}
            onChange={(v) => handleParamChange('literalValue', v)}
          />
        </>
      )}

      {intentId === 'store' && (
        <>
          <VariableKeyInput
            value={params.storageKey || ''}
            options={storageOptions}
            label="Storage Key"
            onChange={(v) => handleParamChange('storageKey', v)}
          />
          <TextInput
            value={params.valueTemplate || ''}
            label="Value"
            placeholder="{{var.counter}} or literal text"
            description={FIELD_DESCRIPTIONS['run.value']}
            onChange={(v) => handleParamChange('valueTemplate', v)}
          />
        </>
      )}

      {intentId === 'effect' && (
        <>
          <VibeSelect
            value={params.vibe || ''}
            vibeOptions={vibeTypes}
            onChange={(v) => handleParamChange('vibe', v)}
          />
          <div className="field-shell">
            <label className="field-boolean">
              <span className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!params.light}
                  onChange={(e) => handleParamChange('light', e.target.checked)}
                />
                Flash Backlight
              </span>
            </label>
          </div>
        </>
      )}

      {intentId === 'agent_prompt' && (
        <TextInput
          value={params.prompt || ''}
          label="Prompt"
          placeholder="What should the agent do?"
          description={FIELD_DESCRIPTIONS['run.prompt']}
          onChange={(v) => handleParamChange('prompt', v)}
        />
      )}

      {intentId === 'agent_command' && (
        <TextInput
          value={params.command || ''}
          label="Command"
          placeholder="Agent command..."
          description={FIELD_DESCRIPTIONS['run.command']}
          onChange={(v) => handleParamChange('command', v)}
        />
      )}

      {intentId === 'dictation' && (
        <DictationFields
          params={params}
          variableOptions={variableOptions}
          screenOptions={screenOptions}
          onParamChange={handleParamChange}
        />
      )}

      {intentId && intentId !== 'effect' && (run.vibe || run.light) && (
        <div className="mt-1 text-[10px] text-ink-dim">
          + {run.vibe ? run.vibe : ''}{run.vibe && run.light ? ' + ' : ''}{run.light ? 'light' : ''}
        </div>
      )}
    </div>
  )
}
