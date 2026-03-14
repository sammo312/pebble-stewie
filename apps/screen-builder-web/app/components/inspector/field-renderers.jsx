'use client'

import { FIELD_DESCRIPTIONS, fieldLabel, bindingPresets } from '@/app/lib/constants'
import { getNestedValue } from '@/app/lib/graph-utils'
import { Badge } from '@/app/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/app/components/ui/select'

const NONE_VALUE = '__none__'

function FieldSelect({ value, onChange, options, placeholder = 'Select option', allowNone = false }) {
  const selectValue = value ? String(value) : allowNone ? NONE_VALUE : undefined

  return (
    <Select
      value={selectValue}
      onValueChange={(nextValue) => onChange(nextValue === NONE_VALUE ? '' : nextValue)}
    >
      <SelectTrigger className="field-input h-9 w-full border-line bg-black text-left text-xs text-ink">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="border-line bg-panel text-ink">
        {allowNone ? <SelectItem value={NONE_VALUE}>(none)</SelectItem> : null}
        {options.map((option) => (
          <SelectItem value={String(option.value)} key={String(option.value)}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function resolveFieldOptions(field, screenOptions = []) {
  if (field.id === 'run.screen') {
    return screenOptions.map((screenId) => ({ value: screenId, label: screenId }))
  }

  if (field.type === 'enum') {
    return (field.options || []).map((option) => ({ value: option, label: option }))
  }

  return []
}

export function FieldInput({ field, value, charCount, onChange, getBindingsDraft, updateBindingsDraft, commitBindingsDraft, applyBindingsPreset, screenOptions = [] }) {
  const desc = FIELD_DESCRIPTIONS[field.id]
  const options = resolveFieldOptions(field, screenOptions)

  if (field.id === 'bindings') {
    return (
      <div className="col-span-2" key={field.id}>
        <label className="field-label">{fieldLabel(field.id)}</label>
        {desc && <span className="field-hint">{desc}</span>}
        <div className="flex items-center gap-2 mb-1.5">
          <FieldSelect
            value=""
            onChange={applyBindingsPreset}
            options={bindingPresets.map((preset) => ({ value: preset.id, label: preset.label }))}
            placeholder="Select binding preset"
          />
        </div>
        <textarea
          className="field-input area"
          value={getBindingsDraft()}
          onChange={(event) => updateBindingsDraft(event.target.value)}
          onBlur={commitBindingsDraft}
          placeholder='{"time":{"source":"device.time","live":true}}'
        />
      </div>
    )
  }

  if (field.type === 'enum' || (field.id === 'run.screen' && options.length > 0)) {
    return (
      <div key={field.id}>
        <label className="field-label">
          {fieldLabel(field.id)}
          {charCount && (
            <Badge variant="outline" className="text-[9px] h-4 ml-1 border-line text-ink-dim px-1">{charCount}</Badge>
          )}
        </label>
        {desc && <span className="field-hint">{desc}</span>}
        <FieldSelect
          value={value}
          onChange={onChange}
          options={options}
          allowNone={!field.required}
          placeholder={field.id === 'run.screen' ? 'Select screen' : 'Select option'}
        />
      </div>
    )
  }

  const isTextarea = field.type === 'textarea'
  return (
    <div className={isTextarea ? 'col-span-2' : ''} key={field.id}>
      <label className="field-label">
        {fieldLabel(field.id)}
        {charCount && (
          <Badge variant="outline" className="text-[9px] h-4 ml-1 border-line text-ink-dim px-1">{charCount}</Badge>
        )}
      </label>
      {desc && <span className="field-hint">{desc}</span>}
      {isTextarea ? (
        <textarea
          className="field-input area"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className="field-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  )
}

export function EntityField({ field, entity, updateFn, index, screenOptions = [] }) {
  const raw = getNestedValue(entity, field.id)
  const value = String(raw || '')
  const options = resolveFieldOptions(field, screenOptions)

  if (field.type === 'enum' || (field.id === 'run.screen' && options.length > 0)) {
    return (
      <div key={field.id}>
        <label className="field-label">{fieldLabel(field.id)}</label>
        <FieldSelect
          value={value}
          onChange={(nextValue) => updateFn(index, field, nextValue)}
          options={options}
          allowNone={!field.required}
          placeholder={field.id === 'run.screen' ? 'Select screen' : 'Select option'}
        />
      </div>
    )
  }

  if (field.type === 'boolean') {
    return (
      <div key={field.id}>
        <label className="field-label">
          <input
            type="checkbox"
            checked={!!raw}
            onChange={(event) => updateFn(index, field, event.target.checked)}
          />
          {' '}{fieldLabel(field.id)}
        </label>
      </div>
    )
  }

  return (
    <div key={field.id}>
      <label className="field-label">{fieldLabel(field.id)}</label>
      <input
        className="field-input"
        value={value}
        onChange={(event) => updateFn(index, field, event.target.value)}
      />
    </div>
  )
}
