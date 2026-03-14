'use client'

import dynamic from 'next/dynamic'
import { Badge } from '@/app/components/ui/badge'

const PebbleEmulator = dynamic(() => import('../pebble-emulator'), { ssr: false })

export default function PreviewPanel({
  previewRenderedScreen,
  previewScreen,
  previewScreenId,
  previewRevision,
  handlePreviewActionMessage,
  setNotice
}) {
  return (
    <section className="rounded-2xl border border-line bg-panel/95 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <div className="flex items-center justify-between w-full px-3 py-2 border-b border-line">
        <span className="text-[10px] text-ink-dim uppercase tracking-wider font-medium">Preview</span>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-[9px] h-4 border-line text-ink-dim px-1">
            {previewScreen?.id || 'none'}
          </Badge>
          <Badge variant="outline" className="text-[9px] h-4 border-line text-ink-dim px-1">
            {previewRevision}
          </Badge>
        </div>
      </div>
      <div className="flex items-center justify-center p-3">
        <PebbleEmulator
          screen={previewRenderedScreen}
          autoboot
          activeScreenId={previewScreen?.id || previewScreenId}
          revisionLabel={previewRevision}
          onActionMessage={handlePreviewActionMessage}
          onLog={(msg) => setNotice({ type: 'success', text: msg })}
        />
      </div>
    </section>
  )
}
