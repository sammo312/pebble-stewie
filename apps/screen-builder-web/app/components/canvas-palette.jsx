'use client'

import { Command, Plus, Workflow } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/app/components/ui/dropdown-menu'
import { RUN_TARGETS, SCREEN_TYPE_ICONS } from '@/app/lib/constants'

export default function CanvasPalette({
  addScreen,
  addRunTargetNode,
  openCommandPalette
}) {
  return (
    <div className="pointer-events-auto absolute left-4 top-4 z-20 flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="border-line bg-black text-ink hover:bg-panel-soft">
            <Plus className="size-3.5" /> Add
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 rounded-none border-line bg-panel p-2 font-mono text-xs uppercase tracking-[0.12em]">
          <DropdownMenuLabel className="px-2 text-[10px] uppercase tracking-[0.16em] text-ink-dim">
            Screens
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem className="rounded-none" onSelect={() => addScreen('menu')}>
              {SCREEN_TYPE_ICONS.menu} Menu Screen
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-none" onSelect={() => addScreen('card')}>
              {SCREEN_TYPE_ICONS.card} Card Screen
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-none" onSelect={() => addScreen('scroll')}>
              {SCREEN_TYPE_ICONS.scroll} Scroll Screen
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator className="bg-line/70" />
          <DropdownMenuLabel className="px-2 text-[10px] uppercase tracking-[0.16em] text-ink-dim">
            Workflow
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            {RUN_TARGETS.map((target) => (
              <DropdownMenuItem
                key={target.id}
                className="rounded-none"
                onSelect={() => addRunTargetNode(target.id)}
              >
                <Workflow className="size-3.5" />
                {target.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        size="sm"
        variant="ghost"
        onClick={openCommandPalette}
        className="border-line/80 bg-black/70 text-ink-dim hover:bg-panel-soft hover:text-ink"
      >
        <Command className="size-3.5" /> Command
      </Button>
    </div>
  )
}
