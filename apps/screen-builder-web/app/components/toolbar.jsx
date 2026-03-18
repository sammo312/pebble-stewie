'use client'

import { useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from '@/app/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/app/components/ui/select'
import {
  ChevronDown,
  Import,
  RotateCcw,
  Search,
  Settings2,
  Trash2
} from 'lucide-react'

export default function Toolbar({
  graph,
  graphBuilderSpec,
  screenIds,
  screenOptions = [],
  edges,
  unmappedCount,
  undeclaredCount = 0,
  canExport,
  deleteSelectedScreen,
  resetLayout,
  setEntryScreenId,
  setStorageNamespace,
  setShowImportExport,
  openCommandPalette
}) {
  const [graphMenuOpen, setGraphMenuOpen] = useState(false)
  const supportsStorage = graphBuilderSpec?.enums?.runTypes?.includes('store')
  const entryOptions = screenOptions.length > 0
    ? screenOptions
    : screenIds.map((screenId) => ({ value: screenId, label: screenId }))

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line/70 bg-background/95 px-3">
      <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">
        Stewie
      </div>

      <button
        type="button"
        onClick={openCommandPalette}
        className="ml-1 flex h-7 min-w-0 flex-1 items-center gap-2 border border-line/70 bg-card/60 px-2.5 font-mono text-[11px] text-ink-dim transition-colors hover:border-line hover:bg-card hover:text-ink sm:max-w-xs md:max-w-sm"
      >
        <Search className="size-3 shrink-0 opacity-50" />
        <span className="hidden truncate sm:inline">Search or command...</span>
        <span className="truncate sm:hidden">Search...</span>
        <kbd className="ml-auto hidden shrink-0 border border-line/70 bg-panel-soft px-1 py-px text-[10px] text-ink-dim sm:inline-block">
          ⌘K
        </kbd>
      </button>

      <div className="flex items-center gap-1">
        {!canExport && (
          <Badge variant="destructive" className="hidden px-1.5 py-0.5 text-[10px] sm:inline-flex">
            Invalid
          </Badge>
        )}
        {unmappedCount > 0 && (
          <Badge variant="destructive" className="hidden px-1.5 py-0.5 text-[10px] sm:inline-flex">
            {unmappedCount} unmapped
          </Badge>
        )}

        <DropdownMenu open={graphMenuOpen} onOpenChange={setGraphMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-[11px] text-ink-dim hover:text-ink"
            >
              <Settings2 className="size-3.5" />
              <span className="hidden sm:inline">Graph</span>
              <ChevronDown className="size-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-72 rounded-none border-line bg-panel p-0 font-mono text-xs"
          >
            <div className="space-y-3 p-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-dim">
                  Schema Version
                </label>
                <div className="flex h-7 items-center justify-between border border-line/80 bg-panel-soft px-2 text-xs text-ink">
                  <span>{graph.schemaVersion}</span>
                  <Badge variant="outline" className="h-4 rounded-none border-line/80 bg-card/70 px-1 text-[9px] text-ink-dim">
                    latest only
                  </Badge>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-dim">
                  Entry Screen
                </label>
                <Select value={graph.entryScreenId} onValueChange={setEntryScreenId}>
                  <SelectTrigger className="h-7 w-full border-line/80 bg-panel-soft text-xs text-ink">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    align="start"
                    className="w-[var(--radix-select-trigger-width)] border-line bg-panel"
                  >
                    {entryOptions.map((option) => (
                      <SelectItem value={option.value} key={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {supportsStorage && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-dim">
                    Storage Namespace
                  </label>
                  <input
                    className="h-7 w-full border border-line/80 bg-panel-soft px-2 font-mono text-xs text-ink outline-none placeholder:text-muted-foreground focus:border-ring"
                    value={graph.storageNamespace || ''}
                    onChange={(event) => setStorageNamespace(event.target.value)}
                    placeholder="namespace"
                  />
                </div>
              )}
            </div>

            <DropdownMenuSeparator className="bg-line/70" />

            <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
              <span className="text-[10px] text-ink-dim">{screenIds.length} screens</span>
              <span className="text-[10px] text-ink-dim">·</span>
              <span className="text-[10px] text-ink-dim">{edges.length} links</span>
              {undeclaredCount > 0 && (
                <>
                  <span className="text-[10px] text-ink-dim">·</span>
                  <span className="text-[10px] text-destructive">{undeclaredCount} undeclared</span>
                </>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-[11px] text-ink-dim hover:text-ink"
            >
              <span className="hidden sm:inline">Edit</span>
              <ChevronDown className="size-3 opacity-50 sm:inline hidden" />
              <span className="sm:hidden text-[11px]">···</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-52 rounded-none border-line bg-panel font-mono text-xs uppercase tracking-[0.08em]"
          >
            <DropdownMenuItem
              className="rounded-none"
              onSelect={deleteSelectedScreen}
            >
              <Trash2 className="size-3.5" />
              Delete Screen
              <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="rounded-none"
              onSelect={resetLayout}
            >
              <RotateCcw className="size-3.5" />
              Reset Layout
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-line/70" />
            <DropdownMenuItem
              className="rounded-none"
              onSelect={() => setShowImportExport(true)}
            >
              <Import className="size-3.5" />
              Import / Export
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
