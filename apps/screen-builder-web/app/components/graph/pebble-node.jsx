import { Handle, Position } from '@xyflow/react'
import {
  SCREEN_TYPE_ICONS,
  screenUsesButtonSlots,
  screenUsesSelectDrawer,
  getScreenActions
} from '@/app/lib/constants'
import { isEntityWired, isRunConfigured, describeRunTarget, getScreenHookRuns, getScreenTimerRun } from '@/app/lib/graph-utils'
import DrawAnimationPreview from '@/app/components/draw-animation-preview'

const SLOT_TOP = {
  up: '28%',
  select: '50%',
  down: '72%'
}

function ScreenMeta({ id, previewScreen, tags }) {
  const typeIcon = SCREEN_TYPE_ICONS[previewScreen.type] || ''

  return (
    <div className="screen-node-meta">
      <div>
        <div className="screen-node-heading">
          <span className="screen-node-heading-icon">{typeIcon}</span>
          <strong>{previewScreen.title || id}</strong>
        </div>
        <div className="screen-node-id">{id}</div>
      </div>
      <div className="chip-row">
        {tags.map((tag) => (
          <span className={`chip tiny ${tag === 'entry' ? 'chip-accent' : ''}`} key={tag}>[{tag}]</span>
        ))}
      </div>
    </div>
  )
}

function MenuRows({ id, screen, items }) {
  return (
    <div className="screen-node-section">
      {items.map((item, index) => (
        <div
          className={`screen-node-row ${isEntityWired(item) ? '' : 'screen-node-row-unwired'}`}
          key={`${item.id || 'item'}-${index}`}
        >
          <div className="screen-node-row-copy">
            <strong>{item.label || item.id || `item ${index + 1}`}</strong>
            <div className={`screen-node-row-sub ${isEntityWired(item) ? '' : 'screen-node-row-sub-warning'}`}>
              {describeRunTarget(item.run)}
            </div>
          </div>
          {!isEntityWired(item) ? <span className="screen-node-alert" title="Menu item is not mapped" /> : null}
          <Handle
            type="source"
            id={`item-${item.id || index}`}
            position={Position.Right}
            className="pebble-handle row-handle"
            title="Drag this row to a screen or workflow node"
          />
        </div>
      ))}
      <button
        type="button"
        className="screen-node-inline-action"
        onClick={(event) => {
          event.stopPropagation()
          screen.onAddMenuItem?.(id)
        }}
      >
        + Add Menu Item
      </button>
    </div>
  )
}

function ScrollActionMenu({ id, screen, actions }) {
  return (
    <div className="screen-node-section">
      <div className="screen-node-row screen-node-row-drawer">
        <div className="screen-node-row-copy">
          <strong>Select Action Menu</strong>
          <div className="screen-node-row-sub">
            {actions.length > 0 ? `${actions.length} item${actions.length === 1 ? '' : 's'} linked` : 'drag from this row to create action-menu items'}
          </div>
        </div>
        <Handle
          type="source"
          id="menu-action-create"
          position={Position.Right}
          className="pebble-handle row-handle"
          title="Drag to create a scroll action-menu item"
        />
      </div>

      {actions.map((action, index) => (
        <div
          className={`screen-node-row ${isEntityWired(action) ? '' : 'screen-node-row-unwired'}`}
          key={`${action.id || 'action'}-${index}`}
        >
          <div className="screen-node-row-copy">
            <strong>{action.label || action.id || `item ${index + 1}`}</strong>
            <div className={`screen-node-row-sub ${isEntityWired(action) ? '' : 'screen-node-row-sub-warning'}`}>
              {describeRunTarget(action.run)}
            </div>
          </div>
          {!isEntityWired(action) ? <span className="screen-node-alert" title="Action-menu item is not mapped" /> : null}
          <Handle
            type="source"
            id={`action-${action.id || index}`}
            position={Position.Right}
            className="pebble-handle row-handle"
            title="Drag this action-menu item to a screen or workflow node"
          />
        </div>
      ))}

      <button
        type="button"
        className="screen-node-inline-action"
        onClick={(event) => {
          event.stopPropagation()
          screen.onAddDrawerItem?.(id)
        }}
      >
        + Add Action Menu Item
      </button>
    </div>
  )
}

function CardSlots({ actionsBySlot }) {
  const slots = [
    { slot: 'up', handleId: 'slot-up', label: 'UP' },
    { slot: 'select', handleId: 'slot-select', label: 'OK' },
    { slot: 'down', handleId: 'slot-down', label: 'DN' }
  ]

  return (
    <>
      {slots.map((slotDef) => {
        const action = actionsBySlot[slotDef.slot]
        const wired = !!action && isEntityWired(action)
        return (
          <div key={slotDef.slot}>
            <Handle
              type="source"
              id={slotDef.handleId}
              position={Position.Right}
              className={`pebble-handle slot-hit-handle ${wired ? '' : 'slot-hit-handle-unwired'}`}
              style={{ top: SLOT_TOP[slotDef.slot] }}
              title={action ? `${slotDef.slot}: ${action.label || describeRunTarget(action.run)}` : `Drag ${slotDef.slot} to a screen or workflow node`}
            />
            <div
              className={`screen-node-slot-pill-handle ${wired ? '' : 'screen-node-slot-pill-handle-unwired'}`}
              style={{ top: SLOT_TOP[slotDef.slot] }}
              aria-hidden="true"
            >
              {slotDef.label}
            </div>
          </div>
        )
      })}
    </>
  )
}

export default function PebbleNode({ data, selected, id }) {
  const tags = data.tags || []
  const screen = data.screen || {}
  const previewScreen = data.previewScreen || screen
  const isMenu = previewScreen.type === 'menu'
  const isDraw = previewScreen.type === 'draw'
  const usesButtonSlots = screenUsesButtonSlots(previewScreen)
  const usesDrawer = screenUsesSelectDrawer(previewScreen)
  const actions = getScreenActions(previewScreen)
  const bodyText = String(previewScreen.body || previewScreen.bodyTemplate || '').trim() || 'No content.'
  const items = Array.isArray(previewScreen.items) ? previewScreen.items.slice(0, 5) : []
  const actionsBySlot = actions.reduce((acc, action) => {
    if (action?.slot) acc[action.slot] = action
    return acc
  }, {})

  return (
    <div className={`screen-node-shell ${selected ? 'screen-node-shell-selected' : ''} ${usesButtonSlots ? 'screen-node-shell-card' : ''}`}>
      <Handle
        type="target"
        id="target"
        position={Position.Left}
        className="pebble-handle target-hit-handle"
        style={{ top: '50%' }}
        title="Incoming connection"
      />
      <div className="screen-node-target-pill" aria-hidden="true">BK</div>

      {usesButtonSlots ? <CardSlots actionsBySlot={actionsBySlot} /> : null}

      <div className="screen-node">
        <ScreenMeta id={id} previewScreen={previewScreen} tags={tags} />

        <div className="screen-node-preview">
          <div className="screen-node-preview-title">{previewScreen.title || id}</div>

          {previewScreen.type === 'card' ? (
            <div className="screen-node-preview-body">{bodyText}</div>
          ) : null}

          {previewScreen.type === 'scroll' ? (
            <div className="screen-node-preview-body screen-node-preview-body-scroll">{bodyText}</div>
          ) : null}

          {isDraw ? (
            <div className="screen-node-preview-draw">
              <DrawAnimationPreview screen={previewScreen} compact />
            </div>
          ) : null}

          {isMenu ? <MenuRows id={id} screen={data} items={items} /> : null}
          {usesDrawer ? <ScrollActionMenu id={id} screen={data} actions={actions} /> : null}
        </div>
      </div>

      {/* Hidden handles for lifecycle hook and timer edges */}
      {['onEnter', 'onExit'].flatMap((hookKey) =>
        getScreenHookRuns(screen, hookKey)
          .map((run, i) => ({ run, hookKey, i }))
          .filter(({ run }) => isRunConfigured(run))
          .map(({ hookKey: hk, i }) => (
            <Handle
              key={`hook-${hk}-${i}`}
              type="source"
              id={`hook-${hk}-${i}`}
              position={Position.Right}
              className="pebble-handle"
              style={{ top: '90%', opacity: 0, width: 1, height: 1 }}
            />
          ))
      )}
      {getScreenTimerRun(screen) && isRunConfigured(getScreenTimerRun(screen)) && (
        <Handle
          type="source"
          id="timer-run"
          position={Position.Right}
          className="pebble-handle"
          style={{ top: '95%', opacity: 0, width: 1, height: 1 }}
        />
      )}
    </div>
  )
}
