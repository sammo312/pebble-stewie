'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'

export function CreateSlotLinkDialog({
  pendingSlotLink,
  setPendingSlotLink,
  commitSlotLink,
  describeCanvasTarget,
  graphBuilderSpec
}) {
  if (!pendingSlotLink) return null

  return (
    <Dialog open={!!pendingSlotLink} onOpenChange={(open) => { if (!open) setPendingSlotLink(null) }}>
      <DialogContent className="max-w-[560px] bg-panel border-line text-ink">
        <DialogHeader>
          <DialogTitle>Create Button Action</DialogTitle>
        </DialogHeader>
        <div className="field-grid">
          <div>
            <label className="field-label">Button</label>
            <input className="field-input" value={pendingSlotLink.slot} readOnly />
          </div>
          <div>
            <label className="field-label">Target</label>
            <input className="field-input" value={describeCanvasTarget(pendingSlotLink.targetId)} readOnly />
          </div>
          <div>
            <label className="field-label">Icon</label>
            <select
              className="field-input"
              value={pendingSlotLink.icon}
              onChange={(event) => setPendingSlotLink((prev) => ({ ...prev, icon: event.target.value }))}
            >
              {graphBuilderSpec.enums.actionIcons.map((icon) => (
                <option value={icon} key={icon}>
                  {icon}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="field-label">Label</label>
            <input
              className="field-input"
              value={pendingSlotLink.label}
              onChange={(event) => setPendingSlotLink((prev) => ({ ...prev, label: event.target.value }))}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" onClick={() => commitSlotLink(pendingSlotLink)}>
            Create Action
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setPendingSlotLink(null)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function CreateMenuActionDialog({
  pendingMenuActionLink,
  setPendingMenuActionLink,
  commitMenuActionLink,
  describeCanvasTarget
}) {
  if (!pendingMenuActionLink) return null

  return (
    <Dialog open={!!pendingMenuActionLink} onOpenChange={(open) => { if (!open) setPendingMenuActionLink(null) }}>
      <DialogContent className="max-w-[560px] bg-panel border-line text-ink">
        <DialogHeader>
          <DialogTitle>Create Action Menu Item</DialogTitle>
        </DialogHeader>
        <div className="field-grid">
          <div>
            <label className="field-label">Trigger</label>
            <input className="field-input" value="select action menu" readOnly />
          </div>
          <div>
            <label className="field-label">Target</label>
            <input className="field-input" value={describeCanvasTarget(pendingMenuActionLink.targetId)} readOnly />
          </div>
          <div className="col-span-2">
            <label className="field-label">Label</label>
            <input
              className="field-input"
              value={pendingMenuActionLink.label}
              onChange={(event) => setPendingMenuActionLink((prev) => ({ ...prev, label: event.target.value }))}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" onClick={() => commitMenuActionLink(pendingMenuActionLink)}>
            Create Action Menu Item
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setPendingMenuActionLink(null)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
