'use client'

import { useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Separator } from '@/app/components/ui/separator'
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
import {
  Command,
  Import,
  MoreHorizontal,
  RotateCcw,
  Trash2
} from 'lucide-react'

function ToolbarLabel({ title, help }) {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
      <span>{title}</span>
      <InfoPopover {...help} />
    </div>
  )
}

function SummaryBadges({ screenCount, edgeCount, unmappedCount, undeclaredCount, canExport }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="outline" className="border-line/80 bg-panel-soft px-1.5 py-0.5 text-[10px] text-ink-dim">
        {screenCount} screens
      </Badge>
      <Badge variant="outline" className="border-line/80 bg-panel-soft px-1.5 py-0.5 text-[10px] text-ink-dim">
        {edgeCount} links
      </Badge>
      {unmappedCount > 0 && (
        <Badge variant="destructive" className="px-1.5 py-0.5 text-[10px]">
          {unmappedCount} unmapped
        </Badge>
      )}
      {undeclaredCount > 0 && (
        <Badge variant="destructive" className="px-1.5 py-0.5 text-[10px]">
          {undeclaredCount} undeclared
        </Badge>
      )}
      <Badge variant={canExport ? 'default' : 'destructive'} className="px-1.5 py-0.5 text-[10px]">
        {canExport ? 'Valid' : 'Invalid'}
      </Badge>
    </div>
  )
}

export default function Toolbar({
  graph,
  graphBuilderSpec,
  schemaVersions,
  screenIds,
  screenOptions = [],
  edges,
  unmappedCount,
  undeclaredCount = 0,
  canExport,
  deleteSelectedScreen,
  resetLayout,
  setSchemaVersion,
  setEntryScreenId,
  setStorageNamespace,
  setShowImportExport,
  openCommandPalette
}) {
  const [overflowOpen, setOverflowOpen] = useState(false)
  const supportsStorage = graphBuilderSpec?.enums?.runTypes?.includes('store')
  const supportsStorageVar = graphBuilderSpec?.enums?.runTypes?.includes('set_var')
  const supportsHooks = (graphBuilderSpec?.hookRunFields || []).length > 0
  const supportsTimer = (graphBuilderSpec?.timerRunFields || []).length > 0
  const schemaVersionIndex = new Map(schemaVersions.map((version, index) => [version, index]))
  const entryOptions = screenOptions.length > 0
    ? screenOptions
    : screenIds.map((screenId) => ({ value: screenId, label: screenId }))
  const schemaSurface = []

  if (supportsStorageVar) {
    schemaSurface.push('Variables')
  }
  if (supportsStorage) {
    schemaSurface.push('Storage')
  }
  if (supportsHooks) {
    schemaSurface.push('Lifecycle Hooks')
  }
  if (supportsTimer) {
    schemaSurface.push('Timers')
  }

  const templateShortcuts = []
  if (supportsStorageVar) {
    templateShortcuts.push('{{var.some_key}}')
  }
  if (supportsStorage) {
    templateShortcuts.push('{{storage.some_key}}')
  }
  if (supportsTimer) {
    templateShortcuts.push('{{timer.remaining}}')
  }
  templateShortcuts.push('{{bindingName}}')
  templateShortcuts.push('{{bindingName.localString}}')

  function handleSchemaVersionChange(nextVersion) {
    if (!nextVersion || nextVersion === graph.schemaVersion) {
      return
    }

    const currentIndex = schemaVersionIndex.get(graph.schemaVersion)
    const nextIndex = schemaVersionIndex.get(nextVersion)
    const isDowngrade = typeof currentIndex === 'number' && typeof nextIndex === 'number' && nextIndex < currentIndex

    if (isDowngrade) {
      const shouldProceed =
        typeof window === 'undefined' ||
        window.confirm(`Switch to ${nextVersion}?\nDowngrading will remove workflow details not supported by this schema (hooks, timers, variables, storage links).`)

      if (shouldProceed) {
        setSchemaVersion(nextVersion)
      }
      return
    }

    setSchemaVersion(nextVersion)
  }

  function handleDeleteSelectedScreen() {
    setOverflowOpen(false)
    deleteSelectedScreen()
  }

  function handleResetLayout() {
    setOverflowOpen(false)
    resetLayout()
  }

  function handleOpenImportExport() {
    setOverflowOpen(false)
    setShowImportExport(true)
  }

  function handleOpenCommandPalette() {
    setOverflowOpen(false)
    openCommandPalette()
  }

  return (
    <header className="shrink-0 overflow-visible border-b border-line/70 bg-background/95 px-3 py-2">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">
              Stewie Builder
            </div>
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Pebble SDUI
            </div>
          </div>

          <div className="flex items-center gap-2 2xl:hidden">
            <Badge variant={canExport ? 'outline' : 'destructive'} className="px-1.5 py-0.5 text-[10px]">
              {canExport ? 'Valid' : 'Invalid'}
            </Badge>

            <Popover open={overflowOpen} onOpenChange={setOverflowOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="border-line/80 bg-card text-ink hover:bg-panel-soft"
                  title="Open toolbar menu"
                >
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                side="bottom"
                className="w-[min(92vw,24rem)] border-line bg-panel p-3 text-ink shadow-none"
              >
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-dim">
                      Graph
                    </div>
                    <SummaryBadges
                      screenCount={screenIds.length}
                      edgeCount={edges.length}
                      unmappedCount={unmappedCount}
                      undeclaredCount={undeclaredCount}
                      canExport={canExport}
                    />
                  </div>

                  {supportsStorage && (
                    <>
                      <Separator className="bg-line/70" />
                      <div className="space-y-2">
                        <ToolbarLabel
                          title="Storage"
                          help={{
                            title: 'Storage Namespace',
                            description: 'Groups persisted values for this graph in the phone runtime.',
                            bullets: [
                              'Store runs write into this namespace.',
                              'Keep it stable if you want app data to survive graph edits.'
                            ]
                          }}
                        />
                        <input
                          className="h-8 w-full rounded-none border border-line/80 bg-panel-soft px-2.5 py-1 font-mono text-xs text-ink outline-none placeholder:text-muted-foreground"
                          value={graph.storageNamespace || ''}
                          onChange={(event) => setStorageNamespace(event.target.value)}
                          placeholder="namespace"
                        />
                      </div>
                    </>
                  )}

                  <Separator className="bg-line/70" />
                  <div className="space-y-2">
                    <ToolbarLabel
                      title="Schema Surface"
                      help={{
                        title: 'Schema Surface',
                        description: 'These are contract features available under the selected schema version.',
                        bullets: [
                          'They are schema-level capabilities, not a checklist for the current screen.',
                          'Field-level options still depend on the specific inspector control.'
                        ]
                      }}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {(schemaSurface.length > 0 ? schemaSurface : ['Basic Navigation']).map((tag) => (
                        <Badge key={tag} variant="outline" className="border-line/80 bg-card text-[10px] uppercase tracking-[0.12em]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-[11px] text-ink-dim">
                      {templateShortcuts.join(' · ')}
                    </div>
                  </div>

                  <Separator className="bg-line/70" />
                  <div className="space-y-2">
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-dim">
                      Actions
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" onClick={handleOpenCommandPalette}>
                        <Command className="size-3.5" /> Command
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleResetLayout}>
                        <RotateCcw className="size-3.5" /> Reset
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleOpenImportExport}>
                        <Import className="size-3.5" /> Import/Export
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleDeleteSelectedScreen}>
                        <Trash2 className="size-3.5" /> Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-[minmax(0,18rem)_minmax(0,18rem)_minmax(0,18rem)_auto_auto] 2xl:items-center">
          <div className="flex min-w-0 items-center gap-2 rounded-md border border-line/70 bg-card/80 px-2.5 py-1.5">
            <ToolbarLabel
              title="Schema"
              help={{
                title: 'Schema Version',
                description: 'Choose which SDUI contract version this graph targets.',
                bullets: [
                  'The schema controls which screen types, run types, hooks, timers, and storage features are available.',
                  'Switching down to an older version can remove unsupported fields during migration.'
                ]
              }}
            />
            <Select value={graph.schemaVersion} onValueChange={handleSchemaVersionChange}>
              <SelectTrigger className="h-8 w-full min-w-0 flex-1 border-line/80 bg-panel-soft text-xs text-ink">
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="start"
                className="w-[var(--radix-select-trigger-width)] max-w-[24rem] border-line bg-panel"
              >
                {schemaVersions.map((version) => (
                  <SelectItem value={version} key={version}>{version}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-0 items-center gap-2 rounded-md border border-line/70 bg-card/80 px-2.5 py-1.5">
            <ToolbarLabel
              title="Entry"
              help={{
                title: 'Entry Screen',
                description: 'This is the first screen the graph loads when the app starts.',
                bullets: [
                  'The dropdown lists the current graph screens by id and title.',
                  'Changing this only changes the app start point, not existing links.'
                ]
              }}
            />
            <Select value={graph.entryScreenId} onValueChange={setEntryScreenId}>
              <SelectTrigger className="h-8 w-full min-w-0 flex-1 border-line/80 bg-panel-soft text-xs text-ink">
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="start"
                className="w-[var(--radix-select-trigger-width)] max-w-[24rem] border-line bg-panel"
              >
                {entryOptions.map((option) => (
                  <SelectItem value={option.value} key={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {supportsStorage && (
            <div className="hidden min-w-0 2xl:flex 2xl:items-center 2xl:gap-2 2xl:rounded-md 2xl:border 2xl:border-line/70 2xl:bg-card/80 2xl:px-2.5 2xl:py-1.5">
              <ToolbarLabel
                title="Storage"
                help={{
                  title: 'Storage Namespace',
                  description: 'Groups persisted values for this graph in the phone runtime.',
                  bullets: [
                    'Store runs write into this namespace.',
                    'Keep it stable if you want app data to survive graph edits.'
                  ]
                }}
              />
              <input
                className="h-8 min-w-0 flex-1 rounded-none border border-line/80 bg-panel-soft px-2.5 py-1 font-mono text-xs text-ink outline-none placeholder:text-muted-foreground"
                value={graph.storageNamespace || ''}
                onChange={(event) => setStorageNamespace(event.target.value)}
                placeholder="namespace"
              />
            </div>
          )}

          <div className="hidden 2xl:flex 2xl:items-center 2xl:justify-end">
            <div className="flex items-center gap-2 rounded-md border border-line/70 bg-card/80 px-2.5 py-1.5">
              <ToolbarLabel
                title="Graph"
                help={{
                  title: 'Graph Summary',
                  description: 'Quick health check for the current graph.',
                  bullets: [
                    'Unmapped means an item, action, hook, or timer run is incomplete.',
                    'Valid means the graph can be normalized for export under the selected schema.'
                  ]
                }}
              />
              <Separator orientation="vertical" className="mx-1 h-4 bg-line/80" />
              <SummaryBadges
                screenCount={screenIds.length}
                edgeCount={edges.length}
                unmappedCount={unmappedCount}
                undeclaredCount={undeclaredCount}
                canExport={canExport}
              />
            </div>
          </div>

          <div className="hidden 2xl:flex 2xl:items-center 2xl:justify-end">
            <div className="flex items-center gap-1.5 rounded-md border border-line/70 bg-card/80 px-2.5 py-1.5">
              <ToolbarLabel
                title="Actions"
                help={{
                  title: 'Builder Actions',
                  description: 'Utility controls for editing and moving around the graph.',
                  bullets: [
                    'Command opens the palette, Delete removes the selected screen, Reset reflows nodes, and Import/Export opens the raw graph dialog.',
                    'These controls affect the builder only and do not change schema support.'
                  ]
                }}
              />
              <Separator orientation="vertical" className="mx-1 h-4 bg-line/80" />
              <Button size="sm" variant="ghost" onClick={openCommandPalette} title="Open command palette">
                <Command className="size-3.5" /> Command
              </Button>
              <Separator orientation="vertical" className="mx-1 h-4 bg-line/80" />
              <Button size="sm" variant="ghost" onClick={deleteSelectedScreen} title="Delete selected screen">
                <Trash2 className="size-3.5" /> Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={resetLayout} title="Reset graph layout">
                <RotateCcw className="size-3.5" /> Reset
              </Button>
              <Separator orientation="vertical" className="mx-1 h-4 bg-line/80" />
              <Button size="sm" variant="ghost" onClick={() => setShowImportExport(true)} title="Open import/export dialog">
                <Import className="size-3.5" /> Import/Export
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
