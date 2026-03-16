'use client'

import { useState } from 'react'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/app/components/ui/select'
import { Trash2, Plus, AlertTriangle } from 'lucide-react'

const TYPE_OPTIONS = ['string', 'number', 'boolean']
const SCOPE_OPTIONS = [
  { value: 'session', label: 'Session', description: 'Runtime variable ({{var.key}})' },
  { value: 'persistent', label: 'Persistent', description: 'Phone storage ({{storage.key}})' },
  { value: 'device', label: 'Device', description: 'Live device data (e.g. time)' }
]

const SCOPE_BADGES = {
  session: { label: 'var', className: 'border-blue-500/40 text-blue-400' },
  persistent: { label: 'store', className: 'border-emerald-500/40 text-emerald-400' },
  device: { label: 'device', className: 'border-amber-500/40 text-amber-400' }
}

function ScopeBadge({ scope }) {
  const badge = SCOPE_BADGES[scope] || SCOPE_BADGES.session
  return (
    <Badge variant="outline" className={`h-4 px-1 text-[9px] ${badge.className}`}>
      {badge.label}
    </Badge>
  )
}

function DataItemRow({ item, usageCount, onUpdate, onRemove }) {
  const isDevice = item.scope === 'device'
  const isSession = item.scope === 'session'

  return (
    <div className="list-card">
      <div className="list-card-head">
        <div className="flex items-center gap-1.5">
          <ScopeBadge scope={item.scope} />
          <code className="text-xs text-ink">{item.key}</code>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="h-4 border-line px-1 text-[9px] text-ink-dim">
            {usageCount} use{usageCount !== 1 ? 's' : ''}
          </Badge>
          <button
            type="button"
            className="text-ink-dim hover:text-danger transition-colors"
            onClick={() => onRemove(item.key, item.scope)}
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isSession && (
          <input
            type="text"
            className="field-input flex-1"
            placeholder="default value"
            value={item.defaultValue || ''}
            onChange={(e) => onUpdate(item.key, item.scope, 'defaultValue', e.target.value)}
          />
        )}
        {isDevice && (
          <input
            type="text"
            className="field-input flex-1"
            placeholder="device.time"
            value={item.source || ''}
            onChange={(e) => onUpdate(item.key, item.scope, 'source', e.target.value)}
          />
        )}
        {!isDevice && (
          <Select
            value={item.typeHint || 'string'}
            onValueChange={(v) => onUpdate(item.key, item.scope, 'typeHint', v)}
          >
            <SelectTrigger className="h-7 w-20 border-line bg-[#020202] text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((t) => (
                <SelectItem key={t} value={t} className="text-[11px]">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {isDevice && (
          <label className="flex items-center gap-1.5 text-[11px] text-ink-dim">
            <input
              type="checkbox"
              checked={!!item.live}
              onChange={(e) => onUpdate(item.key, item.scope, 'live', e.target.checked)}
            />
            live
          </label>
        )}
      </div>
    </div>
  )
}

function AddDataItemRow({ onAdd }) {
  const [draft, setDraft] = useState('')
  const [scope, setScope] = useState('session')

  function handleAdd() {
    const key = draft.trim()
    if (!key) return
    onAdd(key, scope)
    setDraft('')
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <Select value={scope} onValueChange={setScope}>
        <SelectTrigger className="h-7 w-24 border-line bg-[#020202] text-[11px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SCOPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-[11px]">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input
        type="text"
        className="field-input flex-1"
        placeholder="data_key"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAdd()
        }}
      />
      <Button size="xs" variant="outline" onClick={handleAdd} className="h-7 px-2 text-[11px]">
        <Plus className="size-3 mr-1" /> Add
      </Button>
    </div>
  )
}

function countUsages(key, scope, catalog) {
  if (scope === 'persistent' || scope === 'storage') {
    return (catalog.storageKeys || []).filter((k) => k === key).length
  }
  if (scope === 'device') {
    return (catalog.bindingKeys || []).filter((k) => k === key).length
  }
  return (catalog.variableKeys || []).filter((k) => k === key).length
}

export default function StatePanel({
  graphReferenceCatalog,
  addVariable,
  removeVariable,
  updateVariable,
  addStorageKey,
  removeStorageKey,
  updateStorageKey,
  declareFromUndeclared,
  addDataItem,
  removeDataItem,
  updateDataItem
}) {
  const dataItems = graphReferenceCatalog?.dataItems || []
  const hasUnifiedData = dataItems.length > 0
  const declared = graphReferenceCatalog?.declaredVariables || []
  const declaredStorage = graphReferenceCatalog?.declaredStorageKeys || []
  const declaredDevice = graphReferenceCatalog?.declaredDeviceItems || []
  const undeclaredVars = graphReferenceCatalog?.undeclaredVariableKeys || []
  const undeclaredStorage = graphReferenceCatalog?.undeclaredStorageKeys || []
  const hasUndeclared = undeclaredVars.length > 0 || undeclaredStorage.length > 0

  function handleAddDataItem(key, scope) {
    const item = { key, scope }
    if (scope === 'session') {
      item.defaultValue = ''
      item.typeHint = 'string'
      if (addVariable) addVariable(key)
    } else if (scope === 'persistent') {
      item.typeHint = 'string'
      if (addStorageKey) addStorageKey(key)
    } else if (scope === 'device') {
      item.source = 'device.time'
      item.live = true
      item.refreshMs = 30000
    }
    if (addDataItem) addDataItem(item)
  }

  function handleRemoveDataItem(key, scope) {
    if (removeDataItem) removeDataItem(key, scope)
    if (scope === 'session' && removeVariable) removeVariable(key)
    if (scope === 'persistent' && removeStorageKey) removeStorageKey(key)
  }

  function handleUpdateDataItem(key, scope, field, value) {
    if (updateDataItem) updateDataItem(key, scope, field, value)
    if (scope === 'session' && updateVariable) updateVariable(key, field, value)
    if (scope === 'persistent' && updateStorageKey) updateStorageKey(key, field, value)
  }

  if (hasUnifiedData) {
    const sessionItems = dataItems.filter((d) => d.scope === 'session')
    const persistentItems = dataItems.filter((d) => d.scope === 'persistent')
    const deviceItems = dataItems.filter((d) => d.scope === 'device')
    const allItems = [...sessionItems, ...persistentItems, ...deviceItems]

    return (
      <div className="space-y-5">
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">
              Data
            </h3>
            <Badge variant="outline" className="h-4 border-line px-1 text-[9px] text-ink-dim">
              {allItems.length}
            </Badge>
          </div>
          <p className="text-xs text-ink-dim mb-3">
            Declare all data your screens use. Session = runtime vars, Persistent = phone storage, Device = live data.
          </p>
          {allItems.length === 0 && (
            <p className="text-xs text-ink-dim mb-2">No data declared yet.</p>
          )}
          {allItems.map((item) => (
            <DataItemRow
              key={`${item.scope}:${item.key}`}
              item={item}
              usageCount={countUsages(item.key, item.scope, graphReferenceCatalog)}
              onUpdate={handleUpdateDataItem}
              onRemove={handleRemoveDataItem}
            />
          ))}
          <AddDataItemRow onAdd={handleAddDataItem} />
        </section>

        {hasUndeclared && (
          <UndeclaredSection
            undeclaredVars={undeclaredVars}
            undeclaredStorage={undeclaredStorage}
            declareFromUndeclared={declareFromUndeclared}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">
            Variables
          </h3>
          <Badge variant="outline" className="h-4 border-line px-1 text-[9px] text-ink-dim">
            {declared.length}
          </Badge>
        </div>
        {declared.length === 0 && (
          <p className="text-xs text-ink-dim mb-2">No variables declared yet. Add one to define initial state.</p>
        )}
        {declared.map((v) => (
          <DataItemRow
            key={`session:${v.key}`}
            item={{ ...v, scope: 'session' }}
            usageCount={countUsages(v.key, 'session', graphReferenceCatalog)}
            onUpdate={(key, _scope, field, value) => updateVariable(key, field, value)}
            onRemove={(key) => removeVariable(key)}
          />
        ))}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">
            Storage Keys
          </h3>
          <Badge variant="outline" className="h-4 border-line px-1 text-[9px] text-ink-dim">
            {declaredStorage.length}
          </Badge>
        </div>
        {declaredStorage.length === 0 && (
          <p className="text-xs text-ink-dim mb-2">No persistent storage keys declared.</p>
        )}
        {declaredStorage.map((s) => (
          <DataItemRow
            key={`persistent:${s.key}`}
            item={{ ...s, scope: 'persistent' }}
            usageCount={countUsages(s.key, 'persistent', graphReferenceCatalog)}
            onUpdate={(key, _scope, field, value) => updateStorageKey(key, field, value)}
            onRemove={(key) => removeStorageKey(key)}
          />
        ))}
      </section>

      <AddDataItemRow onAdd={handleAddDataItem} />

      {hasUndeclared && (
        <UndeclaredSection
          undeclaredVars={undeclaredVars}
          undeclaredStorage={undeclaredStorage}
          declareFromUndeclared={declareFromUndeclared}
        />
      )}
    </div>
  )
}

function UndeclaredSection({ undeclaredVars, undeclaredStorage, declareFromUndeclared }) {
  return (
    <section>
      <div className="flex items-center gap-1.5 mb-2">
        <AlertTriangle className="size-3 text-warning" />
        <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-warning">
          Undeclared References
        </h3>
      </div>
      <p className="text-xs text-ink-dim mb-2">
        These keys are used in your graph but not declared. Declare them to set defaults and prevent typos.
      </p>
      {undeclaredVars.map((key) => (
        <div key={`var:${key}`} className="list-card flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScopeBadge scope="session" />
            <code className="text-xs text-warning">{key}</code>
          </div>
          <Button
            size="xs"
            variant="outline"
            className="h-6 px-2 text-[10px]"
            onClick={() => declareFromUndeclared(key, 'variable')}
          >
            Declare
          </Button>
        </div>
      ))}
      {undeclaredStorage.map((key) => (
        <div key={`storage:${key}`} className="list-card flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScopeBadge scope="persistent" />
            <code className="text-xs text-warning">{key}</code>
          </div>
          <Button
            size="xs"
            variant="outline"
            className="h-6 px-2 text-[10px]"
            onClick={() => declareFromUndeclared(key, 'storage')}
          >
            Declare
          </Button>
        </div>
      ))}
    </section>
  )
}
