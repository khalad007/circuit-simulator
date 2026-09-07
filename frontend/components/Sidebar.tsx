import React from 'react';

const components = [
  { type: 'battery', label: '9V Battery', icon: '🔋' },
  { type: 'resistor', label: 'Resistor', icon: '⚡' },
  { type: 'led', label: 'LED Light', icon: '💡' },
  { type: 'switch', label: 'Toggle Switch', icon: '🔘' },
  { type: 'transistor', label: 'NPN Transistor', icon: '🔀' },
  { type: 'speaker', label: 'Speaker', icon: '🔊' },
  { type: 'ldr', label: 'LDR Sensor', icon: '☀️' },
];

export default function Sidebar() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-56 bg-white border-r border-gray-200 p-4 flex flex-col gap-3 shadow-md z-10">
      <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-1">Components</h2>
      <p className="text-[11px] text-gray-500 mb-2">Drag components onto the canvas:</p>
      
      {components.map((item) => (
        <div
          key={item.type}
          onDragStart={(e) => onDragStart(e, item.type)}
          draggable
          className="flex items-center gap-3 p-2.5 bg-gray-50 border border-gray-300 rounded-lg cursor-grab hover:bg-blue-50 hover:border-blue-400 transition-all shadow-sm"
        >
          <span className="text-lg">{item.icon}</span>
          <span className="text-xs font-semibold text-gray-800">{item.label}</span>
        </div>
      ))}

      <div className="mt-auto bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-800">
        💡 <strong>Remove Wires:</strong> Click any wire directly on the canvas to delete it!
      </div>
    </aside>
  );
}