'use client'

import { Badge } from '@/app/components/ui/badge'

function describeRunTargetInspector(target) {
  if (!target) {
    return ''
  }

  if (target.runType === 'effect') {
    return 'Use this node for native watch effects. Vibration and backlight values are configured on each linked item or action.'
  }

  if (target.runType === 'agent_prompt') {
    return 'Use this node to send user-facing prompt actions into the agent flow. The actual prompt text is configured on each linked item or action.'
  }

  if (target.runType === 'agent_command') {
    return 'Use this node to send commands into the agent flow. The command value is configured on each linked item or action.'
  }

  return target.subtitle || ''
}

export default function RunTargetInspector({ selectedRunTarget }) {
  return (
    <div className="field-grid">
      <div>
        <label className="field-label">Node</label>
        <input className="field-input" readOnly value={selectedRunTarget.title} />
      </div>
      <div>
        <label className="field-label">Run Type</label>
        <input className="field-input" readOnly value={selectedRunTarget.runType} />
      </div>
      <div className="col-span-2">
        <label className="field-label">Behavior</label>
        <textarea className="field-input area" readOnly value={describeRunTargetInspector(selectedRunTarget)} />
      </div>
    </div>
  )
}
