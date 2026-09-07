import { Handle, Position } from '@xyflow/react';

export default function BatteryNode({ data, id }: { data: { voltage?: number; onChangeVoltage?: (id: string, val: number) => void }; id: string }) {
  const voltage = data.voltage ?? 9;

  return (
    <div className="flex flex-col items-center border-2 border-gray-800 bg-slate-100 rounded-md p-3 w-32 shadow-md relative">
      <div className="text-xs font-bold text-gray-800 mb-1">DC Power Source</div>

      {/* Dynamic Voltage Input */}
      <div className="flex items-center gap-1 my-1">
        <input
          type="number"
          aria-label="Battery voltage"
          min="0" max="10000000" step="any"
          value={voltage}
          onChange={(e) => data.onChangeVoltage?.(id, Number(e.target.value))}
          className="nodrag w-14 text-center text-xs border border-gray-400 rounded px-1 py-0.5 font-bold font-mono"
        />
        <span className="text-xs font-bold text-gray-700">V</span>
      </div>

      <div className="flex justify-between w-full mt-3">
        {/* Positive Port */}
        <div className="relative flex items-center">
          <Handle
            type="source"
            position={Position.Bottom}
            id="pos"
            className="!w-4 !h-4 !bg-red-500 !border-2 !border-white cursor-pointer"
          />
          <span className="text-xs text-red-600 font-extrabold ml-5">+</span>
        </div>
        {/* Negative Port */}
        <div className="relative flex items-center">
          <span className="text-xs text-gray-900 font-extrabold mr-5">-</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="neg"
            className="!w-4 !h-4 !bg-gray-800 !border-2 !border-white cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
