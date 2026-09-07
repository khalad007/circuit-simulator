import type { Node, Edge } from '@xyflow/react';
import { defaults } from './circuit';

export function template(name: string) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const node = (id: string, type: string, x: number, y: number, data = {}) => nodes.push({ id, type, position: { x, y }, data: { ...defaults, ...data } });
  const wire = (source: string, sourceHandle: string, target: string, targetHandle: string) => edges.push({ id: `e${edges.length + 1}`, source, sourceHandle, target, targetHandle });
  node('b1', 'battery', 40, 200, { voltage: name === 'siren' ? 12 : 9 });
  if (name === 'siren') {
    node('pb1', 'pushbutton', 260, 120);
    node('sp1', 'speaker', 470, 200);
    node('scope1', 'oscilloscope', 700, 150);
    wire('b1', 'pos', 'pb1', 'pos'); wire('pb1', 'neg', 'sp1', 'pos'); wire('sp1', 'neg', 'b1', 'neg');
    wire('scope1', 'pos', 'sp1', 'pos'); wire('scope1', 'neg', 'sp1', 'neg');
  } else if (name === 'flipflop') {
    node('r1', 'resistor', 270, 40, { resistance: 470 });
    node('r2', 'resistor', 270, 420, { resistance: 470 });
    node('led1', 'led', 470, 40); node('led2', 'led', 470, 420);
    node('q1', 'transistor', 690, 40); node('q2', 'transistor', 690, 420);
    node('c1', 'capacitor', 470, 190); node('c2', 'capacitor', 690, 280);
    node('rb1', 'resistor', 260, 180, { resistance: 100000 });
    node('rb2', 'resistor', 260, 300, { resistance: 100000 });
    node('scope1', 'oscilloscope', 950, 180);
    for (const i of [1, 2]) {
      wire('b1', 'pos', `r${i}`, 'pos'); wire(`r${i}`, 'neg', `led${i}`, 'pos');
      wire(`led${i}`, 'neg', `q${i}`, 'collector'); wire(`q${i}`, 'emitter', 'b1', 'neg');
      wire('b1', 'pos', `rb${i}`, 'pos'); wire(`rb${i}`, 'neg', `q${i}`, 'base');
    }
    wire('q1', 'collector', 'c1', 'pos'); wire('c1', 'neg', 'q2', 'base');
    wire('q2', 'collector', 'c2', 'pos'); wire('c2', 'neg', 'q1', 'base');
    wire('scope1', 'pos', 'q1', 'collector'); wire('scope1', 'neg', 'b1', 'neg');
  } else {
    node('ldr1', 'ldr', 270, 120, { lightLevel: 20 });
    node('r1', 'resistor', 480, 120, { resistance: 330 }); node('led1', 'led', 690, 200);
    node('v1', 'voltmeter', 930, 120);
    wire('b1', 'pos', 'ldr1', 'pos'); wire('ldr1', 'neg', 'r1', 'pos'); wire('r1', 'neg', 'led1', 'pos'); wire('led1', 'neg', 'b1', 'neg');
    wire('v1', 'pos', 'led1', 'pos'); wire('v1', 'neg', 'led1', 'neg');
  }
  return { nodes, edges };
}
