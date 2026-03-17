'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, Workflow, LocateFixed, Monitor, FileBox } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle
} from '@/app/components/ui/dialog'
import { RUN_TARGETS, SCREEN_TYPE_ICONS } from '@/app/lib/constants'
import { GRAPH_TEMPLATES } from '@/app/lib/graph-templates'

function CommandRow({ action, active, onSelect }) {
  const Icon = action.icon

  return (
    <button
      type="button"
      onClick={onSelect}
      data-active={active || undefined}
      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left font-mono text-xs uppercase tracking-[0.08em] text-ink-dim transition-colors hover:bg-panel-soft hover:text-ink data-[active]:bg-panel-soft data-[active]:text-ink"
    >
      <Icon className="size-3.5 shrink-0 opacity-60" />
      <span className="min-w-0 flex-1 truncate">{action.label}</span>
      <span className="shrink-0 text-[10px] text-ink-dim/60">{action.section}</span>
    </button>
  )
}

export default function CommandPalette({
  open,
  onOpenChange,
  graphBuilderSpec,
  screenIds,
  selectedNodeId,
  addScreen,
  addRunTargetNode,
  focusNode,
  resetLayout,
  loadTemplate
}) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const allowedScreenTypes = graphBuilderSpec?.enums?.screenTypes || ['menu', 'card', 'scroll']
  const allowedRunTypes = graphBuilderSpec?.enums?.runTypes || []

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
      allowedScreenTypes.includes('menu') && {
        id: 'create:menu',
        label: `Create ${SCREEN_TYPE_ICONS.menu} Menu Screen`,
        section: 'Screen',
        icon: Plus,
        run: () => addScreen('menu')
      },
      allowedScreenTypes.includes('card') && {
        id: 'create:card',
        label: `Create ${SCREEN_TYPE_ICONS.card} Card Screen`,
        section: 'Screen',
        icon: Plus,
        run: () => addScreen('card')
      },
      allowedScreenTypes.includes('scroll') && {
        id: 'create:scroll',
        label: `Create ${SCREEN_TYPE_ICONS.scroll} Scroll Screen`,
        section: 'Screen',
        icon: Plus,
        run: () => addScreen('scroll')
      },
      allowedScreenTypes.includes('draw') && {
        id: 'create:draw',
        label: `Create ${SCREEN_TYPE_ICONS.draw} Draw Screen`,
        section: 'Screen',
        icon: Plus,
        run: () => addScreen('draw')
      },
    ].filter(Boolean)

    const workflowActions = RUN_TARGETS.filter((target) => allowedRunTypes.includes(target.runType)).map((target) => ({
      id: `workflow:${target.id}`,
      label: `Reveal ${target.title}`,
      section: 'Workflow',
      icon: Workflow,
      run: () => addRunTargetNode(target.id)
    }))

    const templateActions = GRAPH_TEMPLATES.map((template) => ({
      id: `template:${template.id}`,
      label: `${template.label}`,
      section: 'Template',
      icon: FileBox,
      run: () => loadTemplate(template.id)
    }))

    const screenJumpActions = screenIds.map((screenId) => ({
      id: `screen:${screenId}`,
      label: `Focus ${screenId}`,
      section: 'Jump',
      icon: Monitor,
      run: () => focusNode(screenId)
    }))

    return [
      ...templateActions,
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
  }, [addRunTargetNode, addScreen, allowedRunTypes, allowedScreenTypes, focusNode, loadTemplate, resetLayout, screenIds, selectedNodeId])

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
      <DialogContent className="max-w-[520px] gap-0 border-line bg-panel p-0 text-ink" showCloseButton={false}>
        <DialogTitle className="sr-only">Command Palette</DialogTitle>

        <label className="flex items-center gap-2 border-b border-line/70 px-3 py-2.5">
          <Search className="size-3.5 shrink-0 text-ink-dim" />
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
            placeholder="Type a command..."
            className="min-w-0 flex-1 bg-transparent font-mono text-sm text-ink outline-none placeholder:text-ink-dim"
          />
        </label>

        <div className="max-h-[min(50vh,320px)] overflow-y-auto py-1">
          {filteredActions.length === 0 ? (
            <div className="px-3 py-4 text-center font-mono text-xs text-ink-dim">
              No results
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
