import { Handle, Position } from 'reactflow'

export default function RunTargetNode({ data, selected }) {
  return (
    <div className={`workflow-node ${selected ? 'workflow-node-selected' : ''}`}>
      <Handle
        type="target"
        id="target"
        position={Position.Left}
        className="pebble-handle target-handle"
        style={{ top: '50%' }}
        title="Connect a screen hotspot to this workflow node"
      />
      <div className="workflow-node-badge">[{data.badge}]</div>
      <div className="workflow-node-title">{data.title}</div>
      <div className="workflow-node-subtitle">{data.subtitle}</div>
      <div className="workflow-node-footer">drop screen actions here</div>
    </div>
  )
}
