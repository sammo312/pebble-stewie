'use client'

import { useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { screenUsesSelectDrawer, getScreenActions, screenSupportsActions } from '@/app/lib/constants'
import { getNestedValue, shouldRenderRunField } from '@/app/lib/graph-utils'
import { FieldInput, EntityField } from './field-renderers'
import DrawAnimationInspector from './draw-animation-inspector'
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react'

function CollapsibleSection({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t border-line pt-2 mt-2 first:border-t-0 first:mt-0 first:pt-0">
      <button
        type="button"
        className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-left text-xs font-semibold text-ink hover:bg-white/[0.06] transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="size-3 text-ink-dim" /> : <ChevronRight className="size-3 text-ink-dim" />}
        <span>{title}</span>
      </button>
      {open && <div className="pt-2">{children}</div>}
    </div>
  )
}

export default function ScreenInspector({
  selectedScreen,
  selectedScreenId,
  screenBuilderSpec,
  graphBuilderSpec,
  updateScreenField,
  addMenuItem,
  removeMenuItem,
  updateMenuItem,
  addScreenAction,
  removeScreenAction,
  updateScreenAction,
  updateDrawField,
  addDrawStep,
  removeDrawStep,
  updateDrawStep,
  getBindingsDraft,
  updateBindingsDraft,
  commitBindingsDraft,
  applyBindingsPreset
}) {
  const basicFieldIds = new Set(['id', 'type', 'title', 'body'])
  const dynamicFieldIds = new Set(['titleTemplate', 'bodyTemplate', 'bindings', 'input.mode'])

  const screenFields = screenBuilderSpec.screenFields.filter(
    (field) => field.id !== 'items' && field.id !== 'actions'
  )
  const basicFields = screenFields.filter((f) => basicFieldIds.has(f.id))
  const dynamicFields = screenFields.filter((f) => dynamicFieldIds.has(f.id))
  const selectedActionFields =
    screenUsesSelectDrawer(selectedScreen)
      ? graphBuilderSpec.drawerItemFields
      : graphBuilderSpec.actionFields

  return (
    <>
      <CollapsibleSection title="Basic" defaultOpen={true}>
        <div className="field-grid">
          {basicFields.map((field) => {
            const value = String(getNestedValue(selectedScreen, field.id) || '')
            const charCount = field.maxLen ? `${value.length}/${field.maxLen}` : null
            return (
              <FieldInput
                key={field.id}
                field={field}
                value={value}
                charCount={charCount}
                onChange={(v) => updateScreenField(field, v)}
              />
            )
          })}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Dynamic Content" defaultOpen={false}>
        <div className="field-grid">
          {dynamicFields.map((field) => {
            const value = String(getNestedValue(selectedScreen, field.id) || '')
            const charCount = field.maxLen ? `${value.length}/${field.maxLen}` : null
            return (
              <FieldInput
                key={field.id}
                field={field}
                value={value}
                charCount={charCount}
                onChange={(v) => updateScreenField(field, v)}
                getBindingsDraft={getBindingsDraft}
                updateBindingsDraft={updateBindingsDraft}
                commitBindingsDraft={commitBindingsDraft}
                applyBindingsPreset={applyBindingsPreset}
              />
            )
          })}
        </div>
      </CollapsibleSection>

      {selectedScreen.type === 'draw' && (
        <CollapsibleSection
          title={`Drawing Animation (${(selectedScreen.drawing?.steps || []).length}/${graphBuilderSpec.limits.maxDrawSteps})`}
          defaultOpen={true}
        >
          <DrawAnimationInspector
            screen={selectedScreen}
            maxDrawSteps={graphBuilderSpec.limits.maxDrawSteps}
            updateDrawField={updateDrawField}
            addDrawStep={addDrawStep}
            removeDrawStep={removeDrawStep}
            updateDrawStep={updateDrawStep}
          />
        </CollapsibleSection>
      )}

      {selectedScreen.type === 'menu' && (
        <CollapsibleSection
          title={`Menu Items (${(selectedScreen.items || []).length}/${graphBuilderSpec.limits.maxMenuItems})`}
          defaultOpen={true}
        >
          <div className="mb-2">
            <Button size="xs" onClick={addMenuItem}>
              <Plus className="size-3" /> Add Item
            </Button>
          </div>

          {(selectedScreen.items || []).map((item, index) => (
            <div className="list-card" key={`${item.id || 'item'}-${index}`}>
              <div className="list-card-head">
                <strong className="text-xs">{item.label || `Item ${index + 1}`}</strong>
                <Button size="xs" variant="ghost" onClick={() => removeMenuItem(index)}>
                  <X className="size-3" />
                </Button>
              </div>
              <div className="field-grid compact">
                {graphBuilderSpec.itemFields
                  .filter((field) => shouldRenderRunField(item, field.id))
                  .map((field) => (
                    <EntityField
                      key={field.id}
                      field={field}
                      entity={item}
                      updateFn={updateMenuItem}
                      index={index}
                    />
                  ))}
              </div>
            </div>
          ))}
        </CollapsibleSection>
      )}

      {screenSupportsActions(selectedScreen) && (
        <CollapsibleSection
          title={
            screenUsesSelectDrawer(selectedScreen)
              ? `Select Action Menu Items (${getScreenActions(selectedScreen).length}/${graphBuilderSpec.limits.maxMenuActions})`
              : `Button Actions (${getScreenActions(selectedScreen).length}/${graphBuilderSpec.limits.maxCardActions})`
          }
          defaultOpen={true}
        >
          <div className="mb-2">
            <Button size="xs" onClick={addScreenAction}>
              <Plus className="size-3" />
              {screenUsesSelectDrawer(selectedScreen) ? 'Add Action Menu Item' : 'Add Action'}
            </Button>
          </div>

          {getScreenActions(selectedScreen).map((action, index) => (
            <div className="list-card" key={`${action.id || 'action'}-${index}`}>
              <div className="list-card-head">
                <strong className="text-xs">
                  {action.label || `${screenUsesSelectDrawer(selectedScreen) ? 'Action Menu Item' : 'Action'} ${index + 1}`}
                </strong>
                <Button size="xs" variant="ghost" onClick={() => removeScreenAction(index)}>
                  <X className="size-3" />
                </Button>
              </div>
              <div className="field-grid compact">
                {selectedActionFields
                  .filter((field) => shouldRenderRunField(action, field.id))
                  .map((field) => (
                    <EntityField
                      key={field.id}
                      field={field}
                      entity={action}
                      updateFn={updateScreenAction}
                      index={index}
                    />
                  ))}
              </div>
            </div>
          ))}
        </CollapsibleSection>
      )}
    </>
  )
}
