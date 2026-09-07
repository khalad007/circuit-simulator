import React from 'react';

const components = [
  { type: 'battery', label: '9V Battery', icon: '🔋' },
  { type: 'resistor', label: 'Resistor', icon: '⚡' },
  { type: 'led', label: 'LED Light', icon: '💡' },
  { type: 'switch', label: 'Toggle Switch', icon: '🔘' },
  { type: 'pushbutton', label: 'Push Button', icon: '🔴' },
  { type: 'capacitor', label: 'Capacitor', icon: '🔋' },
  { type: 'transistor', label: 'NPN Transistor', icon: '🔀' },
  { type: 'speaker', label: 'Siren / Speaker', icon: '🔊' },
  { type: 'ldr', label: 'LDR Sensor', icon: '☀️' },
];

export default function Sidebar({ onSelectTemplate }: { onSelectTemplate: (templateName: string) => void }) {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-60 bg-white border-r border-gray-200 p-4 flex flex-col gap-4 shadow-md z-10 overflow-y-auto">
      {/* PRE-BUILT CIRCUITS SECTION */}
      <div>
        <h2 className="text-xs font-extrabold text-blue-600 uppercase tracking-wider mb-2">⚡ Pre-Built Circuits</h2>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onSelectTemplate('siren')}
            className="w-full text-left p-2 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg text-xs font-bold text-red-800 flex items-center gap-2 shadow-sm transition-all"
          >
            🚨 Emergency Siren Circuit
          </button>
          <button
            onClick={() => onSelectTemplate('flipflop')}
            className="w-full text-left p-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg text-xs font-bold text-indigo-800 flex items-center gap-2 shadow-sm transition-all"
          >
            🔄 Transistor Flip-Flop
          </button>
          <button
            onClick={() => onSelectTemplate('ldr')}
            className="w-full text-left p-2 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg text-xs font-bold text-amber-800 flex items-center gap-2 shadow-sm transition-all"
          >
            ☀️ LDR Light Sensor Alarm
          </button>
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* DRAG AND DROP COMPONENTS */}
      <div>
        <h2 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2">Components</h2>
        <div className="flex flex-col gap-2">
          {components.map((item) => (
            <div
              key={item.type}
              onDragStart={(e) => onDragStart(e, item.type)}
              draggable
              className="flex items-center gap-3 p-2 bg-gray-50 border border-gray-300 rounded-lg cursor-grab hover:bg-blue-50 hover:border-blue-400 transition-all shadow-sm"
            >
              <span className="text-base">{item.icon}</span>
              <span className="text-xs font-semibold text-gray-800">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}