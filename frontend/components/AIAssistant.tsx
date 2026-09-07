'use client';

import { useState } from 'react';

export default function AIAssistant({
  onGenerateCircuit,
  onAnalyzeCircuit,
}: {
  onGenerateCircuit: (nodes: any[], edges: any[]) => void;
  onAnalyzeCircuit: () => Promise<string>;
}) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setAnalysis('');
    try {
      const res = await fetch('http://127.0.0.1:8000/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.detail === 'string' ? data.detail : `Circuit generation failed (${res.status}).`);
      }
      if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
        throw new Error('The server returned an invalid circuit. Try again.');
      }
      onGenerateCircuit(data.nodes, data.edges);
    } catch (err) {
      console.error(err);
      setAnalysis(`⚠️ ${err instanceof TypeError ? 'Cannot connect to the backend. Make sure uvicorn is running on port 8000.' : err instanceof Error ? err.message : 'Could not generate circuit. Try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    const feedback = await onAnalyzeCircuit();
    setAnalysis(feedback);
    setLoading(false);
  };

  return (
    <div className="bg-white border-b p-3 flex flex-col gap-2 shadow-sm">
      <div className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="✨ Ask AI: 'Build an LED alarm with LDR switch'..."
          className="flex-grow border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
        />
        <button
          onClick={handleGenerate}
          disabled={loading}
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
          💡 <strong>AI Doctor:</strong> {analysis}
        </div>
      )}
    </div>
  );
}
