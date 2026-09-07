import { Handle, Position } from '@xyflow/react';

export default function SwitchNode({ data, id }: { data: { isOpen?: boolean; onToggleSwitch?: (id: string) => void }; id: string }) {
  const isOpen = data.isOpen ?? true;

  return (
    <div className="flex flex-col items-center border-2 border-gray-800 bg-emerald-50 rounded-md p-2 w-32 shadow-md relative">
      <Handle type="target" position={Position.Left} id="pos" className="!w-3 !h-3 !bg-gray-700 cursor-pointer" />
      
      <div className="text-[11px] font-bold text-gray-700">SPST Switch</div>

      {/* Schematic Switch Diagram */}
      <svg className="w-16 h-8 my-1 stroke-gray-900 fill-none stroke-2" viewBox="0 0 60 30">
        <circle cx="10" cy="20" r="3" className="fill-gray-900" />
        <circle cx="50" cy="20" r="3" className="fill-gray-900" />
        {isOpen ? (
          <line x1="10" y1="20" x2="45" y2="5" className="stroke-red-600 stroke-[3]" />
        ) : (
          <line x1="10" y1="20" x2="50" y2="20" className="stroke-emerald-600 stroke-[3]" />
        )}
      </svg>

      <button
        onClick={() => data.onToggleSwitch?.(id)}
        className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-colors ${
          isOpen ? 'bg-red-100 text-red-700 border-red-300' : 'bg-emerald-100 text-emerald-700 border-emerald-300'
        }`}
      >
        {isOpen ? 'OPEN (OFF)' : 'CLOSED (ON)'}
      </button>

      <Handle type="source" position={Position.Right} id="neg" className="!w-3 !h-3 !bg-gray-700 cursor-pointer" />
    </div>
  );
}