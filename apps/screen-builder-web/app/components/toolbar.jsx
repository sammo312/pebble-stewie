'use client'

import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Separator } from '@/app/components/ui/separator'
import { SCREEN_TYPE_ICONS, RUN_TARGETS } from '@/app/lib/constants'
import {
  Import,
  Download,
  Plus,
  Trash2,
  RotateCcw,
  Workflow
} from 'lucide-react'

export default function Toolbar({
  graph,
  screenIds,
  edges,
  unmappedCount,
  canExport,
  newNodeType,
  setNewNodeType,
  newRunTargetId,
  setNewRunTargetId,
  addScreen,
  addRunTargetNode,
  deleteSelectedScreen,
  resetLayout,
  setEntryScreenId,
  setShowImportExport
}) {
  return (
    <header className="flex h-9 items-center gap-1.5 px-3 border-b border-line bg-panel shrink-0">
      <span className="text-accent font-bold text-xs tracking-widest uppercase mr-1">stewie</span>
      <Separator orientation="vertical" className="h-4 bg-line" />

      <div className="flex items-center gap-1 ml-1">
        <label className="text-[10px] text-ink-dim uppercase tracking-wider">entry</label>
        <select
          className="h-6 rounded bg-panel-soft border border-line text-ink text-xs px-1.5 outline-none focus:border-accent"
          value={graph.entryScreenId}
          onChange={(e) => setEntryScreenId(e.target.value)}
        >
          {screenIds.map((id) => (
            <option value={id} key={id}>{id}</option>
          ))}
        </select>
      </div>

      <Separator orientation="vertical" className="h-4 bg-line" />

      <div className="flex items-center gap-1">
        <select
          className="h-6 rounded bg-panel-soft border border-line text-ink text-xs px-1.5 outline-none focus:border-accent"
          value={newNodeType}
          onChange={(e) => setNewNodeType(e.target.value)}
        >
          <option value="menu">{SCREEN_TYPE_ICONS.menu} Menu</option>
          <option value="card">{SCREEN_TYPE_ICONS.card} Card</option>
          <option value="scroll">{SCREEN_TYPE_ICONS.scroll} Scroll</option>
        </select>
        <Button size="xs" onClick={() => addScreen(newNodeType)}>
          <Plus className="size-3" /> Screen
        </Button>
      </div>

      <div className="flex items-center gap-1">
        <select
          className="h-6 rounded bg-panel-soft border border-line text-ink text-xs px-1.5 outline-none focus:border-accent"
          value={newRunTargetId}
          onChange={(e) => setNewRunTargetId(e.target.value)}
        >
          {RUN_TARGETS.map((t) => (
            <option value={t.id} key={t.id}>{t.title}</option>
          ))}
        </select>
        <Button size="xs" variant="secondary" onClick={() => addRunTargetNode(newRunTargetId)}>
          <Workflow className="size-3" /> Logic
        </Button>
      </div>

      <Button size="xs" variant="ghost" onClick={deleteSelectedScreen}>
        <Trash2 className="size-3" />
      </Button>
      <Button size="xs" variant="ghost" onClick={resetLayout}>
        <RotateCcw className="size-3" />
      </Button>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="text-[10px] h-5 border-line text-ink-dim">
          {screenIds.length} screens
        </Badge>
        <Badge variant="outline" className="text-[10px] h-5 border-line text-ink-dim">
          {edges.length} links
        </Badge>
        {unmappedCount > 0 && (
          <Badge variant="destructive" className="text-[10px] h-5">
            {unmappedCount} unmapped
          </Badge>
        )}
      </div>

      <Separator orientation="vertical" className="h-4 bg-line" />

      <Button size="xs" variant="ghost" onClick={() => setShowImportExport(true)}>
        <Import className="size-3" /> Import/Export
      </Button>

      <Badge
        variant={canExport ? 'default' : 'destructive'}
        className="text-[10px] h-5"
      >
        {canExport ? 'Valid' : 'Invalid'}
      </Badge>
    </header>
  )
}
