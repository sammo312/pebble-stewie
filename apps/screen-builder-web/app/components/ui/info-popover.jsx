'use client'

import { CircleHelp } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { Button } from '@/app/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/app/components/ui/popover'

export default function InfoPopover({
  title,
  description,
  bullets = [],
  buttonClassName,
  contentClassName,
  align = 'start',
  side = 'bottom'
}) {
  if (!title && !description && (!bullets || bullets.length === 0)) {
    return null
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className={cn(
            'h-4 w-4 border-line/70 bg-panel-soft/70 p-0 text-ink-dim hover:bg-panel-soft hover:text-ink',
            buttonClassName
          )}
          aria-label={title ? `More info about ${title}` : 'More info'}
        >
          <CircleHelp className="size-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        className={cn('w-80 border-line bg-panel p-3 text-ink shadow-none', contentClassName)}
      >
        {title ? (
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink">
            {title}
          </div>
        ) : null}
        {description ? (
          <p className="mt-1 text-xs leading-5 text-ink-dim">
            {description}
          </p>
        ) : null}
        {bullets.length > 0 ? (
          <ul className="mt-2 space-y-1.5 pl-4 text-xs leading-5 text-ink-dim">
            {bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
