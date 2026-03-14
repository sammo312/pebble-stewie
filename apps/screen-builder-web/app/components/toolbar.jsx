'use client'

import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Separator } from '@/app/components/ui/separator'
import { Card } from '@/app/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/app/components/ui/select'
import { Command, Import, RotateCcw, Trash2 } from 'lucide-react'

export default function Toolbar({
  graph,
  screenIds,
  edges,
  unmappedCount,
  canExport,
  deleteSelectedScreen,
  resetLayout,
  setEntryScreenId,
  setShowImportExport,
  openCommandPalette
}) {
  return (
    <header className="shrink-0 border-b border-line/70 bg-background/95 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[10rem] pr-2">
          <div>
            <div className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-foreground">Stewie // Builder</div>
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Pebble SDUI Editor</div>
          </div>
        </div>

        <Card className="flex min-w-[13rem] flex-1 items-center gap-3 border-line/80 bg-card px-3 py-2 shadow-none">
          <div className="min-w-0">
            <div className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">[Entry]</div>
          </div>
          <Select value={graph.entryScreenId} onValueChange={setEntryScreenId}>
            <SelectTrigger className="h-8 min-w-[10rem] flex-1 border-line/80 bg-panel-soft text-xs text-ink">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {screenIds.map((id) => (
                <SelectItem value={id} key={id}>{id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Card className="flex items-center gap-1.5 border-line/80 bg-card px-2.5 py-2 shadow-none">
            <Badge variant="outline" className="border-line/80 bg-panel-soft text-[10px] text-ink-dim">
              {screenIds.length} screens
            </Badge>
            <Badge variant="outline" className="border-line/80 bg-panel-soft text-[10px] text-ink-dim">
              {edges.length} links
            </Badge>
            {unmappedCount > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {unmappedCount} unmapped
              </Badge>
            )}
            <Separator orientation="vertical" className="mx-1 h-5 bg-line/80" />
            <Badge variant={canExport ? 'default' : 'destructive'} className="text-[10px]">
              {canExport ? 'Valid' : 'Invalid'}
            </Badge>
          </Card>

          <Card className="flex items-center gap-1.5 border-line/80 bg-card px-2.5 py-2 shadow-none">
            <Button size="sm" variant="ghost" onClick={openCommandPalette}>
              <Command className="size-3.5" /> Command
            </Button>
            <Separator orientation="vertical" className="mx-1 h-5 bg-line/80" />
            <Button size="sm" variant="ghost" onClick={deleteSelectedScreen}>
              <Trash2 className="size-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={resetLayout}>
              <RotateCcw className="size-3.5" />
            </Button>
            <Separator orientation="vertical" className="mx-1 h-5 bg-line/80" />
            <Button size="sm" variant="ghost" onClick={() => setShowImportExport(true)}>
              <Import className="size-3.5" /> Import / Export
            </Button>
          </Card>
        </div>
      </div>
    </header>
  )
}
