'use client';

import { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css'; // Important for React Flow styles!

import BatteryNode from '@/components/nodes/BatteryNode';
import LEDNode from '@/components/nodes/LEDNode';

// Map our custom components
const nodeTypes = {
  battery: BatteryNode,
  led: LEDNode,
};

// Define starting components on the board
const initialNodes: Node[] = [
  {
    id: 'batt-1',
    type: 'battery',
    position: { x: 250, y: 100 },
    data: { voltage: 9 },
  },
  {
    id: 'led-1',
    type: 'led',
    position: { x: 250, y: 300 },
    data: { isOn: false },
  },
];

export default function CircuitSimulator() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>([]);

  // Handle dragging components around
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  // Handle deleting wires
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  // Handle drawing wires between components
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    []
  );

  return (
    <main className="w-screen h-screen flex flex-col bg-gray-50">
      <header className="p-4 bg-white border-b shadow-sm z-10 flex justify-between items-center">
        <h1 className="font-bold text-xl text-gray-800">Circuit Simulator Canvas</h1>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
          Simulate (Coming Soon)
        </button>
      </header>
      
      <div className="flex-grow w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </main>
  );
}