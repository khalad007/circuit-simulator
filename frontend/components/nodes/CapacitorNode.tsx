import { Handle, Position } from '@xyflow/react';

export default function CapacitorNode({
  data,
  id,
}: {
  data: { capacitance?: number; onChangeCapacitance?: (id: string, val: number) => void };
  id: string;
}) {
  const capacitance = data.capacitance ?? 10; // in uF

  return (
    <div className="flex flex-col items-center border-2 border-gray-800 bg-cyan-50 rounded-md p-2 w-32 shadow-md relative">
      <Handle type="target" position={Position.Left} id="pos" className="!w-3 !h-3 !bg-gray-700 cursor-pointer" />

      <div className="text-[11px] font-bold text-gray-700">Capacitor</div>

      {/* Capacitor Schematic Symbol */}
      <svg className="w-16 h-6 my-1 stroke-gray-900 fill-none stroke-2" viewBox="0 0 60 20">
        <line x1="0" y1="10" x2="25" y2="10" />
        <line x1="25" y1="2" x2="25" y2="18" className="stroke-[3]" />
        <line x1="35" y1="2" x2="35" y2="18" className="stroke-[3]" />
        <line x1="35" y1="10" x2="60" y2="10" />
      </svg>

      <div className="flex items-center gap-1">
        <input
          type="number"
          value={capacitance}
          onChange={(e) => data.onChangeCapacitance?.(id, Number(e.target.value))}
          className="w-14 text-center text-xs border border-gray-400 rounded px-1 py-0.5 font-mono"
        />
        <span className="text-xs font-bold">µF</span>
      </div>

      <Handle type="source" position={Position.Right} id="neg" className="!w-3 !h-3 !bg-gray-700 cursor-pointer" />
    </div>
  );
}