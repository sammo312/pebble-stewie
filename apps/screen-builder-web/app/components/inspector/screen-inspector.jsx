'use client'

import { useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { screenUsesSelectDrawer, getScreenActions, screenSupportsActions } from '@/app/lib/constants'
import { getDisplayFieldValue, getNestedValue, getScreenHookRuns, shouldRenderRunField, describeRunTarget } from '@/app/lib/graph-utils'
import { FieldInput, EntityField } from './field-renderers'
import IntentActionEditor from './intent-action-editor'
import DrawAnimationInspector from './draw-animation-inspector'
import InfoPopover from '@/app/components/ui/info-popover'
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react'

function CollapsibleSection({ title, help, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t border-line pt-2 mt-2 first:border-t-0 first:mt-0 first:pt-0">
      <div className="flex items-center gap-2 px-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-0 py-1 text-left text-xs font-semibold text-ink hover:bg-white/[0.06] transition-colors"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <ChevronDown className="size-3 text-ink-dim" /> : <ChevronRight className="size-3 text-ink-dim" />}
          <span>{title}</span>
        </button>
        {help ? <InfoPopover {...help} /> : null}
      </div>
      {open && <div className="pt-2">{children}</div>}
    </div>
  )
}

function LifecycleHookList({
  title,
  hookKey,
  hooks,
  hookFields,
  schemaVersion,
  screenOptions,
  maxHooks,
  addScreenHook,
  removeScreenHook,
  updateScreenHook,
  graphReferenceCatalog,
  currentScreen,
  ensureCurrentScreenBinding
}) {
  return (
    <CollapsibleSection
      title={`${title} (${hooks.length}/${maxHooks})`}
      defaultOpen={false}
      help={{
        title,
        description: hookKey === 'onEnter'
          ? 'These runs fire when the screen becomes active.'
          : 'These runs fire when the user leaves this screen.',
        bullets: [
          'Use effects for haptics or light, and use logic runs for setup/cleanup.',
          'Hook availability depends on the selected schema version.'
        ]
      }}
    >
      <div className="mb-2">
        <Button size="xs" onClick={() => addScreenHook(hookKey)}>
          <Plus className="size-3" /> Add Hook
        </Button>
      </div>

      {hooks.length === 0 && <p className="text-xs text-ink-dim">No lifecycle hooks configured.</p>}

      {hooks.map((run, index) => {
        const entity = { run }
        return (
          <div className="list-card" key={`${hookKey}-${index}`}>
            <div className="list-card-head">
              <strong className="text-xs">{describeRunTarget(run)}</strong>
              <Button size="xs" variant="ghost" onClick={() => removeScreenHook(hookKey, index)}>
                <X className="size-3" />
              </Button>
            </div>
            <div className="field-grid compact">
              {hookFields
                .filter((field) => shouldRenderRunField(entity, field.id))
                .map((field) => (
                  <EntityField
                    key={field.id}
                    field={field}
                    entity={entity}
                    updateFn={(hookIndex, nextField, value) => updateScreenHook(hookKey, hookIndex, nextField, value)}
                    index={index}
                    schemaVersion={schemaVersion}
                    screenOptions={screenOptions}
                    graphReferenceCatalog={graphReferenceCatalog}
                    currentScreen={currentScreen}
                    ensureScreenBinding={ensureCurrentScreenBinding}
                  />
                ))}
            </div>
          </div>
        )
      })}
    </CollapsibleSection>
  )
}

function ScreenTimerSection({
  timer,
  timerFields,
  schemaVersion,
  screenOptions,
  toggleScreenTimer,
  updateScreenTimer,
  graphReferenceCatalog,
  currentScreen
}) {
  if (!timer) {
    return (
      <CollapsibleSection
        title="Timer"
        defaultOpen={false}
        help={{
          title: 'Timer',
          description: 'A one-shot delayed run that fires after this screen is shown.',
          bullets: [
            'Useful for splash screens, countdowns, and auto-dismiss flows.',
            'Timer support depends on the selected schema version.'
          ]
        }}
      >
        <div className="mb-2">
          <Button size="xs" onClick={() => toggleScreenTimer(true)}>
            <Plus className="size-3" /> Enable Timer
          </Button>
        </div>
        <p className="text-xs text-ink-dim">No timer configured for this screen.</p>
      </CollapsibleSection>
    )
  }

  const entity = { run: timer.run }
  return (
    <CollapsibleSection
      title="Timer"
      defaultOpen={false}
      help={{
        title: 'Timer',
        description: 'A one-shot delayed run that fires after this screen is shown.',
        bullets: [
          'Delay is stored in milliseconds.',
          'Use navigate, logic, storage, or effect runs depending on schema support.'
        ]
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <strong className="text-xs">{describeRunTarget(timer.run)}</strong>
        <Button size="xs" variant="ghost" onClick={() => toggleScreenTimer(false)}>
          <X className="size-3" />
        </Button>
      </div>
      <div className="field-grid compact">
        <div>
          <div className="field-label">
            <span>Delay (ms)</span>
            <InfoPopover
              title="Delay (ms)"
              description="How long to wait after the screen appears before the timer run fires."
              bullets={['Value is stored in milliseconds.', 'The timer is one-shot and does not repeat automatically.']}
            />
          </div>
          <input
            className="field-input"
            value={String(timer.durationMs || 5000)}
            onChange={(event) => updateScreenTimer({ id: 'timer.durationMs' }, event.target.value)}
          />
        </div>
        {timerFields
          .filter((field) => shouldRenderRunField(entity, field.id))
          .map((field) => (
            <EntityField
              key={field.id}
              field={field}
              entity={entity}
              updateFn={(index, nextField, value) => updateScreenTimer(nextField, value)}
              index={0}
              schemaVersion={schemaVersion}
              screenOptions={screenOptions}
              graphReferenceCatalog={graphReferenceCatalog}
              currentScreen={currentScreen}
              ensureScreenBinding={ensureCurrentScreenBinding}
            />
          ))}
      </div>
    </CollapsibleSection>
  )
}

export default function ScreenInspector({
  selectedScreen,
  screenBuilderSpec,
  graphBuilderSpec,
  screenIds,
  graphReferenceCatalog,
  updateScreenField,
  addMenuItem,
  removeMenuItem,
  updateMenuItem,
  addScreenHook,
  removeScreenHook,
  updateScreenHook,
  toggleScreenTimer,
  updateScreenTimer,
  addScreenAction,
  removeScreenAction,
  updateScreenAction,
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
  updateDrawStep,
  getBindingsDraft,
  updateBindingsDraft,
  commitBindingsDraft,
  applyBindingsPreset,
  ensureCurrentScreenBinding
}) {
  const basicFieldIds = new Set(['id', 'type', 'title', 'body', 'input.mode'])
  const dataFieldIds = new Set(['bindings'])
  const screenOptions = graphReferenceCatalog.screenOptions?.length ? graphReferenceCatalog.screenOptions : screenIds

  const screenFields = screenBuilderSpec.screenFields.filter(
    (field) => field.id !== 'items' && field.id !== 'actions'
  )
  const basicFields = screenFields.filter((f) => basicFieldIds.has(f.id))
  const dataFields = screenFields.filter((f) => dataFieldIds.has(f.id))
  const selectedActionFields =
    screenUsesSelectDrawer(selectedScreen)
      ? graphBuilderSpec.drawerItemFields
      : graphBuilderSpec.actionFields
  const hookFields = graphBuilderSpec.hookRunFields || []
  const timerFields = graphBuilderSpec.timerRunFields || []
  const supportsHooks = hookFields.length > 0
  const supportsTimer = timerFields.length > 0
  const onEnterHooks = getScreenHookRuns(selectedScreen, 'onEnter')
  const onExitHooks = getScreenHookRuns(selectedScreen, 'onExit')
  const timer = selectedScreen.timer || null

  return (
    <>
      <CollapsibleSection title="Basic" defaultOpen={true}>
        <div className="field-grid">
          {basicFields.map((field) => {
            const value = String(getDisplayFieldValue(selectedScreen, field.id) || '')
            const charCount = field.maxLen ? `${value.length}/${field.maxLen}` : null
            return (
              <FieldInput
                key={field.id}
                field={field}
                value={value}
                charCount={charCount}
                onChange={(v) => updateScreenField(field, v)}
                schemaVersion={graphBuilderSpec.schemaVersion}
                screenOptions={screenOptions}
                graphReferenceCatalog={graphReferenceCatalog}
                currentScreen={selectedScreen}
                ensureScreenBinding={ensureCurrentScreenBinding}
              />
            )
          })}
        </div>
      </CollapsibleSection>

      {dataFields.length > 0 && (
        <CollapsibleSection
          title="Advanced Data Sources"
          defaultOpen={false}
          help={{
            title: 'Advanced Data Sources',
            description: 'Raw binding aliases. Use the Data tab to declare data items — bindings are auto-managed from there.',
            bullets: [
              'Device-scope data items declared in the Data tab auto-inject bindings on export.',
              'Edit here only for advanced overrides.'
            ]
          }}
        >
          <div className="field-grid">
            {dataFields.map((field) => {
              const value = String(getNestedValue(selectedScreen, field.id) || '')
              const charCount = field.maxLen ? `${value.length}/${field.maxLen}` : null
              return (
                <FieldInput
                  key={field.id}
                  field={field}
                  value={value}
                  charCount={charCount}
                  onChange={(v) => updateScreenField(field, v)}
                  schemaVersion={graphBuilderSpec.schemaVersion}
                  getBindingsDraft={getBindingsDraft}
                  updateBindingsDraft={updateBindingsDraft}
                  commitBindingsDraft={commitBindingsDraft}
                  applyBindingsPreset={applyBindingsPreset}
                  screenOptions={screenOptions}
                  graphReferenceCatalog={graphReferenceCatalog}
                  currentScreen={selectedScreen}
                  ensureScreenBinding={ensureCurrentScreenBinding}
                />
              )
            })}
          </div>
        </CollapsibleSection>
      )}

      {supportsHooks && (
        <LifecycleHookList
          title="On Enter"
          hookKey="onEnter"
          hooks={onEnterHooks}
          hookFields={hookFields}
          schemaVersion={graphBuilderSpec?.schemaVersion}
          screenOptions={screenOptions}
          maxHooks={graphBuilderSpec.limits.maxScreenHooks || 6}
          addScreenHook={addScreenHook}
          removeScreenHook={removeScreenHook}
          updateScreenHook={updateScreenHook}
          graphReferenceCatalog={graphReferenceCatalog}
          currentScreen={selectedScreen}
          ensureCurrentScreenBinding={ensureCurrentScreenBinding}
        />
      )}

      {supportsHooks && (
        <LifecycleHookList
          title="On Exit"
          hookKey="onExit"
          hooks={onExitHooks}
          hookFields={hookFields}
          schemaVersion={graphBuilderSpec?.schemaVersion}
          screenOptions={screenOptions}
          maxHooks={graphBuilderSpec.limits.maxScreenHooks || 6}
          addScreenHook={addScreenHook}
          removeScreenHook={removeScreenHook}
          updateScreenHook={updateScreenHook}
          graphReferenceCatalog={graphReferenceCatalog}
          currentScreen={selectedScreen}
        />
      )}

      {supportsTimer && (
        <ScreenTimerSection
          timer={timer}
          timerFields={timerFields}
          schemaVersion={graphBuilderSpec?.schemaVersion}
          screenOptions={screenOptions}
          toggleScreenTimer={toggleScreenTimer}
          updateScreenTimer={updateScreenTimer}
          graphReferenceCatalog={graphReferenceCatalog}
          currentScreen={selectedScreen}
        />
      )}

      {selectedScreen.type === 'draw' && (
        <CollapsibleSection
          title={`Motion (${(selectedScreen.motion?.tracks || selectedScreen.drawing?.steps || []).length}/${graphBuilderSpec.limits.maxDrawSteps || 6})`}
          defaultOpen={true}
        >
          <DrawAnimationInspector
            screen={selectedScreen}
            maxDrawSteps={graphBuilderSpec.limits.maxDrawSteps || 6}
            motionTrackFields={graphBuilderSpec.motionTrackFields || []}
            updateCanvasTemplate={updateCanvasTemplate}
            updateCanvasHeader={updateCanvasHeader}
            addCanvasItem={addCanvasItem}
            removeCanvasItem={removeCanvasItem}
            updateCanvasItem={updateCanvasItem}
            updateMotionField={updateMotionField}
            addMotionTrack={addMotionTrack}
            removeMotionTrack={removeMotionTrack}
            updateMotionTrack={updateMotionTrack}
            detachMotionToRaw={detachMotionToRaw}
            enablePresetMotion={enablePresetMotion}
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
          help={{
            title: 'Menu Items',
            description: 'Each row becomes one selectable line on the watch.',
            bullets: [
              'Use the run fields to link an item to another screen or logic node.',
              'Labels can mix plain text with tokens from bindings, vars, storage, and timer values.'
            ]
          }}
        >
          <div className="mb-2">
            <Button size="xs" onClick={addMenuItem}>
              <Plus className="size-3" /> Add Item
            </Button>
          </div>

          {(selectedScreen.items || []).map((item, index) => (
            <div className="list-card" key={`${item.id || 'item'}-${index}`}>
              <div className="list-card-head">
                <strong className="text-xs">{getDisplayFieldValue(item, 'label') || `Item ${index + 1}`}</strong>
                <Button size="xs" variant="ghost" onClick={() => removeMenuItem(index)}>
                  <X className="size-3" />
                </Button>
              </div>
              <div className="field-grid compact">
                {graphBuilderSpec.itemFields
                  .filter((field) => field.id !== 'labelTemplate' && !field.id.startsWith('run.'))
                  .map((field) => (
                    <EntityField
                      key={field.id}
                      field={field}
                      entity={item}
                      updateFn={updateMenuItem}
                      index={index}
                      schemaVersion={graphBuilderSpec?.schemaVersion}
                      screenOptions={screenOptions}
                      graphReferenceCatalog={graphReferenceCatalog}
                      currentScreen={selectedScreen}
                      ensureScreenBinding={ensureCurrentScreenBinding}
                    />
                  ))}
                <IntentActionEditor
                  entity={item}
                  index={index}
                  updateFn={updateMenuItem}
                  schemaVersion={graphBuilderSpec?.schemaVersion}
                  graphReferenceCatalog={graphReferenceCatalog}
                  currentScreen={selectedScreen}
                />
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
          help={{
            title: screenUsesSelectDrawer(selectedScreen) ? 'Select Action Menu Items' : 'Button Actions',
            description: screenUsesSelectDrawer(selectedScreen)
              ? 'These actions appear in the select-button drawer for scroll screens.'
              : 'These actions map to the watch hardware buttons on card screens.',
            bullets: [
              'Runs can point to another screen or a logic/native node.',
              'Screen targets use the current graph, while run types come from the current schema.'
            ]
          }}
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
                  {getDisplayFieldValue(action, 'label') || `${screenUsesSelectDrawer(selectedScreen) ? 'Action Menu Item' : 'Action'} ${index + 1}`}
                </strong>
                <Button size="xs" variant="ghost" onClick={() => removeScreenAction(index)}>
                  <X className="size-3" />
                </Button>
              </div>
              <div className="field-grid compact">
                {selectedActionFields
                  .filter((field) => field.id !== 'labelTemplate' && !field.id.startsWith('run.'))
                  .map((field) => (
                    <EntityField
                      key={field.id}
                      field={field}
                      entity={action}
                      updateFn={updateScreenAction}
                      index={index}
                      schemaVersion={graphBuilderSpec?.schemaVersion}
                      screenOptions={screenOptions}
                      graphReferenceCatalog={graphReferenceCatalog}
                      currentScreen={selectedScreen}
                      ensureScreenBinding={ensureCurrentScreenBinding}
                    />
                  ))}
                <IntentActionEditor
                  entity={action}
                  index={index}
                  updateFn={updateScreenAction}
                  schemaVersion={graphBuilderSpec?.schemaVersion}
                  graphReferenceCatalog={graphReferenceCatalog}
                  currentScreen={selectedScreen}
                />
              </div>
            </div>
          ))}
        </CollapsibleSection>
      )}
    </>
  )
}
