import { StepEdge } from '@xyflow/react'

export default function CanvasEdge(props) {
  const focused = !!props.data?.focused
  const labelVisible = typeof props.label === 'string' && props.label.length > 0

  return (
    <StepEdge
      {...props}
      labelStyle={{
        fill: focused ? 'var(--ink)' : 'var(--ink-dim)',
        fontSize: 10,
        fontFamily: 'IBM Plex Mono, Menlo, monospace',
        letterSpacing: '0.08em'
      }}
      labelShowBg={labelVisible}
      labelBgStyle={{
        fill: '#050505',
        stroke: 'none'
      }}
      labelBgPadding={[4, 2]}
      labelBgBorderRadius={0}
      pathOptions={{ offset: 18 }}
    />
  )
}
