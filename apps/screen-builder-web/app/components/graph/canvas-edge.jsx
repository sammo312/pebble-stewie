import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from 'reactflow'

export default function CanvasEdge(props) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
    style,
    label,
    data
  } = props

  const laneCount = Number(data?.laneCount || 1)
  const laneIndex = Number(data?.laneIndex || 0)
  const center = (laneCount - 1) / 2
  const laneOffset = (laneIndex - center) * 24
  const adjustedSourceY = sourceY + laneOffset * 0.28
  const adjustedTargetY = targetY - laneOffset * 0.28
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY: adjustedSourceY,
    sourcePosition,
    targetX,
    targetY: adjustedTargetY,
    targetPosition,
    borderRadius: 12,
    offset: 28 + Math.abs(laneOffset) * 0.2
  })
  const edgeToneClass = data?.focused ? 'edge-label-active' : 'edge-label-muted'

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} interactionWidth={28} />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className={`edge-label ${edgeToneClass}`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + laneOffset * 0.22}px)`
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}
