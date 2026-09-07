import { Handle, Position } from '@xyflow/react';

export default function ResistorNode({ data, id }: { data: { resistance?: number; onChangeResistance?: (id: string, val: number) => void }; id: string }) {
  const value = data.resistance ?? 330;

  return (
    <div className="flex flex-col items-center border-2 border-gray-800 bg-amber-50 rounded-md p-2 w-32 shadow-md relative">
      {/* Left Handle */}
      <Handle
        type="source"
        position={Position.Left}
        id="pos"
        className="!w-3 !h-3 !bg-gray-700 cursor-pointer"
      />

      <div className="text-[11px] font-bold text-gray-700">Resistor</div>
      
      {/* Schematic Zigzag Line Symbol */}
      <svg className="w-16 h-6 my-1 stroke-gray-900 fill-none stroke-2" viewBox="0 0 60 20">
        <path d="M 0 10 L 10 10 L 15 2 L 25 18 L 35 2 L 45 18 L 50 10 L 60 10" />
      </svg>

      {/* Input to change Resistance Value */}
      <div className="flex items-center gap-1 mt-1">
        <input
          type="number"
          value={value}
          onChange={(e) => data.onChangeResistance?.(id, Number(e.target.value))}
          className="nodrag w-16 text-center text-xs border border-gray-400 rounded px-1 py-0.5 font-mono"
        />
        <span className="text-xs font-bold">Ω</span>
      </div>

      {/* Right Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="neg"
        className="!w-3 !h-3 !bg-gray-700 cursor-pointer"
      />
    </div>
  );
}