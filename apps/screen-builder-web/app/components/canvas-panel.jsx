'use client'

import { useMemo } from 'react'
import ReactFlow, { Background, Controls } from 'reactflow'
import 'reactflow/dist/style.css'
import '../graph.css'
import PebbleNode from './graph/pebble-node'
import RunTargetNode from './graph/run-target-node'
import CanvasEdge from './graph/canvas-edge'
import CanvasPalette from './canvas-palette'
import { isRunTargetId } from '@/app/lib/constants'

export default function CanvasPanel({
  graphBuilderSpec,
  nodes,
  edges,
  handleNodesChange,
  handleConnect,
  handleEdgesDelete,
  clearLinkByHandle,
  setFlowInstance,
  setSelectedNodeId,
  setSelectedScreenId,
  jumpPreviewTo,
  addScreen,
  addRunTargetNode,
  openCommandPalette
}) {
  const nodeTypes = useMemo(() => ({ pebble: PebbleNode, runTarget: RunTargetNode }), [])
  const edgeTypes = useMemo(() => ({ canvas: CanvasEdge }), [])

  return (
    <div className="absolute inset-0 min-w-0 min-h-0">
      <div className="absolute inset-0 overflow-hidden bg-black">
        <CanvasPalette
          graphBuilderSpec={graphBuilderSpec}
          addScreen={addScreen}
          addRunTargetNode={addRunTargetNode}
          openCommandPalette={openCommandPalette}
        />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.22 }}
          deleteKeyCode={['Backspace', 'Delete']}
          onInit={setFlowInstance}
          onNodesChange={handleNodesChange}
          onNodeClick={(_, node) => {
            setSelectedNodeId(node.id)
            if (isRunTargetId(node.id)) {
              setSelectedScreenId('')
              return
            }
            setSelectedScreenId(node.id)
            jumpPreviewTo(node.id, { resetHistory: true })
          }}
          onPaneClick={() => {
            setSelectedNodeId('')
            setSelectedScreenId('')
          }}
          onConnect={handleConnect}
          onEdgeClick={(_, edge) => {
            if (edge?.data?.source && edge?.data?.sourceHandle) {
              clearLinkByHandle(edge.data.source, edge.data.sourceHandle)
            }
          }}
          onEdgesDelete={handleEdgesDelete}
          nodesDraggable
          connectionLineStyle={{ stroke: 'var(--ring)', strokeWidth: 1.5 }}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          proOptions={{ hideAttribution: true }}
        >
          <Controls showInteractive={false} />
          <Background gap={22} size={1} color="#1f1f23" />
        </ReactFlow>
      </div>
    </div>
  )
}
