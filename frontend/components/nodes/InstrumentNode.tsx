'use client';

import { useEffect, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { Reading } from '@/lib/circuit';

type InstrumentData = { reading?: Reading; running?: boolean; elapsed?: number; frequency?: number; resetToken?: number };

function Probes() {
  return <>
    <Handle type="source" id="pos" position={Position.Left} className="!h-4 !w-4 !bg-red-500" />
    <Handle type="source" id="neg" position={Position.Right} className="!h-4 !w-4 !bg-slate-800" />
    <div className="flex justify-between text-[10px] text-slate-500"><span>+ probe</span><span>− probe</span></div>
  </>;
}

export function MeterNode({ data, type }: { data: InstrumentData; type: string }) {
  const current = type === 'ammeter';
  const value = current ? data.reading?.current_ma : data.reading?.voltage;
  return <div className="w-44 rounded-lg border-2 border-teal-700 bg-white p-3 shadow-md">
    <p className="text-xs font-bold text-teal-900">{current ? 'Ammeter' : 'Voltmeter'}</p>
    <div className="my-2 rounded bg-slate-950 px-2 py-3 text-center font-mono text-xl text-emerald-300">
      {data.running && value != null ? value.toFixed(2) : '—'} <span className="text-xs">{current ? 'mA' : 'V'}</span>
    </div>
    <p className="mb-2 text-[10px] text-slate-500">{!data.running ? 'Start simulation to measure' : !data.reading?.connected ? 'Connect both probes' : current ? 'Series current (+ → −)' : 'Voltage difference (+ − −)'}</p>
    <Probes />
  </div>;
}

export function OscilloscopeNode({ data }: { data: InstrumentData }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const history = useRef<{ time: number; value: number }[]>([]);
  const latest = useRef(data);
  useEffect(() => { latest.current = data; }, [data]);
  useEffect(() => { history.current = []; }, [data.resetToken]);
  useEffect(() => {
    if (data.running && data.reading?.voltage != null) {
      history.current.push({ time: data.elapsed ?? 0, value: data.reading.voltage });
      history.current = history.current.filter(p => p.time >= (data.elapsed ?? 0) - 4).slice(-200);
    }
  }, [data.elapsed, data.reading?.voltage, data.running]);
  useEffect(() => {
    let frame = 0;
    const draw = (now: number) => {
      const ctx = canvas.current?.getContext('2d');
      if (!ctx) return;
      const d = latest.current;
      const w = 280, h = 120;
      ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#25344c'; ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      const samples = history.current;
      const scale = Math.max(5, ...samples.map(p => Math.abs(p.value))) * 1.1;
      ctx.strokeStyle = '#34d399'; ctx.lineWidth = 2; ctx.beginPath();
      if (d.reading?.signal === 'siren' && d.running && d.reading.connected) {
        for (let x = 0; x < w; x++) {
          const amplitude = (d.frequency ?? 0) > 300 || (d.reading.voltage ?? 0) > 0 ? 40 : 0;
          const y = h / 2 - amplitude * Math.sin(2 * Math.PI * (d.frequency ?? 300) * (x / w * 0.02 + now / 1000));
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      } else {
        const end = d.elapsed ?? 0;
        samples.forEach((p, i) => {
          const x = w - (end - p.time) / 4 * w;
          const y = h / 2 - p.value / scale * (h / 2 - 8);
          if (i === 0) ctx.moveTo(x, y);
          else { ctx.lineTo(x, h / 2 - samples[i - 1].value / scale * (h / 2 - 8)); ctx.lineTo(x, y); }
        });
      }
      ctx.stroke();
      ctx.fillStyle = '#94a3b8'; ctx.font = '10px monospace';
      ctx.fillText(d.reading?.signal === 'siren' ? 'Siren model · 20 ms window' : `±${scale.toFixed(1)} V · 4 s window`, 7, 12);
      if (d.running) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [data.running, data.resetToken]);
  return <div className="w-[306px] rounded-lg border-2 border-slate-700 bg-white p-3 shadow-md">
    <div className="mb-2 flex justify-between text-xs font-bold"><span>Oscilloscope</span><span className="text-teal-700">{data.running ? 'LIVE' : 'PAUSED'}</span></div>
    <canvas ref={canvas} width={280} height={120} className="rounded" aria-label="Live oscilloscope waveform" />
    <p className="my-2 text-[10px] text-slate-500">{!data.reading?.connected ? 'Connect + to signal and − to return' : data.reading.signal === 'siren' ? `Pitch: ${(data.frequency ?? 300).toFixed(0)} Hz · behavioral model` : `${data.reading.voltage?.toFixed(2)} V · ${data.reading.frequency ? `${data.reading.frequency.toFixed(2)} Hz flip-flop model` : 'DC / sampled voltage'}`}</p>
    <Probes />
  </div>;
}

export function JunctionNode() {
  return <div className="h-5 w-5 rounded-full border-2 border-white bg-slate-700 shadow" title="Wire junction: attach a probe or branch here">
    <Handle type="source" id="pos" position={Position.Top} style={{ top: '50%', left: '50%', width: 16, height: 16, background: '#334155' }} />
  </div>;
}
