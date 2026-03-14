import { BaseEdge, EdgeLabelRenderer, getBezierPath } from 'reactflow'

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
  const curvature = 0.22 + Math.min(Math.abs(laneOffset) / 180, 0.16)
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY: adjustedSourceY,
    sourcePosition,
    targetX,
    targetY: adjustedTargetY,
    targetPosition,
    curvature
  })

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} interactionWidth={28} />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="edge-label"
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
