'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Copy, Download, Upload, RotateCcw } from 'lucide-react'

export default function ImportExportDialog({
  open,
  onOpenChange,
  importText,
  setImportText,
  normalizedExportText,
  canExport,
  handleImport,
  handleCopyExport,
  handleDownloadExport,
  loadCurrentIntoImportBox
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] bg-panel border-line text-ink">
        <DialogHeader>
          <DialogTitle>Import / Export</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Import</label>
            <textarea
              className="field-input area tall"
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder="Paste screen graph JSON here"
            />
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={() => { handleImport(); onOpenChange(false) }}>
                <Upload className="size-3" /> Import
              </Button>
              <Button size="sm" variant="secondary" onClick={loadCurrentIntoImportBox}>
                <RotateCcw className="size-3" /> Load Current
              </Button>
            </div>
          </div>

          <div>
            <label className="field-label">Export</label>
            <textarea
              className="field-input area tall"
              readOnly
              value={normalizedExportText || '// Fix errors before export'}
            />
            <div className="flex gap-2 mt-2">
              <Button size="sm" disabled={!canExport} onClick={handleCopyExport}>
                <Copy className="size-3" /> Copy
              </Button>
              <Button size="sm" disabled={!canExport} onClick={handleDownloadExport}>
                <Download className="size-3" /> Download JSON
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
