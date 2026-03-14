'use client'

import dynamic from 'next/dynamic'
import { Badge } from '@/app/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader
} from '@/app/components/ui/card'

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
    <Card className="overflow-hidden border-line/80 bg-card shadow-none">
      <CardHeader className="gap-2 border-b border-line/70 px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onPointerDown={onHandlePointerDown}
            onDoubleClick={onHandleDoubleClick}
            className="tui-chrome cursor-grab touch-none border border-line/80 bg-panel-soft px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-dim active:cursor-grabbing"
            aria-label="Drag emulator"
          >
            ::::
          </button>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="border-line/80 bg-panel-soft text-[10px] text-ink-dim">
              scr {previewScreen?.id || previewScreenId || 'none'}
            </Badge>
            <Badge variant="outline" className="border-line/80 bg-panel-soft text-[10px] text-ink-dim">
              rev {previewRevision}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-center p-4">
        <PebbleEmulator
          screen={previewRenderedScreen}
          autoboot
          activeScreenId={previewScreen?.id || previewScreenId}
          revisionLabel={previewRevision}
          onActionMessage={handlePreviewActionMessage}
          onLog={(msg) => setNotice({ type: 'success', text: msg })}
        />
      </CardContent>
    </Card>
  )
}
