'use client'

import { FIELD_DESCRIPTIONS, fieldLabel, bindingPresets } from '@/app/lib/constants'
import { getNestedValue } from '@/app/lib/graph-utils'
import { Badge } from '@/app/components/ui/badge'

export function FieldInput({ field, value, charCount, onChange, getBindingsDraft, updateBindingsDraft, commitBindingsDraft, applyBindingsPreset }) {
  const desc = FIELD_DESCRIPTIONS[field.id]

  if (field.id === 'bindings') {
    return (
      <div className="col-span-2" key={field.id}>
        <label className="field-label">{fieldLabel(field.id)}</label>
        {desc && <span className="field-hint">{desc}</span>}
        <div className="flex items-center gap-2 mb-1.5">
          <select
            className="field-input text-xs"
            value=""
            onChange={(event) => applyBindingsPreset(event.target.value)}
          >
            <option value="">Select binding preset</option>
            {bindingPresets.map((preset) => (
              <option value={preset.id} key={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
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

  if (field.type === 'enum') {
    return (
      <div key={field.id}>
        <label className="field-label">
          {fieldLabel(field.id)}
          {charCount && (
            <Badge variant="outline" className="text-[9px] h-4 ml-1 border-line text-ink-dim px-1">{charCount}</Badge>
          )}
        </label>
        {desc && <span className="field-hint">{desc}</span>}
        <select
          className="field-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {!field.required && <option value="">(none)</option>}
          {(field.options || []).map((option) => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
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

export function EntityField({ field, entity, updateFn, index }) {
  const raw = getNestedValue(entity, field.id)
  const value = String(raw || '')

  if (field.type === 'enum') {
    return (
      <div key={field.id}>
        <label className="field-label">{fieldLabel(field.id)}</label>
        <select
          className="field-input"
          value={value}
          onChange={(event) => updateFn(index, field, event.target.value)}
        >
          <option value="">(none)</option>
          {(field.options || []).map((option) => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
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
