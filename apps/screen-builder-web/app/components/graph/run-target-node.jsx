import { Handle, Position } from 'reactflow'

export default function RunTargetNode({ data }) {
  return (
    <div className="run-target-node">
      <Handle
        type="target"
        id="target"
        position={Position.Left}
        className="pebble-handle target-handle"
        style={{ top: '50%' }}
        title="Connect a menu item or action to this logic node"
      />
      <div className="run-target-badge">{data.badge}</div>
      <strong>{data.title}</strong>
      <div className="run-target-sub">{data.subtitle}</div>
    </div>
  )
}
