'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, Workflow, LocateFixed, Monitor } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/app/components/ui/dialog'
import { RUN_TARGETS, SCREEN_TYPE_ICONS } from '@/app/lib/constants'

function CommandRow({ action, active, onSelect }) {
  const Icon = action.icon

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 border px-3 py-2 text-left font-mono text-xs uppercase tracking-[0.12em] transition-colors ${
        active
          ? 'border-ring bg-panel-soft text-ink'
          : 'border-line/70 bg-black/40 text-ink-dim hover:border-line hover:bg-panel-soft/70 hover:text-ink'
      }`}
    >
      <Icon className="size-3.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div>{action.label}</div>
        <div className="mt-1 text-[10px] tracking-[0.08em] text-ink-dim">{action.section}</div>
      </div>
      {action.shortcut ? <span className="text-[10px] text-ink-dim">{action.shortcut}</span> : null}
    </button>
  )
}

export default function CommandPalette({
  open,
  onOpenChange,
  screenIds,
  selectedNodeId,
  addScreen,
  addRunTargetNode,
  focusNode,
  resetLayout
}) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onOpenChange(!open)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpenChange, open])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setActiveIndex(0)
    }
  }, [open])

  const actions = useMemo(() => {
    const screenCreateActions = [
      {
        id: 'create:menu',
        label: `Create ${SCREEN_TYPE_ICONS.menu} Menu Screen`,
        section: 'Create Screen',
        icon: Plus,
        run: () => addScreen('menu')
      },
      {
        id: 'create:card',
        label: `Create ${SCREEN_TYPE_ICONS.card} Card Screen`,
        section: 'Create Screen',
        icon: Plus,
        run: () => addScreen('card')
      },
      {
        id: 'create:scroll',
        label: `Create ${SCREEN_TYPE_ICONS.scroll} Scroll Screen`,
        section: 'Create Screen',
        icon: Plus,
        run: () => addScreen('scroll')
      }
    ]

    const workflowActions = RUN_TARGETS.map((target) => ({
      id: `workflow:${target.id}`,
      label: `Reveal ${target.title}`,
      section: 'Workflow Node',
      icon: Workflow,
      run: () => addRunTargetNode(target.id)
    }))

    const screenJumpActions = screenIds.map((screenId) => ({
      id: `screen:${screenId}`,
      label: `Focus ${screenId}`,
      section: 'Jump To Screen',
      icon: Monitor,
      run: () => focusNode(screenId)
    }))

    return [
      ...screenCreateActions,
      ...workflowActions,
      ...screenJumpActions,
      {
        id: 'layout:reset',
        label: 'Reset Canvas Layout',
        section: 'Canvas',
        icon: LocateFixed,
        run: resetLayout,
        shortcut: selectedNodeId ? 'sel' : ''
      }
    ]
  }, [addRunTargetNode, addScreen, focusNode, resetLayout, screenIds, selectedNodeId])

  const filteredActions = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) {
      return actions
    }
    return actions.filter((action) =>
      `${action.label} ${action.section}`.toLowerCase().includes(search)
    )
  }, [actions, query])

  useEffect(() => {
    if (activeIndex >= filteredActions.length) {
      setActiveIndex(0)
    }
  }, [activeIndex, filteredActions.length])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[680px] border-line bg-panel p-0 text-ink" showCloseButton={false}>
        <DialogHeader className="border-b border-line/70 px-4 py-3">
          <DialogTitle className="font-mono text-xs uppercase tracking-[0.18em] text-ink">
            Command Palette
          </DialogTitle>
        </DialogHeader>

        <div className="border-b border-line/70 px-4 py-3">
          <label className="flex items-center gap-2 border border-line/70 bg-black px-3 py-2">
            <Search className="size-3.5 text-ink-dim" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setActiveIndex((index) => Math.min(index + 1, Math.max(filteredActions.length - 1, 0)))
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  setActiveIndex((index) => Math.max(index - 1, 0))
                } else if (event.key === 'Enter') {
                  event.preventDefault()
                  const action = filteredActions[activeIndex]
                  if (!action) return
                  action.run()
                  onOpenChange(false)
                }
              }}
              placeholder="Create screens, reveal workflow nodes, jump around..."
              className="min-w-0 flex-1 bg-transparent font-mono text-sm text-ink outline-none placeholder:text-ink-dim"
            />
          </label>
        </div>

        <div className="grid gap-2 p-3">
          {filteredActions.length === 0 ? (
            <div className="border border-line/70 bg-black px-3 py-4 font-mono text-xs uppercase tracking-[0.12em] text-ink-dim">
              No matching command
            </div>
          ) : (
            filteredActions.map((action, index) => (
              <CommandRow
                key={action.id}
                action={action}
                active={index === activeIndex}
                onSelect={() => {
                  action.run()
                  onOpenChange(false)
                }}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
