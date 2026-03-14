'use client'

import { useMemo } from 'react'
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow'
import 'reactflow/dist/style.css'
import '../graph.css'
import PebbleNode from './graph/pebble-node'
import RunTargetNode from './graph/run-target-node'
import CanvasEdge from './graph/canvas-edge'
import { isRunTargetId } from '@/app/lib/constants'

export default function CanvasPanel({
  nodes,
  edges,
  handleNodesChange,
  handleConnect,
  handleEdgesDelete,
  clearLinkByHandle,
  setFlowInstance,
  setSelectedNodeId,
  setSelectedScreenId,
  jumpPreviewTo
}) {
  const nodeTypes = useMemo(() => ({ pebble: PebbleNode, runTarget: RunTargetNode }), [])
  const edgeTypes = useMemo(() => ({ canvas: CanvasEdge }), [])

  return (
    <div className="absolute inset-0 min-w-0 min-h-0">
      <div className="absolute inset-0 overflow-hidden bg-[rgba(8,12,20,0.92)]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          deleteKeyCode={['Backspace', 'Delete']}
          onInit={setFlowInstance}
          onNodesChange={handleNodesChange}
          onNodeClick={(_, node) => {
            setSelectedNodeId(node.id)
            if (isRunTargetId(node.id)) {
              return
            }
            setSelectedScreenId(node.id)
            jumpPreviewTo(node.id, { resetHistory: true })
          }}
          onPaneClick={() => setSelectedNodeId('')}
          onConnect={handleConnect}
          onEdgeClick={(_, edge) => {
            if (edge?.data?.source && edge?.data?.sourceHandle) {
              clearLinkByHandle(edge.data.source, edge.data.sourceHandle)
            }
          }}
          onEdgesDelete={handleEdgesDelete}
          nodesDraggable
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          proOptions={{ hideAttribution: true }}
        >
          <MiniMap pannable zoomable />
          <Controls showInteractive={false} />
          <Background gap={22} size={1} color="#2d456d" />
        </ReactFlow>
      </div>
    </div>
  )
}
