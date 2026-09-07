import type { Edge, Node, Viewport } from '@xyflow/react';

export const componentTypes = ['battery', 'resistor', 'led', 'switch', 'pushbutton', 'capacitor', 'transistor', 'speaker', 'ldr', 'voltmeter', 'ammeter', 'oscilloscope', 'junction'];
export const handlesFor = (type?: string) => type === 'transistor' ? ['base', 'collector', 'emitter'] : type === 'junction' ? ['pos'] : ['pos', 'neg'];
export const defaults = { voltage: 9, resistance: 330, capacitance: 10, isOpen: true, isPressed: false, lightLevel: 50, status: 'OFF' };
const numericFields = ['voltage', 'resistance', 'capacitance', 'lightLevel'] as const;

export type Reading = { voltage: number | null; current_ma: number | null; connected: boolean; signal: string; frequency: number };
export type Simulation = {
  led_states: Record<string, string>; speaker_active: boolean; siren_pitch: string; is_flipflop: boolean;
  short_circuit: boolean; fault_edges: string[]; alerts: string[];
  measurements: Record<string, { voltage: number | null; current_ma: number | null }>;
  instruments: Record<string, Reading>;
};

export function persistentData(data: Record<string, unknown>) {
  return Object.fromEntries(Object.keys(defaults).map(key => [key, data[key] ?? defaults[key as keyof typeof defaults]]));
}

export function circuitPayload(nodes: Node[], edges: Edge[]) {
  return {
    nodes: nodes.map(n => ({ id: n.id, type: n.type, data: persistentData(n.data) })),
    edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })),
  };
}

export function saveCircuit(nodes: Node[], edges: Edge[], viewport: Viewport) {
  return JSON.stringify({ version: 1, nodes: nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: persistentData({ ...n.data, isPressed: false }) })), edges: circuitPayload(nodes, edges).edges, viewport }, null, 2);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function parseCircuit(value: unknown): { nodes: Node[]; edges: Edge[]; viewport?: Viewport } {
  if (!record(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges) || (value.version !== undefined && value.version !== 1)) throw new Error('Choose a circuit JSON file with a supported version, nodes and edges.');
  if (value.nodes.length > 100 || value.edges.length > 300) throw new Error('Use at most 100 components and 300 wires.');
  const ids = new Map<string, string>();
  const nodes: Node[] = value.nodes.map((n: unknown) => {
    if (!record(n) || typeof n.id !== 'string' || !n.id || n.id.length > 128 || ids.has(n.id) || typeof n.type !== 'string' || !componentTypes.includes(n.type) || !record(n.position) || !finite(n.position.x) || !finite(n.position.y) || Math.abs(n.position.x) > 1e6 || Math.abs(n.position.y) > 1e6 || (n.data !== undefined && !record(n.data))) throw new Error('Invalid or duplicate component, type, or position in circuit.');
    ids.set(n.id, n.type);
    const data = persistentData(record(n.data) ? n.data : {});
    for (const key of numericFields) if (!finite(data[key]) || data[key] < 0 || data[key] > 1e7) throw new Error(`Invalid ${key} on ${n.id}.`);
    if (Number(data.resistance) > 0 && Number(data.resistance) < 0.001) throw new Error('Resistance must be zero or at least 0.001 ohms.');
    if (Number(data.lightLevel) > 100) throw new Error('Light level must be between 0 and 100 percent.');
    if (typeof data.isOpen !== 'boolean' || typeof data.isPressed !== 'boolean' || !['OFF', 'ON', 'BURNT', 'BLOWN'].includes(String(data.status))) throw new Error(`Invalid component state on ${n.id}.`);
    return { id: n.id, type: n.type, position: { x: n.position.x, y: n.position.y }, data: { ...data, isPressed: false, status: data.status === 'BLOWN' ? 'BURNT' : data.status } };
  });
  const edgeIds = new Set<string>();
  const edges: Edge[] = value.edges.map((e: unknown) => {
    if (!record(e) || typeof e.id !== 'string' || !e.id || edgeIds.has(e.id) || typeof e.source !== 'string' || typeof e.target !== 'string' || !ids.has(e.source) || !ids.has(e.target) || typeof e.sourceHandle !== 'string' || typeof e.targetHandle !== 'string' || !handlesFor(ids.get(e.source)).includes(e.sourceHandle) || !handlesFor(ids.get(e.target)).includes(e.targetHandle)) throw new Error('Invalid wire ID, component reference, or terminal in circuit.');
    edgeIds.add(e.id);
    return { id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle };
  });
  let viewport: Viewport | undefined;
  if (value.viewport !== undefined) {
    const v = value.viewport;
    if (!record(v) || !finite(v.x) || !finite(v.y) || !finite(v.zoom) || v.zoom < 0.05 || v.zoom > 4) throw new Error('Invalid saved viewport.');
    viewport = { x: v.x, y: v.y, zoom: v.zoom };
  }
  return { nodes, edges, viewport };
}

export async function api<T>(route: string, payload?: unknown, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, route === 'simulate' ? 10_000 : 45_000);
  try {
    const response = await fetch(`http://127.0.0.1:8000/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload ?? {}), signal: controller.signal });
    let data;
    try { data = await response.json(); }
    catch (error) {
      if (controller.signal.aborted) throw error;
      throw new Error(`The backend returned an invalid response (${response.status}). Try again.`);
    }
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `Request failed (${response.status}). Check component values and connections.`);
    return data as T;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timedOut) throw new Error('The backend took too long to respond. Check its connection and try again.');
    if (error instanceof TypeError) throw new Error('Cannot connect to the backend. Run uvicorn on port 8000 and try again.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

export function download(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
