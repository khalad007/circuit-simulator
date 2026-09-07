'use client';

import { useState, useEffect, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { api } from '@/lib/circuit';

export default function AIAssistant({
  onGenerateCircuit,
  onAnalyzeCircuit,
}: {
  onGenerateCircuit: (nodes: Node[], edges: Edge[]) => void;
  onAnalyzeCircuit: (signal?: AbortSignal) => Promise<string>;
}) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setAnalysis('');
    pending.current?.abort();
    const request = new AbortController(); pending.current = request;
    try {
      const data = await api<{ nodes: Node[]; edges: Edge[] }>('ai/generate', { prompt }, request.signal);
      if (request.signal.aborted) return;
      if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
        throw new Error('The server returned an invalid circuit. Try again.');
      }
      onGenerateCircuit(data.nodes, data.edges);
    } catch (err) {
      if (request.signal.aborted) return;
      setAnalysis(`⚠️ ${err instanceof TypeError ? 'Cannot connect to the backend. Make sure uvicorn is running on port 8000.' : err instanceof Error ? err.message : 'Could not generate circuit. Try again.'}`);
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    pending.current?.abort();
    const request = new AbortController(); pending.current = request;
    try { const feedback = await onAnalyzeCircuit(request.signal); if (!request.signal.aborted) setAnalysis(feedback); }
    catch (error) { if (!request.signal.aborted) setAnalysis(error instanceof Error ? error.message : 'Could not analyze circuit.'); }
    finally { if (!request.signal.aborted) setLoading(false); }
  };

  return (
    <div className="bg-white border-b p-3 flex flex-col gap-2 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="✨ Ask AI: 'Build an LED alarm with LDR switch'..."
          className="flex-grow border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-1.5 rounded-md transition-all disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate Circuit'}
        </button>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold px-3 py-1.5 rounded-md transition-all"
        >
          🔍 AI Doctor
        </button>
      </div>

      {analysis && (
        <div className="p-2 bg-indigo-50 border border-indigo-200 rounded text-xs text-indigo-900 font-medium">
          💡 <strong>AI Assistant:</strong> {analysis}
        </div>
      )}
    </div>
  );
}
