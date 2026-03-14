import { Handle, Position } from 'reactflow'
import {
  SCREEN_TYPE_ICONS,
  screenUsesButtonSlots,
  screenUsesSelectDrawer,
  getScreenActions
} from '@/app/lib/constants'
import { isEntityWired, describeRunTarget } from '@/app/lib/graph-utils'

export default function PebbleNode({ data, selected, id }) {
  const tags = data.tags || []
  const screen = data.screen || {}
  const isMenu = screen.type === 'menu'
  const usesDrawer = screenUsesSelectDrawer(screen)
  const actions = getScreenActions(screen)
  const hasActionList = actions.length > 0
  const isEntry = tags.includes('entry')
  const typeIcon = SCREEN_TYPE_ICONS[screen.type] || ''
  return (
    <div className={`node-card-shell ${selected ? 'node-selected' : ''}`}>
      <Handle type="target" id="target" position={Position.Left} className="pebble-handle target-handle" style={{ top: '50%' }} title="Incoming connection" />
      {screenUsesButtonSlots(screen) && (
        <>
          <Handle type="source" id="slot-up" position={Position.Right} className="pebble-handle" style={{ top: '14%' }} title="Drag to a screen or logic node to create an UP action" />
          <Handle type="source" id="slot-select" position={Position.Right} className="pebble-handle" style={{ top: '50%' }} title="Drag to a screen or logic node to create a SELECT action" />
          <Handle type="source" id="slot-down" position={Position.Right} className="pebble-handle" style={{ top: '86%' }} title="Drag to a screen or logic node to create a DOWN action" />
        </>
      )}

      <div className={`node-card node-square ${isEntry ? 'node-entry' : ''}`}>
        <div className="node-head">
          <strong><span className="node-type-icon">{typeIcon}</span> {data.title || id}</strong>
          <div className="chip-row">
            {tags.map((tag) => (
              <span className={`chip tiny ${tag === 'entry' ? 'chip-accent' : ''}`} key={tag}>{tag}</span>
            ))}
          </div>
        </div>
        <div className="node-id">{id}</div>

        {isMenu && Array.isArray(screen.items) && (
          <div className="node-list">
            {screen.items.map((item, idx) => (
              <div className={`node-row ${isEntityWired(item) ? '' : 'node-row-unwired'}`} key={`${item.id || 'item'}-${idx}`}>
                <div>
                  <strong>{item.label || item.id || `item ${idx + 1}`}</strong>
                  <div className={`node-sub ${isEntityWired(item) ? '' : 'node-sub-warning'}`}>{describeRunTarget(item.run)}</div>
                </div>
                {!isEntityWired(item) && <span className="node-alert-dot" title="Menu item is not mapped" />}
                <Handle type="source" id={`item-${item.id || idx}`} position={Position.Right} className="pebble-handle row-handle" title="Drag to a screen for navigate, or to a logic node for another run" />
              </div>
            ))}
            <button
              type="button"
              className="node-inline-button"
              onClick={(event) => {
                event.stopPropagation()
                data.onAddMenuItem?.(id)
              }}
            >
              + Add Menu Item
            </button>
          </div>
        )}

        {usesDrawer && (
          <div className="node-list">
            <div className="node-row node-row-drawer">
              <div>
                <strong>Select Action Menu</strong>
                <div className="node-sub">
                  {hasActionList ? `${actions.length} action menu item${actions.length === 1 ? '' : 's'}` : 'drag out to add action menu items'}
                </div>
              </div>
              <Handle type="source" id="menu-action-create" position={Position.Right} className="pebble-handle row-handle" title="Drag to a screen or logic node to create a select action-menu item" />
            </div>
            <button
              type="button"
              className="node-inline-button"
              onClick={(event) => {
                event.stopPropagation()
                data.onAddDrawerItem?.(id)
              }}
            >
              + Add Action Menu Item
            </button>
          </div>
        )}

        {hasActionList && (
          <div className="node-list">
            {actions.map((action, idx) => (
              <div className={`node-row ${isEntityWired(action) ? '' : 'node-row-unwired'}`} key={`${action.id || 'action'}-${idx}`}>
                <div>
                  <strong>{action.label || action.id || `item ${idx + 1}`}</strong>
                  <div className={`node-sub ${isEntityWired(action) ? '' : 'node-sub-warning'}`}>
                    {isEntityWired(action)
                      ? describeRunTarget(action.run)
                      : usesDrawer
                        ? 'action menu item not mapped'
                        : `${action.slot || 'slot'} not mapped`}
                  </div>
                </div>
                {!isEntityWired(action) && <span className="node-alert-dot" title={usesDrawer ? 'Action menu item is not mapped' : 'Action is not mapped'} />}
                <Handle type="source" id={`action-${action.id || idx}`} position={Position.Right} className="pebble-handle row-handle" title="Drag to a screen for navigate, or to a logic node for another run" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
