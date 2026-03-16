'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getDisplayFieldValue, getNestedValue, isTemplatedContentField } from '@/app/lib/graph-utils'
import {
  schemaRegistry,
  FIELD_DESCRIPTIONS,
  fieldLabel,
  getBindingPresetsForSchema
} from '@/app/lib/constants'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import InfoPopover from '@/app/components/ui/info-popover'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/app/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/app/components/ui/select'
import { Plus } from 'lucide-react'

const NONE_VALUE = '__none__'
const SET_VAR_VALUE_PRESETS = [
  { label: 'increment', value: 'increment' },
  { label: 'toggle', value: 'toggle' },
  { label: 'true', value: 'true' },
  { label: 'false', value: 'false' },
  { label: '0', value: '0' },
  { label: 'literal:Sam', value: 'literal:Sam' }
]

function normalizeOption(option) {
  if (option && typeof option === 'object' && Object.prototype.hasOwnProperty.call(option, 'value')) {
    return {
      value: String(option.value),
      label: String(option.label || option.value)
    }
  }

  return {
    value: String(option),
    label: String(option)
  }
}

function dedupeOptions(options) {
  const seen = new Set()
  const deduped = []
  options.forEach((option) => {
    const normalized = normalizeOption(option)
    if (!normalized.value || seen.has(normalized.value)) {
      return
    }
    seen.add(normalized.value)
    deduped.push(normalized)
  })
  return deduped
}

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

function QuickPickSelect({ options, placeholder, onPick }) {
  const [draft, setDraft] = useState('')

  if (!options.length) {
    return null
  }

  return (
    <Select
      value={draft || undefined}
      onValueChange={(nextValue) => {
        onPick(nextValue)
        setDraft('')
      }}
    >
      <SelectTrigger className="field-input h-8 w-full border-line/80 bg-panel-soft text-left text-[11px] text-ink-dim">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="border-line bg-panel text-ink">
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
    return dedupeOptions(screenOptions)
  }

  if (field.type === 'enum') {
    return dedupeOptions((field.options || []).map((option) => ({ value: option, label: option })))
  }

  return []
}

function hasTemplateSyntaxMismatch(value) {
  const openTokens = (String(value || '').match(/{{/g) || []).length
  const closeTokens = (String(value || '').match(/}}/g) || []).length
  return openTokens !== closeTokens
}

function getRunTypeForField(fieldId, entity) {
  if (entity?.run?.type) {
    return String(entity.run.type)
  }
  if (fieldId === 'run.key' || fieldId === 'run.value') {
    return 'set_var'
  }
  return ''
}

function isTemplateField(fieldId, runType) {
  return fieldId.endsWith('Template') ||
    isTemplatedContentField(fieldId) ||
    (fieldId === 'run.value' && runType === 'store')
}

function getBindingTemplateSuggestions(bindings) {
  const bindingEntries = bindings && typeof bindings === 'object' ? Object.entries(bindings) : []
  const tokens = []

  bindingEntries.forEach(([bindingKey, binding]) => {
    const source = String(binding?.source || '')
    if (!bindingKey) {
      return
    }

    if (source === 'device.time') {
      tokens.push({ label: `${bindingKey}.localString`, value: `{{${bindingKey}.localString}}` })
      tokens.push({ label: `${bindingKey}.localTime`, value: `{{${bindingKey}.localTime}}` })
      tokens.push({ label: `${bindingKey}.iso`, value: `{{${bindingKey}.iso}}` })
      return
    }

    tokens.push({ label: bindingKey, value: `{{${bindingKey}}}` })
  })

  return dedupeOptions(tokens)
}

function getTemplateSuggestions(fieldId, schemaVersion, graphReferenceCatalog = {}, currentScreen = null, entity = null) {
  const descriptor = schemaRegistry.getSchemaDescriptor(schemaVersion)
  const supportedRunTypes = descriptor?.enums?.runTypes || []
  const supportsStorage = supportedRunTypes.includes('store')
  const supportsTimer = !!(descriptor?.fieldDefs?.timerRun && descriptor.fieldDefs.timerRun.length > 0)
  const runType = getRunTypeForField(fieldId, entity)

  if (!isTemplateField(fieldId, runType)) {
    return []
  }

  const variableKeys = graphReferenceCatalog.variableKeys || []
  const storageKeys = graphReferenceCatalog.storageKeys || []
  const tokens = getBindingTemplateSuggestions(currentScreen?.bindings)

  if (variableKeys.length > 0) {
    variableKeys.forEach((key) => {
      tokens.push({ label: `var:${key}`, value: `{{var.${key}}}` })
    })
  } else {
    tokens.push({ label: 'var', value: '{{var.score}}' })
  }

  if (supportsTimer) {
    tokens.push({ label: 'timer', value: '{{timer.remaining}}' })
  }

  if (supportsStorage) {
    if (storageKeys.length > 0) {
      storageKeys.forEach((key) => {
        tokens.push({ label: `storage:${key}`, value: `{{storage.${key}}}` })
      })
    } else {
      tokens.push({ label: 'storage', value: '{{storage.high_score}}' })
    }
  }

  return dedupeOptions(tokens)
}

function insertTokenAtSelection(value, token, selectionStart, selectionEnd) {
  const currentValue = String(value || '')
  const start = typeof selectionStart === 'number' ? selectionStart : currentValue.length
  const end = typeof selectionEnd === 'number' ? selectionEnd : start
  return `${currentValue.slice(0, start)}${token}${currentValue.slice(end)}`
}

function sanitizeTokenKey(value, fallback = 'value') {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '')

  return cleaned || fallback
}

function getExistingTimeBindingAlias(currentScreen) {
  const bindingEntries = currentScreen?.bindings && typeof currentScreen.bindings === 'object'
    ? Object.entries(currentScreen.bindings)
    : []

  const match = bindingEntries.find(([, binding]) => String(binding?.source || '') === 'device.time')
  return match ? match[0] : ''
}

function parseTokenMetadata(path, currentScreen = null) {
  const rawPath = String(path || '').trim()
  const parts = rawPath.split('.').filter(Boolean)
  const scope = parts[0] || ''

  if (scope === 'var') {
    return {
      kind: 'var',
      key: parts.slice(1).join('.') || '',
      label: parts[1] ? `Var ${parts.slice(1).join('.')}` : 'Variable'
    }
  }

  if (scope === 'storage') {
    return {
      kind: 'storage',
      key: parts.slice(1).join('.') || '',
      label: parts[1] ? `Store ${parts.slice(1).join('.')}` : 'Storage'
    }
  }

  if (scope === 'timer') {
    return {
      kind: 'timer',
      key: parts.slice(1).join('.') || '',
      label: rawPath === 'timer.remaining' ? 'Timer' : `Timer ${parts.slice(1).join('.')}`
    }
  }

  const alias = scope
  const property = parts.slice(1).join('.')
  const binding = currentScreen?.bindings && typeof currentScreen.bindings === 'object'
    ? currentScreen.bindings[alias]
    : null

  if (String(binding?.source || '') === 'device.time' || (alias === 'time' && !binding)) {
    return {
      kind: 'time',
      alias,
      format: property || 'localString',
      label:
        property === 'localTime'
          ? 'Current Time'
          : property === 'iso'
            ? 'Time ISO'
            : 'Current Time'
    }
  }

  return {
    kind: 'binding',
    alias,
    property,
    label: property ? `${alias}.${property}` : alias
  }
}

function parseTokenSegments(value, currentScreen = null) {
  const source = String(value || '')
  const segments = []
  const tokens = []
  const pattern = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g
  let lastIndex = 0
  let tokenIndex = 0
  let match = pattern.exec(source)

  while (match) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        text: source.slice(lastIndex, match.index)
      })
    }

    const meta = parseTokenMetadata(match[1], currentScreen)
    const token = {
      ...meta,
      raw: match[0],
      path: match[1],
      index: tokenIndex,
      start: match.index,
      end: pattern.lastIndex
    }

    segments.push({
      type: 'token',
      token
    })
    tokens.push(token)
    tokenIndex += 1
    lastIndex = pattern.lastIndex
    match = pattern.exec(source)
  }

  if (lastIndex < source.length || segments.length === 0) {
    segments.push({
      type: 'text',
      text: source.slice(lastIndex)
    })
  }

  return { segments, tokens }
}

function countTokensBeforePosition(value, position) {
  const prefix = String(value || '').slice(0, Math.max(0, position))
  return (prefix.match(/\{\{\s*[a-zA-Z0-9_.-]+\s*\}\}/g) || []).length
}

function replaceTokenAtIndex(value, currentScreen, tokenIndex, nextTokenRaw) {
  const { tokens } = parseTokenSegments(value, currentScreen)
  const token = tokens.find((candidate) => candidate.index === tokenIndex)
  if (!token) {
    return String(value || '')
  }

  const source = String(value || '')
  return `${source.slice(0, token.start)}${nextTokenRaw}${source.slice(token.end)}`
}

function buildTokenInsertGroups(schemaVersion, graphReferenceCatalog = {}, currentScreen = null) {
  const descriptor = schemaRegistry.getSchemaDescriptor(schemaVersion)
  const supportedRunTypes = descriptor?.enums?.runTypes || []
  const supportsStorage = supportedRunTypes.includes('store')
  const supportsTimer = !!(descriptor?.fieldDefs?.timerRun && descriptor.fieldDefs.timerRun.length > 0)

  const dataItems = graphReferenceCatalog.dataItems || []
  const hasUnifiedData = dataItems.length > 0

  if (hasUnifiedData) {
    const items = []

    dataItems.forEach((d) => {
      if (d.scope === 'session') {
        items.push({ id: `var:${d.key}`, type: 'var', key: d.key, label: `${d.key} (session)` })
      } else if (d.scope === 'persistent') {
        items.push({ id: `storage:${d.key}`, type: 'storage', key: d.key, label: `${d.key} (persistent)` })
      } else if (d.scope === 'device') {
        items.push({ id: `binding:${d.key}`, type: 'binding', alias: d.key, label: `${d.key} (device)` })
      }
    })

    const undeclaredVarItems = (graphReferenceCatalog.undeclaredVariableKeys || []).map((key) => ({
      id: `var:${key}`, type: 'var', key, label: `${key} (undeclared)`
    }))
    const undeclaredStorageItems = (graphReferenceCatalog.undeclaredStorageKeys || []).map((key) => ({
      id: `storage:${key}`, type: 'storage', key, label: `${key} (undeclared)`
    }))

    items.push(...undeclaredVarItems, ...undeclaredStorageItems)

    if (supportsTimer) {
      items.push({ id: 'timer', type: 'timer', label: 'Timer Remaining' })
    }

    items.push({ id: 'var:new', type: 'var-new', label: 'New Data Item...' })

    return [{ id: 'data', title: 'Data', items }]
  }

  const declaredVars = graphReferenceCatalog.declaredVariables || []
  const declaredStorage = graphReferenceCatalog.declaredStorageKeys || []

  const varItems = declaredVars.map((v) => ({
    id: `var:${v.key}`,
    type: 'var',
    key: v.key,
    label: `Variable: ${v.key}`
  }))
  const undeclaredVarItems = (graphReferenceCatalog.undeclaredVariableKeys || []).map((key) => ({
    id: `var:${key}`,
    type: 'var',
    key,
    label: `Variable: ${key} (undeclared)`
  }))

  const groups = [
    {
      id: 'live',
      title: 'Live',
      items: [{ id: 'time', type: 'time', label: 'Current Time' }]
    },
    {
      id: 'state',
      title: 'State',
      items: [
        ...varItems,
        ...undeclaredVarItems,
        { id: 'var:new', type: 'var-new', label: 'New Variable' }
      ]
    }
  ]

  if (supportsStorage) {
    const storageItems = declaredStorage.map((s) => ({
      id: `storage:${s.key}`,
      type: 'storage',
      key: s.key,
      label: `Storage: ${s.key}`
    }))
    const undeclaredStorageItems = (graphReferenceCatalog.undeclaredStorageKeys || []).map((key) => ({
      id: `storage:${key}`,
      type: 'storage',
      key,
      label: `Storage: ${key} (undeclared)`
    }))
    groups[1].items.push(
      ...storageItems,
      ...undeclaredStorageItems,
      { id: 'storage:new', type: 'storage-new', label: 'New Storage Value' }
    )
  }

  if (supportsTimer) {
    groups[1].items.push({ id: 'timer', type: 'timer', label: 'Timer Remaining' })
  }

  const bindingEntries = currentScreen?.bindings && typeof currentScreen.bindings === 'object'
    ? Object.entries(currentScreen.bindings)
    : []
  const customBindingItems = bindingEntries
    .filter(([, binding]) => String(binding?.source || '') !== 'device.time')
    .map(([alias]) => ({
      id: `binding:${alias}`,
      type: 'binding',
      alias,
      label: `Screen Data: ${alias}`
    }))

  if (customBindingItems.length > 0) {
    groups.push({
      id: 'bindings',
      title: 'Screen Data',
      items: customBindingItems
    })
  }

  return groups.filter((group) => group.items.length > 0)
}

function TokenInsertMenu({ groups, onSelect }) {
  return (
    <div className="token-insert-menu">
      {groups.map((group) => (
        <div className="token-insert-group" key={group.id}>
          <div className="token-insert-heading">{group.title}</div>
          <div className="token-insert-items">
            {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="token-insert-item"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(item)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function buildReferenceOptions(values) {
  return dedupeOptions((values || []).map((value) => ({ value, label: value })))
}

function getFieldAssist(field, entity, graphReferenceCatalog = {}, currentScreen = null) {
  const runType = getRunTypeForField(field.id, entity)
  const variableOptions = buildReferenceOptions(graphReferenceCatalog.variableKeys || [])
  const storageOptions = buildReferenceOptions(graphReferenceCatalog.storageKeys || [])
  const bindingOptions = buildReferenceOptions(
    currentScreen?.bindings && typeof currentScreen.bindings === 'object'
      ? Object.keys(currentScreen.bindings)
      : graphReferenceCatalog.bindingKeys || []
  )

  if (field.id === 'run.condition.var') {
    return {
      pickerPlaceholder: variableOptions.length ? 'Use existing variable key' : '',
      pickerOptions: variableOptions,
      quickValues: variableOptions.slice(0, 6)
    }
  }

  if (field.id === 'run.key' && runType === 'set_var') {
    return {
      pickerPlaceholder: variableOptions.length ? 'Use existing variable key' : '',
      pickerOptions: variableOptions,
      quickValues: variableOptions.slice(0, 6)
    }
  }

  if (field.id === 'run.key' && runType === 'store') {
    return {
      pickerPlaceholder: storageOptions.length ? 'Use existing storage key' : '',
      pickerOptions: storageOptions,
      quickValues: storageOptions.slice(0, 6)
    }
  }

  if (field.id === 'run.value' && runType === 'set_var') {
    return {
      pickerPlaceholder: 'Use a common state mutation',
      pickerOptions: SET_VAR_VALUE_PRESETS,
      quickValues: SET_VAR_VALUE_PRESETS
    }
  }

  if (field.id === 'bindings') {
    return {
      quickValues: bindingOptions
    }
  }

  return null
}

function getFieldHelp(field, entity, graphReferenceCatalog = {}, currentScreen = null) {
  const runType = getRunTypeForField(field.id, entity)
  const description = FIELD_DESCRIPTIONS[field.id]
  const bullets = []
  const bindingKeys = currentScreen?.bindings && typeof currentScreen.bindings === 'object'
    ? Object.keys(currentScreen.bindings)
    : graphReferenceCatalog.bindingKeys || []

  if (field.id === 'run.screen' && (graphReferenceCatalog.screenOptions || []).length > 0) {
    bullets.push('This list comes from the current graph, so rewiring or renaming screens updates the options here.')
  }

  if (field.id === 'run.condition.var' && (graphReferenceCatalog.variableKeys || []).length > 0) {
    bullets.push(`Existing variables in this graph: ${(graphReferenceCatalog.variableKeys || []).join(', ')}`)
  }

  if (field.id === 'run.key' && runType === 'set_var' && (graphReferenceCatalog.variableKeys || []).length > 0) {
    bullets.push(`Reuse an existing variable key or create a new one: ${(graphReferenceCatalog.variableKeys || []).join(', ')}`)
  }

  if (field.id === 'run.key' && runType === 'store' && (graphReferenceCatalog.storageKeys || []).length > 0) {
    bullets.push(`Existing storage keys in this graph: ${(graphReferenceCatalog.storageKeys || []).join(', ')}`)
  }

  if (field.id === 'run.value' && runType === 'set_var') {
    bullets.push('Common values are increment, toggle, true, false, numbers, or literal:Text for string literals.')
  }

  if (isTemplateField(field.id, runType) && bindingKeys.length > 0) {
    bullets.push(`Bindings on this screen: ${bindingKeys.join(', ')}`)
  }

  if (isTemplateField(field.id, runType) && (graphReferenceCatalog.variableKeys || []).length > 0) {
    bullets.push(`Variables available in this graph: ${(graphReferenceCatalog.variableKeys || []).join(', ')}`)
  }

  if ((isTemplateField(field.id, runType) || (field.id === 'run.value' && runType === 'store')) && (graphReferenceCatalog.storageKeys || []).length > 0) {
    bullets.push(`Storage keys available in this graph: ${(graphReferenceCatalog.storageKeys || []).join(', ')}`)
  }

  if (!description && bullets.length === 0) {
    return null
  }

  return {
    title: fieldLabel(field.id),
    description,
    bullets
  }
}

function FieldLabelRow({ field, charCount, help }) {
  return (
    <div className="field-label">
      <span>{fieldLabel(field.id)}</span>
      <span className="ml-auto flex items-center gap-1">
        {charCount ? (
          <Badge variant="outline" className="h-4 border-line px-1 text-[9px] text-ink-dim">
            {charCount}
          </Badge>
        ) : null}
        {help ? <InfoPopover {...help} /> : null}
      </span>
    </div>
  )
}

function FieldAssistRows({ assist, onPick }) {
  const hasPicker = !!assist?.pickerOptions?.length
  const hasQuickValues = !!assist?.quickValues?.length

  if (!hasPicker && !hasQuickValues) {
    return null
  }

  return (
    <div className="field-assist-block">
      {hasPicker ? (
        <div>
          <QuickPickSelect
            options={assist.pickerOptions}
            placeholder={assist.pickerPlaceholder || 'Use a suggested value'}
            onPick={onPick}
          />
        </div>
      ) : null}
      {hasQuickValues ? (
        <div className="field-assist-row">
          {assist.quickValues.map((option) => (
            <Button
              key={`${option.value}`}
              size="xs"
              variant="outline"
              type="button"
              onClick={() => onPick(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function TokenConfigPanel({ token, graphReferenceCatalog, currentScreen, onUpdateToken }) {
  const variableKeys = graphReferenceCatalog.variableKeys || []
  const storageKeys = graphReferenceCatalog.storageKeys || []
  const bindingKeys = currentScreen?.bindings && typeof currentScreen.bindings === 'object'
    ? Object.keys(currentScreen.bindings)
    : []

  if (token.kind === 'var') {
    return (
      <div className="token-config-panel">
        <div className="token-config-title">Variable Token</div>
        {variableKeys.length > 0 ? (
          <div className="field-assist-row">
            {variableKeys.slice(0, 8).map((key) => (
              <Button key={key} size="xs" variant="outline" type="button" onClick={() => onUpdateToken(`{{var.${key}}}`)}>
                {key}
              </Button>
            ))}
          </div>
        ) : null}
        <input
          className="field-input"
          value={token.key || ''}
          onChange={(event) => onUpdateToken(`{{var.${sanitizeTokenKey(event.target.value)}}}`)}
          placeholder="variable_key"
        />
      </div>
    )
  }

  if (token.kind === 'storage') {
    return (
      <div className="token-config-panel">
        <div className="token-config-title">Storage Token</div>
        {storageKeys.length > 0 ? (
          <div className="field-assist-row">
            {storageKeys.slice(0, 8).map((key) => (
              <Button key={key} size="xs" variant="outline" type="button" onClick={() => onUpdateToken(`{{storage.${key}}}`)}>
                {key}
              </Button>
            ))}
          </div>
        ) : null}
        <input
          className="field-input"
          value={token.key || ''}
          onChange={(event) => onUpdateToken(`{{storage.${sanitizeTokenKey(event.target.value, 'key')}}}`)}
          placeholder="storage_key"
        />
      </div>
    )
  }

  if (token.kind === 'time') {
    const alias = token.alias || getExistingTimeBindingAlias(currentScreen) || 'time'
    const formats = [
      { id: 'localString', label: 'Date + Time' },
      { id: 'localTime', label: 'Time Only' },
      { id: 'iso', label: 'ISO' }
    ]

    return (
      <div className="token-config-panel">
        <div className="token-config-title">Current Time</div>
        <div className="field-assist-row">
          {formats.map((format) => (
            <Button
              key={format.id}
              size="xs"
              variant={token.format === format.id ? 'default' : 'outline'}
              type="button"
              onClick={() => onUpdateToken(`{{${alias}.${format.id}}}`)}
            >
              {format.label}
            </Button>
          ))}
        </div>
      </div>
    )
  }

  if (token.kind === 'binding') {
    return (
      <div className="token-config-panel">
        <div className="token-config-title">Screen Data Token</div>
        {bindingKeys.length > 0 ? (
          <div className="field-assist-row">
            {bindingKeys.slice(0, 8).map((alias) => (
              <Button
                key={alias}
                size="xs"
                variant="outline"
                type="button"
                onClick={() => onUpdateToken(`{{${alias}}}`)}
              >
                {alias}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="token-config-panel">
      <div className="token-config-title">Token</div>
      <code>{token.raw}</code>
    </div>
  )
}

function TokenFieldControl({
  value,
  onChange,
  isTextarea,
  schemaVersion,
  graphReferenceCatalog,
  currentScreen,
  ensureScreenBinding
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeTokenIndex, setActiveTokenIndex] = useState(null)
  const inputRef = useRef(null)
  const selectionRef = useRef({ start: String(value || '').length, end: String(value || '').length })
  const pendingSelectionRef = useRef(null)
  const { tokens } = useMemo(
    () => parseTokenSegments(value, currentScreen),
    [currentScreen, value]
  )
  const insertGroups = useMemo(
    () => buildTokenInsertGroups(schemaVersion, graphReferenceCatalog, currentScreen),
    [currentScreen, graphReferenceCatalog, schemaVersion]
  )

  useEffect(() => {
    if (activeTokenIndex === null) {
      return
    }

    const tokenStillExists = tokens.some((token) => token.index === activeTokenIndex)
    if (!tokenStillExists) {
      setActiveTokenIndex(null)
    }
  }, [activeTokenIndex, tokens])

  useEffect(() => {
    if (!inputRef.current) {
      return
    }

    const pendingSelection = pendingSelectionRef.current
    if (pendingSelection && typeof inputRef.current.setSelectionRange === 'function') {
      inputRef.current.focus()
      inputRef.current.setSelectionRange(pendingSelection.start, pendingSelection.end)
      pendingSelectionRef.current = null
    }
  }, [value])

  function saveSelection(target) {
    if (!target) {
      return
    }

    selectionRef.current = {
      start: typeof target.selectionStart === 'number' ? target.selectionStart : String(value || '').length,
      end: typeof target.selectionEnd === 'number' ? target.selectionEnd : String(value || '').length
    }
  }

  function buildInsertTokenPayload(item) {
    if (item.type === 'time') {
      const alias =
        getExistingTimeBindingAlias(currentScreen) ||
        ensureScreenBinding?.('time', {
          source: 'device.time',
          live: true,
          refreshMs: 30000
        }) ||
        'time'

      return { raw: `{{${alias}.localString}}`, openConfig: false }
    }

    if (item.type === 'var') {
      return { raw: `{{var.${item.key}}}`, openConfig: false }
    }

    if (item.type === 'var-new') {
      return { raw: '{{var.value}}', openConfig: true }
    }

    if (item.type === 'storage') {
      return { raw: `{{storage.${item.key}}}`, openConfig: false }
    }

    if (item.type === 'storage-new') {
      return { raw: '{{storage.key}}', openConfig: true }
    }

    if (item.type === 'timer') {
      return { raw: '{{timer.remaining}}', openConfig: false }
    }

    if (item.type === 'binding') {
      return { raw: `{{${item.alias}}}`, openConfig: false }
    }

    return null
  }

  function insertToken(item) {
    const payload = buildInsertTokenPayload(item)
    if (!payload) {
      return
    }

    const sourceValue = String(value || '')
    const selection =
      inputRef.current
        ? {
            start: typeof inputRef.current.selectionStart === 'number' ? inputRef.current.selectionStart : sourceValue.length,
            end: typeof inputRef.current.selectionEnd === 'number' ? inputRef.current.selectionEnd : sourceValue.length
          }
        : {
            start: selectionRef.current.start ?? sourceValue.length,
            end: selectionRef.current.end ?? sourceValue.length
          }

    const nextValue = insertTokenAtSelection(sourceValue, payload.raw, selection.start, selection.end)
    const insertedTokenIndex = countTokensBeforePosition(sourceValue, selection.start)
    onChange(nextValue)
    pendingSelectionRef.current = {
      start: selection.start + payload.raw.length,
      end: selection.start + payload.raw.length
    }
    selectionRef.current = pendingSelectionRef.current
    setMenuOpen(false)

    if (payload.openConfig) {
      setActiveTokenIndex(insertedTokenIndex)
    }
  }

  function updateTokenAtIndex(tokenIndex, nextTokenRaw) {
    onChange(replaceTokenAtIndex(value, currentScreen, tokenIndex, nextTokenRaw))
  }

  return (
    <div className="token-field-shell">
      <div className="field-token-toolbar">
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button size="xs" variant="outline" type="button">
              <Plus className="size-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" side="bottom" className="w-auto rounded-none border-line bg-panel p-0">
            <TokenInsertMenu groups={insertGroups} onSelect={insertToken} />
          </PopoverContent>
        </Popover>
      </div>

      <div className="token-field-stage">
        {isTextarea ? (
          <textarea
            ref={inputRef}
            className="field-input area token-field-input"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onSelect={(event) => saveSelection(event.currentTarget)}
            onKeyUp={(event) => saveSelection(event.currentTarget)}
            onClick={(event) => saveSelection(event.currentTarget)}
            data-token-field="true"
          />
        ) : (
          <input
            ref={inputRef}
            className="field-input token-field-input"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onSelect={(event) => saveSelection(event.currentTarget)}
            onKeyUp={(event) => saveSelection(event.currentTarget)}
            onClick={(event) => saveSelection(event.currentTarget)}
            data-token-field="true"
          />
        )}
      </div>

    </div>
  )
}

export function FieldInput({
  field,
  value,
  charCount,
  onChange,
  getBindingsDraft,
  updateBindingsDraft,
  commitBindingsDraft,
  applyBindingsPreset,
  schemaVersion,
  screenOptions = [],
  graphReferenceCatalog = {},
  currentScreen = null,
  ensureScreenBinding
}) {
  const options = resolveFieldOptions(field, screenOptions)
  const availableBindingPresets = getBindingPresetsForSchema(schemaVersion)
  const templateSuggestions = useMemo(
    () => getTemplateSuggestions(field.id, schemaVersion, graphReferenceCatalog, currentScreen, null),
    [currentScreen, field.id, graphReferenceCatalog, schemaVersion]
  )
  const assist = useMemo(
    () => getFieldAssist(field, null, graphReferenceCatalog, currentScreen),
    [currentScreen, field, graphReferenceCatalog]
  )
  const help = useMemo(
    () => getFieldHelp(field, null, graphReferenceCatalog, currentScreen),
    [currentScreen, field, graphReferenceCatalog]
  )
  const tokenCapable = templateSuggestions.length > 0
  const templateMismatch = tokenCapable && hasTemplateSyntaxMismatch(value)

  if (field.id === 'bindings') {
    return (
      <div className="field-shell col-span-2" key={field.id}>
        <FieldLabelRow field={field} help={help} />
        <div className="flex items-center gap-2">
          <FieldSelect
            value=""
            onChange={applyBindingsPreset}
            options={availableBindingPresets.map((preset) => ({ value: preset.id, label: preset.label }))}
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
      <div className="field-shell" key={field.id}>
        <FieldLabelRow field={field} charCount={charCount} help={help} />
        <FieldSelect
          value={value}
          onChange={onChange}
          options={options}
          allowNone={!field.required}
          placeholder={field.id === 'run.screen' ? 'Select screen target' : 'Select option'}
        />
      </div>
    )
  }

  const isTextarea = field.type === 'textarea'
  return (
    <div className={`field-shell ${isTextarea ? 'col-span-2' : ''}`} key={field.id}>
      <FieldLabelRow field={field} charCount={charCount} help={help} />
      {tokenCapable ? (
        <TokenFieldControl
          value={value}
          onChange={onChange}
          isTextarea={isTextarea}
          schemaVersion={schemaVersion}
          graphReferenceCatalog={graphReferenceCatalog}
          currentScreen={currentScreen}
          ensureScreenBinding={ensureScreenBinding}
        />
      ) : isTextarea ? (
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
      {(assist || templateMismatch) ? (
        <div className="field-footer">
          <FieldAssistRows
            assist={assist}
            onPick={onChange}
          />
          {templateMismatch ? (
            <span className="field-hint" style={{ color: 'var(--danger)' }}>
              Template braces appear unbalanced
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function EntityField({
  field,
  entity,
  updateFn,
  index,
  screenOptions = [],
  schemaVersion,
  graphReferenceCatalog = {},
  currentScreen = null,
  ensureScreenBinding
}) {
  const raw = isTemplatedContentField(field.id)
    ? getDisplayFieldValue(entity, field.id)
    : getNestedValue(entity, field.id)
  const value = String(raw || '')
  const options = resolveFieldOptions(field, screenOptions)
  const templateSuggestions = useMemo(
    () => getTemplateSuggestions(field.id, schemaVersion, graphReferenceCatalog, currentScreen, entity),
    [currentScreen, entity, field.id, graphReferenceCatalog, schemaVersion]
  )
  const assist = useMemo(
    () => getFieldAssist(field, entity, graphReferenceCatalog, currentScreen),
    [currentScreen, entity, field, graphReferenceCatalog]
  )
  const help = useMemo(
    () => getFieldHelp(field, entity, graphReferenceCatalog, currentScreen),
    [currentScreen, entity, field, graphReferenceCatalog]
  )
  const tokenCapable = templateSuggestions.length > 0
  const templateMismatch = tokenCapable && hasTemplateSyntaxMismatch(value)

  if (field.type === 'enum' || (field.id === 'run.screen' && options.length > 0)) {
    return (
      <div className="field-shell" key={field.id}>
        <FieldLabelRow field={field} help={help} />
        <FieldSelect
          value={value}
          onChange={(nextValue) => updateFn(index, field, nextValue)}
          options={options}
          allowNone={!field.required}
          placeholder={field.id === 'run.screen' ? 'Select screen target' : 'Select option'}
        />
      </div>
    )
  }

  if (field.type === 'boolean') {
    return (
      <div className="field-shell" key={field.id}>
        <FieldLabelRow field={field} help={help} />
        <label className="field-boolean">
          <span className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!raw}
              onChange={(event) => updateFn(index, field, event.target.checked)}
            />
            {fieldLabel(field.id)}
          </span>
        </label>
      </div>
    )
  }

  return (
    <div className="field-shell" key={field.id}>
      <FieldLabelRow field={field} help={help} />
      {tokenCapable ? (
        <TokenFieldControl
          value={value}
          onChange={(nextValue) => updateFn(index, field, nextValue)}
          isTextarea={field.type === 'textarea'}
          schemaVersion={schemaVersion}
          graphReferenceCatalog={graphReferenceCatalog}
          currentScreen={currentScreen}
          ensureScreenBinding={ensureScreenBinding}
        />
      ) : field.type === 'textarea' ? (
        <textarea
          className="field-input area"
          value={value}
          onChange={(event) => updateFn(index, field, event.target.value)}
        />
      ) : (
        <input
          className="field-input"
          value={value}
          onChange={(event) => updateFn(index, field, event.target.value)}
        />
      )}
      {(assist || templateMismatch) ? (
        <div className="field-footer">
          <FieldAssistRows
            assist={assist}
            onPick={(nextValue) => updateFn(index, field, nextValue)}
          />
          {templateMismatch ? (
            <span className="field-hint" style={{ color: 'var(--danger)' }}>
              Template braces appear unbalanced
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
