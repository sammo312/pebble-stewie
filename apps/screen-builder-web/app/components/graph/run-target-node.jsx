import { Handle, Position } from '@xyflow/react'

export default function RunTargetNode({ data, selected }) {
  const usageSummary = data.usageSummary || {}
  const usageLines = usageSummary.lines || []
  const hasUsages = (usageSummary.count || 0) > 0

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
      <div className="workflow-node-subtitle">
        {hasUsages ? `Connected by ${usageSummary.count} ${usageSummary.count === 1 ? 'action' : 'actions'}` : data.subtitle}
      </div>
      {hasUsages && (
        <div className="mt-2 grid gap-1">
          {usageLines.map((summary, index) => (
            <div key={`${summary}-${index}`} className="text-[0.58rem] leading-tight text-ink-dim uppercase tracking-[0.08em]">
              {summary}
            </div>
          ))}
          {usageSummary.remaining > 0 && (
            <div className="text-[0.58rem] leading-tight text-ink-dim uppercase tracking-[0.08em]">
              +{usageSummary.remaining} more
            </div>
          )}
        </div>
      )}
      <div className="workflow-node-footer">drop screen actions here</div>
    </div>
  )
}
