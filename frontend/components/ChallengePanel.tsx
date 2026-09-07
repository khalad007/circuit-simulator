'use client';

import { useRef, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { api, circuitPayload } from '@/lib/circuit';

type Challenge = { id: string; title: string; task: string; criteria: string[] };
type Grade = { score: number; feedback: string; hints: string[] };

export default function ChallengePanel({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [grade, setGrade] = useState<{ result: Grade; signature: string } | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const signature = JSON.stringify(circuitPayload(nodes, edges));
  const requestId = useRef(0);
  const generate = async () => {
    const id = ++requestId.current;
    setBusy('Generating challenge…'); setError('');
    try {
      const result = await api<Challenge>('ai/challenge');
      if (id === requestId.current) { setChallenge(result); setGrade(null); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not generate challenge.'); }
    finally { setBusy(''); }
  };
  const verify = async () => {
    if (!challenge) return;
    setBusy('Checking your solution…'); setError('');
    try {
      const result = await api<Grade>('ai/challenge/verify', { ...circuitPayload(nodes, edges), challenge_id: challenge.id });
      setGrade({ result, signature });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not verify solution.'); }
    finally { setBusy(''); }
  };
  return <section className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs" aria-label="AI challenge mode">
    <div className="flex flex-wrap items-center gap-3">
      <strong className="text-amber-900">🏆 Challenge mode</strong>
      <button className="studio-button" disabled={!!busy} onClick={generate}>{challenge ? 'New Challenge' : 'Generate Challenge'}</button>
      {challenge && <button className="studio-button" disabled={!!busy} onClick={verify}>Verify Solution</button>}
      {busy && <span role="status">{busy}</span>}
    </div>
    {challenge && <div className="mt-2 space-y-1"><h2 className="font-bold">{challenge.title}</h2><p>{challenge.task}</p><details><summary className="cursor-pointer text-amber-800">Grading criteria</summary><ul className="list-disc pl-5">{challenge.criteria.map((c, i) => <li key={i}>{c}</li>)}</ul></details></div>}
    {grade && <div className="mt-2 rounded border border-amber-200 bg-white p-2" role="status">
      <strong className="text-sm">{grade.result.score}/100 {grade.result.score === 100 ? '🏅 Challenge complete!' : '— Keep experimenting'}</strong>
      {grade.signature !== signature && <p className="font-semibold text-amber-700">Circuit changed since grading. Verify again for an updated score.</p>}
      <p>{grade.result.feedback}</p><ul className="list-disc pl-5">{grade.result.hints.map((hint, i) => <li key={i}>{hint}</li>)}</ul>
    </div>}
    {error && <p className="mt-2 text-red-700" role="alert">{error}</p>}
  </section>;
}
