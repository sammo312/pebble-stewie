'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/app/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/app/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/app/components/ui/collapsible'
import { ChevronDown, ChevronRight } from 'lucide-react'
import ScreenInspector from './screen-inspector'
import RunTargetInspector from './run-target-inspector'
import StatePanel from './state-panel'

function CollapsibleSection({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="mt-4 border-t border-line/70 pt-4 first:mt-0 first:border-t-0 first:pt-0"
    >
      <CollapsibleTrigger
        type="button"
        className="flex w-full items-center gap-2 rounded-none border border-transparent px-2.5 py-2 text-left font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink transition-colors hover:border-line/60 hover:bg-panel-soft/70"
      >
        {open ? <ChevronDown className="size-3 text-ink-dim" /> : <ChevronRight className="size-3 text-ink-dim" />}
        <span>{title}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

export default function InspectorPanel({
  selectedNodeId,
  selectedScreen,
  selectedRunTarget,
  selectedNodeUsages,
  screenIds,
  graphReferenceCatalog,
  screenBuilderSpec,
  graphBuilderSpec,
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
  ensureCurrentScreenBinding,
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
  const [activeTab, setActiveTab] = useState(selectedNodeId ? 'inspector' : 'state')

  useEffect(() => {
    if (selectedNodeId) {
      setActiveTab('inspector')
    }
  }, [selectedNodeId])

  const hasNode = !!selectedNodeId
  const undeclaredCount = (graphReferenceCatalog?.undeclaredVariableKeys?.length || 0) +
    (graphReferenceCatalog?.undeclaredStorageKeys?.length || 0)

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden border-line/80 bg-card shadow-none">
      <div className="flex items-center border-b border-line/70">
        <button
          type="button"
          className={`flex-1 px-3 py-2.5 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
            activeTab === 'inspector'
              ? 'bg-card text-ink border-b-2 border-ink'
              : 'bg-panel-soft/50 text-ink-dim hover:text-ink'
          }`}
          onClick={() => setActiveTab('inspector')}
        >
          Inspector
        </button>
        <button
          type="button"
          className={`flex-1 px-3 py-2.5 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
            activeTab === 'state'
              ? 'bg-card text-ink border-b-2 border-ink'
              : 'bg-panel-soft/50 text-ink-dim hover:text-ink'
          }`}
          onClick={() => setActiveTab('state')}
        >
          Data
          {undeclaredCount > 0 && (
            <Badge variant="destructive" className="ml-1.5 h-4 px-1 text-[9px]">
              {undeclaredCount}
            </Badge>
          )}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <CardContent className="p-4">
          {activeTab === 'state' && (
            <StatePanel
              graphReferenceCatalog={graphReferenceCatalog}
              addVariable={addVariable}
              removeVariable={removeVariable}
              updateVariable={updateVariable}
              addStorageKey={addStorageKey}
              removeStorageKey={removeStorageKey}
              updateStorageKey={updateStorageKey}
              declareFromUndeclared={declareFromUndeclared}
              addDataItem={addDataItem}
              removeDataItem={removeDataItem}
              updateDataItem={updateDataItem}
            />
          )}

          {activeTab === 'inspector' && !hasNode && (
            <p className="text-xs text-ink-dim">Select a node on the canvas to inspect it.</p>
          )}

          {activeTab === 'inspector' && selectedScreen && (
            <>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <CardTitle className="text-sm text-ink">[ Screen Inspector ]</CardTitle>
                  <CardDescription className="text-[11px]">
                    Edit the selected screen and inspect linked actions.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-line/80 bg-panel-soft text-[10px] text-ink-dim">
                  {selectedNodeId}
                </Badge>
              </div>
              <ScreenInspector
                selectedScreen={selectedScreen}
                screenIds={graphReferenceCatalog?.screenOptions || screenIds}
                graphReferenceCatalog={graphReferenceCatalog}
                screenBuilderSpec={screenBuilderSpec}
                graphBuilderSpec={graphBuilderSpec}
                updateScreenField={updateScreenField}
                addMenuItem={addMenuItem}
                removeMenuItem={removeMenuItem}
                updateMenuItem={updateMenuItem}
                addScreenHook={addScreenHook}
                removeScreenHook={removeScreenHook}
                updateScreenHook={updateScreenHook}
                toggleScreenTimer={toggleScreenTimer}
                updateScreenTimer={updateScreenTimer}
                addScreenAction={addScreenAction}
                removeScreenAction={removeScreenAction}
                updateScreenAction={updateScreenAction}
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
                getBindingsDraft={getBindingsDraft}
                updateBindingsDraft={updateBindingsDraft}
                commitBindingsDraft={commitBindingsDraft}
                applyBindingsPreset={applyBindingsPreset}
                ensureCurrentScreenBinding={ensureCurrentScreenBinding}
              />
            </>
          )}

          {activeTab === 'inspector' && selectedRunTarget && (
            <>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <CardTitle className="text-sm text-ink">[ Logic Node ]</CardTitle>
                  <CardDescription className="text-[11px]">
                    Inspect the selected workflow target and inbound links.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-line/80 bg-panel-soft text-[10px] text-ink-dim">
                  {selectedNodeId}
                </Badge>
              </div>
              <RunTargetInspector
                selectedRunTarget={selectedRunTarget}
                graphReferenceCatalog={graphReferenceCatalog}
              />
            </>
          )}

          {activeTab === 'inspector' && hasNode && (
            <CollapsibleSection title={`Linked From (${selectedNodeUsages.length})`} defaultOpen={true}>
              {selectedNodeUsages.length === 0 && <p className="text-xs text-ink-dim">Nothing points to this node yet.</p>}
              {selectedNodeUsages.map((usage) => (
                <div className="list-card" key={usage.id}>
                  <div className="list-card-head">
                    <strong className="text-xs">{usage.entityLabel}</strong>
                    <Badge variant="outline" className="text-[9px] h-4 border-line text-ink-dim px-1">
                      {usage.entityKind}
                    </Badge>
                  </div>
                  <div className="text-xs text-ink-dim">
                    {usage.sourceScreenLabel} <code>{usage.sourceScreenId}</code>
                  </div>
                </div>
              ))}
            </CollapsibleSection>
          )}
        </CardContent>
      </div>
    </Card>
  )
}
