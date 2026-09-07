'use client';

import { useCallback, useState, useRef } from 'react';
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
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import BatteryNode from '@/components/nodes/BatteryNode';
import LEDNode from '@/components/nodes/LEDNode';
import ResistorNode from '@/components/nodes/ResistorNode';
import SwitchNode from '@/components/nodes/SwitchNode';
import TransistorNode from '@/components/nodes/TransistorNode';
import SpeakerNode from '@/components/nodes/SpeakerNode';
import LDRNode from '@/components/nodes/LDRNode';
import Sidebar from '@/components/Sidebar';

const nodeTypes = {
  battery: BatteryNode,
  led: LEDNode,
  resistor: ResistorNode,
  switch: SwitchNode,
  transistor: TransistorNode,
  speaker: SpeakerNode,
  ldr: LDRNode,
};

let idCount = 0;
const getId = () => `node_${idCount++}`;

function CircuitFlow() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [currentReadout, setCurrentReadout] = useState<number | null>(null);

  const handleVoltageChange = (id: string, newVoltage: number) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, voltage: newVoltage } } : n)));
  };

  const handleResistanceChange = (id: string, newResistance: number) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, resistance: newResistance } } : n)));
  };

  const handleToggleSwitch = (id: string) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, isOpen: !n.data.isOpen } } : n)));
  };

  const handleLightChange = (id: string, val: number) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, lightLevel: val } } : n)));
  };

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)), []);

  // WIRE REMOVAL: Clicking any wire instantly deletes it!
  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setEdges((eds) => eds.filter((e) => e.id !== edge.id));
  }, []);

  // DRAG AND DROP HANDLERS
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: {
          voltage: 9,
          resistance: 330,
          isOpen: true,
          lightLevel: 50,
          status: 'OFF',
          onChangeVoltage: handleVoltageChange,
          onChangeResistance: handleResistanceChange,
          onToggleSwitch: handleToggleSwitch,
          onChangeLight: handleLightChange,
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition]
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
      console.error('Simulation error:', error);
    }
  };

  return (
    <main className="w-screen h-screen flex bg-gray-50 overflow-hidden">
      <Sidebar />
      
      <div className="flex-grow h-full flex flex-col">
        <header className="p-4 bg-white border-b shadow-sm z-10 flex justify-between items-center">
          <div>
            <h1 className="font-bold text-xl text-gray-800">Circuit Engineering Studio</h1>
            {currentReadout !== null && (
              <p className="text-xs text-gray-600 font-mono mt-0.5">
                Current Readout: <span className="font-bold text-blue-600">{currentReadout} mA</span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEdges([])}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-200 border"
            >
              Clear All Wires
            </button>
            <button
              onClick={runSimulation}
              className="px-5 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              Run Simulation
            </button>
          </div>
        </header>

        <div className="flex-grow w-full h-full" ref={reactFlowWrapper}>
<ReactFlow
  nodes={nodes}
  edges={edges}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
  onConnect={onConnect}
  onEdgeClick={onEdgeClick}
  onDrop={onDrop}
  onDragOver={onDragOver}
  nodeTypes={nodeTypes}
  isValidConnection={() => true} // Allows any terminal to connect to any other terminal!
  fitView
>
  <Background />
  <Controls />
</ReactFlow>
        </div>
      </div>
    </main>
  );
}

export default function CircuitSimulator() {
  return (
    <ReactFlowProvider>
      <CircuitFlow />
    </ReactFlowProvider>
  );
}