'use client'

import dynamic from 'next/dynamic'
import { GripHorizontal } from 'lucide-react'
import { Badge } from '@/app/components/ui/badge'

const PebbleEmulator = dynamic(() => import('../pebble-emulator'), { ssr: false })

export default function PreviewPanel({
  previewRenderedScreen,
  previewScreen,
  previewScreenId,
  previewRevision,
  handlePreviewActionMessage,
  setNotice,
  onHandlePointerDown,
  onHandleDoubleClick
}) {
  return (
    <div className="flex flex-col items-center gap-2 border border-line/60 bg-card/70 p-3 backdrop-blur-xl">
      {onHandlePointerDown && (
        <div className="flex w-full items-center justify-between gap-2">
          <button
            type="button"
            onPointerDown={onHandlePointerDown}
            onDoubleClick={onHandleDoubleClick}
            className="tui-chrome flex cursor-grab touch-none items-center gap-1 text-ink-dim hover:text-ink active:cursor-grabbing"
            aria-label="Drag emulator"
          >
            <GripHorizontal className="size-4" />
          </button>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="border-line/80 bg-panel-soft/50 text-[10px] text-ink-dim">
              {previewScreen?.id || previewScreenId || 'none'}
            </Badge>
            <Badge variant="outline" className="border-line/80 bg-panel-soft/50 text-[10px] text-ink-dim">
              r{previewRevision}
            </Badge>
          </div>
        </div>
      )}
      <PebbleEmulator
        screen={previewRenderedScreen}
        autoboot
        activeScreenId={previewScreen?.id || previewScreenId}
        revisionLabel={previewRevision}
        onActionMessage={handlePreviewActionMessage}
        onLog={(msg) => setNotice({ type: 'success', text: msg })}
      />
      {!onHandlePointerDown && (
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="border-line/80 bg-panel-soft/50 text-[10px] text-ink-dim">
            {previewScreen?.id || previewScreenId || 'none'}
          </Badge>
          <Badge variant="outline" className="border-line/80 bg-panel-soft/50 text-[10px] text-ink-dim">
            r{previewRevision}
          </Badge>
        </div>
      )}
    </div>
  )
}
