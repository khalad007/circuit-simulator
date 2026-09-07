'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
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
import PushButtonNode from '@/components/nodes/PushButtonNode';
import CapacitorNode from '@/components/nodes/CapacitorNode';
import TransistorNode from '@/components/nodes/TransistorNode';
import SpeakerNode from '@/components/nodes/SpeakerNode';
import LDRNode from '@/components/nodes/LDRNode';
import Sidebar from '@/components/Sidebar';

const nodeTypes = {
  battery: BatteryNode,
  led: LEDNode,
  resistor: ResistorNode,
  switch: SwitchNode,
  pushbutton: PushButtonNode,
  capacitor: CapacitorNode,
  transistor: TransistorNode,
  speaker: SpeakerNode,
  ldr: LDRNode,
};

let idCount = 100;
const getId = () => `node_${idCount++}`;

function CircuitFlow() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // Web Audio API refs for Real Emergency Siren Pitch
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sirenPitchRef = useRef<number>(300); // Frequency in Hz

  // Handlers for node inputs
  const handleVoltageChange = (id: string, val: number) => setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, voltage: val } } : n)));
  const handleResistanceChange = (id: string, val: number) => setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, resistance: val } } : n)));
  const handleCapacitanceChange = (id: string, val: number) => setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, capacitance: val } } : n)));
  const handleToggleSwitch = (id: string) => setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, isOpen: !n.data.isOpen } } : n)));
  const handleLightChange = (id: string, val: number) => setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, lightLevel: val } } : n)));

  const handlePushPress = (id: string, pressed: boolean) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, isPressed: pressed } } : n)));
  };

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)), []);
  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => setEdges((eds) => eds.filter((e) => e.id !== edge.id)), []);

  // Web Audio Initialization
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth'; // Siren waveform
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      audioCtxRef.current = ctx;
      oscRef.current = osc;
      gainRef.current = gain;
    }
  };

  // PRE-BUILT CIRCUIT TEMPLATES
  const loadTemplate = (templateName: string) => {
    if (templateName === 'siren') {
      setNodes([
        { id: 'b1', type: 'battery', position: { x: 100, y: 150 }, data: { voltage: 12, onChangeVoltage: handleVoltageChange } },
        { id: 'pb1', type: 'pushbutton', position: { x: 300, y: 100 }, data: { isPressed: false, onPushPress: handlePushPress } },
        { id: 'sp1', type: 'speaker', position: { x: 520, y: 150 }, data: { isPlaying: false } },
      ]);
      setEdges([
        { id: 'e1', source: 'b1', sourceHandle: 'pos', target: 'pb1', targetHandle: 'pos', animated: true },
        { id: 'e2', source: 'pb1', sourceHandle: 'neg', target: 'sp1', targetHandle: 'pos', animated: true },
        { id: 'e3', source: 'b1', sourceHandle: 'neg', target: 'sp1', targetHandle: 'neg', animated: true },
      ]);
    } else if (templateName === 'flipflop') {
      setNodes([
        { id: 'b1', type: 'battery', position: { x: 100, y: 200 }, data: { voltage: 9, onChangeVoltage: handleVoltageChange } },
        { id: 'r1', type: 'resistor', position: { x: 300, y: 50 }, data: { resistance: 470, onChangeResistance: handleResistanceChange } },
        { id: 'r2', type: 'resistor', position: { x: 300, y: 350 }, data: { resistance: 470, onChangeResistance: handleResistanceChange } },
        { id: 'led1', type: 'led', position: { x: 500, y: 50 }, data: { status: 'ON' } },
        { id: 'led2', type: 'led', position: { x: 500, y: 350 }, data: { status: 'OFF' } },
        { id: 'q1', type: 'transistor', position: { x: 700, y: 50 }, data: {} },
        { id: 'q2', type: 'transistor', position: { x: 700, y: 350 }, data: {} },
        { id: 'c1', type: 'capacitor', position: { x: 500, y: 180 }, data: { capacitance: 10, onChangeCapacitance: handleCapacitanceChange } },
        { id: 'c2', type: 'capacitor', position: { x: 500, y: 260 }, data: { capacitance: 10, onChangeCapacitance: handleCapacitanceChange } },
      ]);
      setEdges([
        { id: 'e1', source: 'b1', sourceHandle: 'pos', target: 'r1', targetHandle: 'pos', animated: true },
        { id: 'e2', source: 'b1', sourceHandle: 'pos', target: 'r2', targetHandle: 'pos', animated: true },
        { id: 'e3', source: 'r1', sourceHandle: 'neg', target: 'led1', targetHandle: 'pos', animated: true },
        { id: 'e4', source: 'r2', sourceHandle: 'neg', target: 'led2', targetHandle: 'pos', animated: true },
      ]);
    } else if (templateName === 'ldr') {
      setNodes([
        { id: 'b1', type: 'battery', position: { x: 100, y: 150 }, data: { voltage: 9, onChangeVoltage: handleVoltageChange } },
        { id: 'ldr1', type: 'ldr', position: { x: 300, y: 100 }, data: { lightLevel: 20, onChangeLight: handleLightChange } },
        { id: 'led1', type: 'led', position: { x: 520, y: 150 }, data: { status: 'OFF' } },
      ]);
      setEdges([
        { id: 'e1', source: 'b1', sourceHandle: 'pos', target: 'ldr1', targetHandle: 'pos', animated: true },
        { id: 'e2', source: 'ldr1', sourceHandle: 'neg', target: 'led1', targetHandle: 'pos', animated: true },
        { id: 'e3', source: 'b1', sourceHandle: 'neg', target: 'led1', targetHandle: 'neg', animated: true },
      ]);
    }
  };

  // DRAG AND DROP HANDLERS
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: {
          voltage: 9, resistance: 330, capacitance: 10, isOpen: true, isPressed: false, lightLevel: 50, status: 'OFF',
          onChangeVoltage: handleVoltageChange, onChangeResistance: handleResistanceChange, onChangeCapacitance: handleCapacitanceChange,
          onToggleSwitch: handleToggleSwitch, onPushPress: handlePushPress, onChangeLight: handleLightChange,
        },
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition]
  );

  // REAL-TIME SIMULATION LOOP (Siren Audio & Flip-Flop Alternating Pulsing)
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isSimulating) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('http://127.0.0.1:8000/api/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nodes, edges }),
          });
          const result = await res.json();

          // Handle Emergency Siren Sound Pitch Sweep
          if (result.speaker_active && gainRef.current && oscRef.current && audioCtxRef.current) {
            gainRef.current.gain.setValueAtTime(0.3, audioCtxRef.current.currentTime);
            if (result.siren_pitch === 'RISING') {
              sirenPitchRef.current = Math.min(sirenPitchRef.current + 30, 1200); // Ramp up pitch
            }
            oscRef.current.frequency.setValueAtTime(sirenPitchRef.current, audioCtxRef.current.currentTime);
          } else if (gainRef.current && audioCtxRef.current) {
            if (sirenPitchRef.current > 300) {
              sirenPitchRef.current = Math.max(sirenPitchRef.current - 40, 300); // Ramp down pitch
              if (oscRef.current) oscRef.current.frequency.setValueAtTime(sirenPitchRef.current, audioCtxRef.current.currentTime);
            } else {
              gainRef.current.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
            }
          }

          // Handle Flip-Flop Alternating Swap Logic
          if (result.is_flipflop) {
            setNodes((nds) => {
              const leds = nds.filter((n) => n.type === 'led');
              if (leds.length >= 2) {
                const firstOn = leds[0].data.status === 'ON';
                return nds.map((n) => {
                  if (n.id === leds[0].id) return { ...n, data: { ...n.data, status: firstOn ? 'OFF' : 'ON' } };
                  if (n.id === leds[1].id) return { ...n, data: { ...n.data, status: firstOn ? 'ON' : 'OFF' } };
                  return n;
                });
              }
              return nds;
            });
          } else if (result.led_states) {
            setNodes((nds) =>
              nds.map((n) => (n.type === 'led' ? { ...n, data: { ...n.data, status: result.led_states[n.id] || 'OFF' } } : n))
            );
          }
        } catch (err) {
          console.error(err);
        }
      }, 150);
    }

    return () => clearInterval(interval);
  }, [isSimulating, nodes, edges]);

  return (
    <main className="w-screen h-screen flex bg-gray-50 overflow-hidden">
      <Sidebar onSelectTemplate={loadTemplate} />

      <div className="flex-grow h-full flex flex-col">
        <header className="p-4 bg-white border-b shadow-sm z-10 flex justify-between items-center">
          <h1 className="font-bold text-xl text-gray-800">Circuit Engineering Studio</h1>
          <div className="flex gap-2">
            <button onClick={() => setEdges([])} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-xs font-medium border hover:bg-gray-200">
              Clear Wires
            </button>
            <button
              onClick={() => {
                initAudio();
                setIsSimulating(!isSimulating);
              }}
              className={`px-5 py-2 text-white rounded-md text-sm font-medium transition-colors shadow-sm ${
                isSimulating ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isSimulating ? 'Stop Simulator' : 'Start Simulator'}
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
            isValidConnection={() => true}
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