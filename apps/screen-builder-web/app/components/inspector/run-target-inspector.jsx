'use client'

import InfoPopover from '@/app/components/ui/info-popover'

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

  if (target.runType === 'set_var') {
    return 'Use this node to update session variables in the phone runtime. Variable key and mutation value are configured on each linked item or action.'
  }

  if (target.runType === 'store') {
    return 'Use this node to persist string values in phone local storage. Storage key and value template are configured on each linked item or action.'
  }

  return target.subtitle || ''
}

function InspectorLabel({ title, help }) {
  return (
    <div className="field-label">
      <span>{title}</span>
      {help ? <InfoPopover {...help} /> : null}
    </div>
  )
}

export default function RunTargetInspector({ selectedRunTarget, graphReferenceCatalog }) {
  const referenceBullets =
    selectedRunTarget?.runType === 'set_var'
      ? (graphReferenceCatalog?.variableKeys || []).length > 0
        ? [`Existing variables in this graph: ${graphReferenceCatalog.variableKeys.join(', ')}`]
        : ['No variable keys are in use yet. The first linked action can define one.']
      : selectedRunTarget?.runType === 'store'
        ? (graphReferenceCatalog?.storageKeys || []).length > 0
          ? [`Existing storage keys in this graph: ${graphReferenceCatalog.storageKeys.join(', ')}`]
          : ['No storage keys are in use yet. The first linked action can define one.']
        : []

  return (
    <div className="field-grid">
      <div>
        <InspectorLabel
          title="Node"
          help={{
            title: 'Logic Node',
            description: 'This is the reusable canvas target linked by actions, hooks, or timers.'
          }}
        />
        <input className="field-input" readOnly value={selectedRunTarget.title} />
      </div>
      <div>
        <InspectorLabel
          title="Run Type"
          help={{
            title: 'Run Type',
            description: 'The schema decides which run types are available in the builder.',
            bullets: ['Linking to this node sets the linked action or hook to this run type.']
          }}
        />
        <input className="field-input" readOnly value={selectedRunTarget.runType} />
      </div>
      <div className="col-span-2">
        <InspectorLabel
          title="Behavior"
          help={{
            title: 'Behavior',
            description: 'High-level explanation of what linked actions or hooks do when pointed at this node.',
            bullets: referenceBullets
          }}
        />
        <textarea className="field-input area" readOnly value={describeRunTargetInspector(selectedRunTarget)} />
      </div>
    </div>
  )
}
