'use client';

import { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import {
  ReactFlow, Background, Controls, applyNodeChanges, applyEdgeChanges, addEdge,
  type Node, type Edge, type NodeChange, type EdgeChange, type Connection,
  useReactFlow, ReactFlowProvider, ConnectionMode, getNodesBounds, getViewportForBounds,
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
import { MeterNode, OscilloscopeNode, JunctionNode } from '@/components/nodes/InstrumentNode';
import Sidebar from '@/components/Sidebar';
import AIAssistant from '@/components/AIAssistant';
import ChallengePanel from '@/components/ChallengePanel';
import { api, circuitPayload, componentTypes, defaults, download, parseCircuit, saveCircuit, type Simulation } from '@/lib/circuit';
import { template } from '@/lib/templates';

const nodeTypes = {
  battery: BatteryNode, led: LEDNode, resistor: ResistorNode, switch: SwitchNode,
  pushbutton: PushButtonNode, capacitor: CapacitorNode, transistor: TransistorNode,
  speaker: SpeakerNode, ldr: LDRNode, voltmeter: MeterNode, ammeter: MeterNode,
  oscilloscope: OscilloscopeNode, junction: JunctionNode,
};

function CircuitFlow() {
  const wrapper = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const flow = useReactFlow();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Simulation | null>(null);
  const [notice, setNotice] = useState('');
  const [exporting, setExporting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [frequency, setFrequency] = useState(300);
  const [resetToken, setResetToken] = useState(0);
  const startTime = useRef(0);
  const audio = useRef<{ ctx: AudioContext; oscillator: OscillatorNode; gain: GainNode } | null>(null);
  const presses = useRef(new Map<string, { released: boolean; acknowledgedAt: number | null; timer?: ReturnType<typeof setTimeout> }>());
  const pitch = useRef(300);
  const change = useCallback((id: string, key: string, value: unknown) => {
    setNodes(current => current.map(n => n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n));
  }, []);
  const initAudio = useCallback(() => {
    try {
      if (!audio.current || audio.current.ctx.state === 'closed') {
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sawtooth'; oscillator.frequency.value = 300; gain.gain.value = 0;
        oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start();
        audio.current = { ctx, oscillator, gain };
      }
      void audio.current.ctx.resume().catch(() => setNotice('Sound could not start. Allow sound for this site, then press PUSH again.'));
    } catch { setNotice('Audio is unavailable in this browser; visual simulation remains available.'); }
  }, []);
  const finishPress = useCallback((id: string) => {
    const press = presses.current.get(id);
    if (!press || !press.released || press.acknowledgedAt === null || press.timer) return;
    // Give a short tap an audible duration AFTER the server has evaluated it.
    press.timer = setTimeout(() => {
      if (presses.current.get(id) !== press) return;
      presses.current.delete(id);
      change(id, 'isPressed', false);
    }, Math.max(0, 180 - (performance.now() - press.acknowledgedAt)));
  }, [change]);
  const handlers = useMemo(() => ({
    onChangeVoltage: (id: string, value: number) => change(id, 'voltage', value),
    onChangeResistance: (id: string, value: number) => change(id, 'resistance', value),
    onChangeCapacitance: (id: string, value: number) => change(id, 'capacitance', value),
    onChangeLight: (id: string, value: number) => change(id, 'lightLevel', value),
    onPushPress: (id: string, value: boolean) => {
      if (!running) return;
      if (value) {
        initAudio(); // Retry browser audio unlock in the actual user gesture.
        clearTimeout(presses.current.get(id)?.timer);
        presses.current.set(id, { released: false, acknowledgedAt: null });
        change(id, 'isPressed', true);
      } else {
        const press = presses.current.get(id);
        if (press) { press.released = true; finishPress(id); }
        else change(id, 'isPressed', false);
      }
    },
    onToggleSwitch: (id: string) => setNodes(current => current.map(n => n.id === id ? { ...n, data: { ...n.data, isOpen: !n.data.isOpen } } : n)),
  }), [change, running, initAudio, finishPress]);

  const mute = useCallback(() => {
    if (audio.current) {
      audio.current.gain.gain.cancelScheduledValues(audio.current.ctx.currentTime);
      audio.current.gain.gain.setValueAtTime(0, audio.current.ctx.currentTime);
    }
  }, []);
  const stop = useCallback(() => {
    setRunning(false); mute();
    for (const press of presses.current.values()) clearTimeout(press.timer);
    presses.current.clear();
    setNodes(current => current.map(n => n.type === 'pushbutton' && n.data.isPressed ? { ...n, data: { ...n.data, isPressed: false } } : n));
  }, [mute]);
  useEffect(() => {
    const pending = presses.current;
    return () => {
      for (const press of pending.values()) clearTimeout(press.timer);
      pending.clear();
      audio.current?.oscillator.stop(); void audio.current?.ctx.close();
    };
  }, []);

  // Runtime readings are separate from the editable graph. Only electrical edits restart polling.
  const payload = JSON.stringify(circuitPayload(nodes, edges));
  useEffect(() => {
    if (!running) return;
    const controller = new AbortController();
    const snapshot = JSON.parse(payload);
    let timer: ReturnType<typeof setTimeout>;
    let previousTime = performance.now();
    const tick = async () => {
      try {
        const time = (performance.now() - startTime.current) / 1000;
        const next = await api<Simulation>('simulate', { ...snapshot, elapsed: time }, controller.signal);
        if (controller.signal.aborted) return;
        setResult(next); setElapsed(time);
        const delta = Math.min(0.5, (performance.now() - previousTime) / 1000);
        previousTime = performance.now();
        if (next.short_circuit) { setNotice(next.alerts.join(' ')); stop(); return; }
        const burnt = Object.entries(next.led_states).filter(([, status]) => status === 'BURNT').map(([id]) => id);
        if (burnt.length) setNodes(current => current.map(n => burnt.includes(n.id) && n.data.status !== 'BURNT' ? { ...n, data: { ...n.data, status: 'BURNT' } } : n));
        pitch.current = next.speaker_active ? Math.min(1200, pitch.current + delta * 240) : Math.max(300, pitch.current - delta * 320);
        setFrequency(pitch.current);
        if (audio.current) {
          const { ctx, oscillator, gain } = audio.current;
          oscillator.frequency.setTargetAtTime(pitch.current, ctx.currentTime, 0.03);
          gain.gain.setTargetAtTime(next.speaker_active ? 0.08 : 0, ctx.currentTime, 0.03);
        }
        for (const n of snapshot.nodes) {
          const press = presses.current.get(n.id);
          if (n.type === 'pushbutton' && n.data.isPressed && press && press.acknowledgedAt === null) {
            press.acknowledgedAt = performance.now(); finishPress(n.id);
          }
        }
        timer = setTimeout(tick, 100);
      } catch (error) {
        if (controller.signal.aborted) return;
        setNotice(error instanceof Error ? error.message : 'Simulation failed.'); stop();
      }
    };
    void tick();
    return () => { controller.abort(); clearTimeout(timer); mute(); };
  }, [running, payload, stop, mute, finishPress]);

  const displayNodes = nodes.map(n => ({ ...n, data: {
    ...n.data, ...handlers,
    status: n.data.status === 'BURNT' ? 'BURNT' : running ? result?.led_states[n.id] ?? 'OFF' : 'OFF',
    isPlaying: running && !!result?.speaker_active && (result.measurements[n.id]?.current_ma ?? 0) > 0,
    reading: result?.instruments[n.id], running, elapsed, frequency, resetToken,
  } }));
  const displayEdges = edges.map(e => ({ ...e, animated: running && !result?.short_circuit,
    style: { stroke: result?.fault_edges.includes(e.id) ? '#dc2626' : '#64748b', strokeWidth: result?.fault_edges.includes(e.id) ? 4 : 2 },
  }));

  const replaceCircuit = (value: unknown) => {
    const next = parseCircuit(value);
    stop(); setResult(null); setNotice(''); setNodes(next.nodes); setEdges(next.edges); setResetToken(t => t + 1); setElapsed(0);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (next.viewport) void flow.setViewport(next.viewport);
      else void flow.fitView({ padding: 0.2 });
    }));
  };
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(current => applyNodeChanges(changes, current));
    const removed = new Set(changes.filter(c => c.type === 'remove').map(c => c.id));
    if (removed.size) setEdges(current => current.filter(e => !removed.has(e.source) && !removed.has(e.target)));
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges(current => applyEdgeChanges(changes, current)), []);
  const onConnect = useCallback((connection: Connection) => setEdges(current => addEdge(connection, current)), []);
  const addComponent = (type: string, position = flow.screenToFlowPosition({ x: (wrapper.current?.getBoundingClientRect().left ?? 240) + 200, y: (wrapper.current?.getBoundingClientRect().top ?? 250) + 130 })) => {
    if (!componentTypes.includes(type)) return;
    setNodes(current => current.concat({ id: crypto.randomUUID(), type, position, data: { ...defaults } }));
  };
  const splitWire = (event: React.MouseEvent, edge: Edge) => {
    const ammeter = nodes.find(n => n.selected && n.type === 'ammeter' && !edges.some(e => e.source === n.id || e.target === n.id));
    const id = ammeter?.id ?? crypto.randomUUID();
    if (!ammeter) addJunction();
    function addJunction() { setNodes(current => current.concat({ id, type: 'junction', position: flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }), data: {} })); }
    setEdges(current => current.filter(e => e.id !== edge.id).concat([
      { id: crypto.randomUUID(), source: edge.source, sourceHandle: edge.sourceHandle, target: id, targetHandle: 'pos' },
      { id: crypto.randomUUID(), source: id, sourceHandle: ammeter ? 'neg' : 'pos', target: edge.target, targetHandle: edge.targetHandle },
    ]));
    setNotice(ammeter ? 'Ammeter inserted in series. Start the simulator to read current.' : 'Junction added. Connect an instrument probe to the junction.');
  };

  const save = () => {
    const url = URL.createObjectURL(new Blob([saveCircuit(nodes, edges, flow.getViewport())], { type: 'application/json' }));
    download(url, 'circuit.json'); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const load = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Choose a circuit JSON smaller than 2 MB.');
      replaceCircuit(JSON.parse(await file.text())); setNotice('Circuit loaded. Click Start Simulator when ready.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not load circuit.'); }
    finally { if (fileInput.current) fileInput.current.value = ''; }
  };
  const exportPng = async () => {
    setExporting(true);
    try {
      const viewport = wrapper.current?.querySelector<HTMLElement>('.react-flow__viewport');
      if (!viewport || !nodes.length) throw new Error('Add components before exporting.');
      const { toPng } = await import('html-to-image');
      const bounds = getNodesBounds(flow.getNodes());
      // Include handles and labels outside component boxes, and fit off-screen nodes.
      const padded = { x: bounds.x - 40, y: bounds.y - 40, width: bounds.width + 80, height: bounds.height + 80 };
      const width = 1600, height = Math.min(2000, Math.max(900, Math.round(width * padded.height / Math.max(padded.width, 1))));
      const transform = getViewportForBounds(padded, width, height, 0.01, 2, 0.05);
      const url = await toPng(viewport, { backgroundColor: '#ffffff', width, height, pixelRatio: 1, skipFonts: true,
        style: { width: `${width}px`, height: `${height}px`, transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})` },
        filter: element => !(element instanceof HTMLElement && (element.classList.contains('react-flow__nodesselection') || element.classList.contains('react-flow__selection'))),
      });
      download(url, 'circuit.png'); setNotice('PNG exported.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not export PNG.'); }
    finally { setExporting(false); }
  };

  return <main className="flex h-screen w-screen overflow-hidden bg-slate-50">
    <Sidebar onSelectTemplate={name => replaceCircuit(template(name))} onAddComponent={addComponent} />
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white p-4 shadow-sm">
        <div><h1 className="text-lg font-bold text-slate-800">Circuit Engineering Studio</h1><p className="text-[11px] text-slate-500">Build · measure · experiment</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={save} className="studio-button">Save JSON</button>
          <button onClick={() => fileInput.current?.click()} className="studio-button">Load JSON</button>
          <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" aria-label="Load circuit JSON" onChange={e => void load(e.target.files?.[0])} />
          <button onClick={exportPng} disabled={exporting || !nodes.length} className="studio-button">{exporting ? 'Exporting…' : 'Export PNG'}</button>
          <button onClick={() => { stop(); setEdges([]); setResult(null); }} className="studio-button">Clear Wires</button>
          <button onClick={() => { stop(); setNodes(current => current.map(n => n.type === 'led' ? { ...n, data: { ...n.data, status: 'OFF' } } : n)); setResult(null); setNotice('LEDs repaired. Fix the wiring before restarting.'); }} className="studio-button">Repair LEDs</button>
          <button onClick={() => {
            if (running) stop();
            else { setNotice(''); setResult(null); pitch.current = 300; setFrequency(300); startTime.current = performance.now(); setElapsed(0); setResetToken(t => t + 1); initAudio(); setRunning(true); }
          }} className={`rounded-md px-4 py-2 text-xs font-bold text-white ${running ? 'bg-red-600' : 'bg-emerald-700'}`}>{running ? 'Stop Simulator' : 'Start Simulator'}</button>
        </div>
      </header>
      <div className="max-h-[38vh] shrink-0 overflow-y-auto">
        <AIAssistant onGenerateCircuit={(newNodes, newEdges) => replaceCircuit({ nodes: newNodes, edges: newEdges })} onAnalyzeCircuit={async () => {
          try { return (await api<{ analysis: string }>('ai/analyze', circuitPayload(nodes, edges))).analysis; }
          catch (error) { return error instanceof Error ? error.message : 'Could not analyze circuit.'; }
        }} />
        <ChallengePanel nodes={nodes} edges={edges} />
        {(notice || !!result?.alerts.length) && <div role="alert" aria-label="Studio notification" className={`border-b px-4 py-2 text-xs ${result?.short_circuit || result?.alerts.length ? 'border-red-200 bg-red-50 text-red-800' : 'bg-blue-50 text-blue-900'}`}>{notice}{result?.alerts.filter(a => a !== notice).map(a => <p key={a}>{a}</p>)}</div>}
      </div>
      <div className="border-b bg-white px-4 py-2 text-[11px] text-slate-500">
        Connect any terminals. Double-click a wire for a probe junction, or select an unconnected ammeter first to insert it in series. Select + Delete to remove.
      </div>
      <div className="min-h-0 flex-1" ref={wrapper}>
        <ReactFlow nodes={displayNodes} edges={displayEdges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect} onEdgeDoubleClick={splitWire} connectionMode={ConnectionMode.Loose}
          onDrop={e => { e.preventDefault(); addComponent(e.dataTransfer.getData('application/reactflow'), flow.screenToFlowPosition({ x: e.clientX, y: e.clientY })); }}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
          minZoom={0.05} maxZoom={4} deleteKeyCode={['Backspace', 'Delete']} fitView>
          <Background /><Controls />
        </ReactFlow>
      </div>
      <footer className="border-t bg-white px-4 py-1.5 text-[10px] text-slate-500">Educational model · one DC battery · LED ≈ 2 V + 10 Ω · capacitors open at DC · siren/flip-flop use simplified behavioral timing.</footer>
    </div>
  </main>;
}

export default function CircuitSimulator() { return <ReactFlowProvider><CircuitFlow /></ReactFlowProvider>; }
