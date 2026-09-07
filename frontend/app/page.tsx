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
import '@xyflow/react/dist/style.css';

import BatteryNode from '@/components/nodes/BatteryNode';
import LEDNode from '@/components/nodes/LEDNode';
import ResistorNode from '@/components/nodes/ResistorNode';

const nodeTypes = {
  battery: BatteryNode,
  led: LEDNode,
  resistor: ResistorNode,
};

export default function CircuitSimulator() {
  const [currentReadout, setCurrentReadout] = useState<number | null>(null);

  const handleVoltageChange = (id: string, newVoltage: number) => {
    setNodes((nds) =>
      nds.map((node) => (node.id === id ? { ...node, data: { ...node.data, voltage: newVoltage } } : node))
    );
  };

  const handleResistanceChange = (id: string, newResistance: number) => {
    setNodes((nds) =>
      nds.map((node) => (node.id === id ? { ...node, data: { ...node.data, resistance: newResistance } } : node))
    );
  };

  const initialNodes: Node[] = [
    {
      id: 'batt-1',
      type: 'battery',
      position: { x: 100, y: 150 },
      data: { voltage: 9, onChangeVoltage: handleVoltageChange },
    },
    {
      id: 'res-1',
      type: 'resistor',
      position: { x: 300, y: 50 },
      data: { resistance: 330, onChangeResistance: handleResistanceChange },
    },
    {
      id: 'led-1',
      type: 'led',
      position: { x: 500, y: 150 },
      data: { status: 'OFF' },
    },
  ];

  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>([]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    []
  );

  const runSimulation = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges }),
      });

      const result = await response.json();
      setCurrentReadout(result.current_mA);

      setNodes((nds) =>
        nds.map((node) => {
          if (node.type === 'led') {
            return { ...node, data: { ...node.data, status: result.led_status } };
          }
          return node;
        })
      );
    } catch (error) {
      console.error('Simulation failed:', error);
    }
  };

  return (
    <main className="w-screen h-screen flex flex-col bg-gray-50">
      <header className="p-4 bg-white border-b shadow-sm z-10 flex justify-between items-center">
        <div>
          <h1 className="font-bold text-xl text-gray-800">Circuit Physics Simulator</h1>
          {currentReadout !== null && (
            <p className="text-xs text-gray-600 font-mono mt-0.5">
              Calculated Current: <span className="font-bold text-blue-600">{currentReadout} mA</span>
            </p>
          )}
        </div>
        <button
          onClick={runSimulation}
          className="px-5 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          Run Simulation
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