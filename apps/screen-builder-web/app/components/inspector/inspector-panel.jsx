'use client'

import { useState } from 'react'
import { ScrollArea } from '@/app/components/ui/scroll-area'
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
  screenBuilderSpec,
  graphBuilderSpec,
  updateScreenField,
  addMenuItem,
  removeMenuItem,
  updateMenuItem,
  addScreenAction,
  removeScreenAction,
  updateScreenAction,
  getBindingsDraft,
  updateBindingsDraft,
  commitBindingsDraft,
  applyBindingsPreset
}) {
  if (!selectedNodeId) {
    return null
  }

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden border-line/80 bg-card shadow-none">
      <CardHeader className="gap-2 border-b border-line/70 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-ink">
              {selectedScreen ? '[ Screen Inspector ]' : '[ Logic Node ]'}
            </CardTitle>
            <CardDescription>
              {selectedScreen
                ? 'Edit the selected screen and inspect linked actions.'
                : 'Inspect the selected workflow target and inbound links.'}
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-line/80 bg-panel-soft text-[10px] text-ink-dim">
            {selectedNodeId}
          </Badge>
        </div>
      </CardHeader>
      <ScrollArea className="min-h-0 flex-1">
        <CardContent className="p-4">
          {selectedScreen && (
            <ScreenInspector
              selectedScreen={selectedScreen}
              screenIds={screenIds}
              screenBuilderSpec={screenBuilderSpec}
              graphBuilderSpec={graphBuilderSpec}
              updateScreenField={updateScreenField}
              addMenuItem={addMenuItem}
              removeMenuItem={removeMenuItem}
              updateMenuItem={updateMenuItem}
              addScreenAction={addScreenAction}
              removeScreenAction={removeScreenAction}
              updateScreenAction={updateScreenAction}
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
        </CardContent>
      </ScrollArea>
    </Card>
  )
}
