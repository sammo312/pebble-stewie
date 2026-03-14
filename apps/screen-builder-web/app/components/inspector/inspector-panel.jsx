'use client'

import { useState } from 'react'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { Badge } from '@/app/components/ui/badge'
import { ChevronDown, ChevronRight } from 'lucide-react'
import ScreenInspector from './screen-inspector'
import RunTargetInspector from './run-target-inspector'

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

export default function InspectorPanel({
  selectedNodeId,
  selectedScreen,
  selectedRunTarget,
  selectedNodeUsages,
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
  if (!selectedNodeId) {
    return null
  }

  return (
    <aside className="h-full rounded-2xl border border-line bg-panel/95 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-line">
        <span className="text-[10px] text-ink-dim uppercase tracking-wider font-medium">
          {selectedScreen ? 'Inspector' : 'Logic Node'}
        </span>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3">
          {selectedScreen && (
            <ScreenInspector
              selectedScreen={selectedScreen}
              screenBuilderSpec={screenBuilderSpec}
              graphBuilderSpec={graphBuilderSpec}
              updateScreenField={updateScreenField}
              addMenuItem={addMenuItem}
              removeMenuItem={removeMenuItem}
              updateMenuItem={updateMenuItem}
              addScreenAction={addScreenAction}
              removeScreenAction={removeScreenAction}
              updateScreenAction={updateScreenAction}
              updateDrawField={updateDrawField}
              addDrawStep={addDrawStep}
              removeDrawStep={removeDrawStep}
              updateDrawStep={updateDrawStep}
              getBindingsDraft={getBindingsDraft}
              updateBindingsDraft={updateBindingsDraft}
              commitBindingsDraft={commitBindingsDraft}
              applyBindingsPreset={applyBindingsPreset}
            />
          )}

          {selectedRunTarget && (
            <RunTargetInspector selectedRunTarget={selectedRunTarget} />
          )}

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
        </div>
      </ScrollArea>
    </aside>
  )
}
