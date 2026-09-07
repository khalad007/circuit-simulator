import { Handle, Position } from '@xyflow/react';

export default function LDRNode({ data, id }: { data: { lightLevel?: number; onChangeLight?: (id: string, val: number) => void }; id: string }) {
  const light = data.lightLevel ?? 50;

  return (
    <div className="flex flex-col items-center border-2 border-gray-800 bg-yellow-50 rounded-md p-2 w-36 shadow-md relative">
      <Handle type="target" position={Position.Left} id="pos" className="!w-3 !h-3 !bg-gray-700 cursor-pointer" />

      <div className="text-[11px] font-bold text-gray-700">LDR (Photoresistor)</div>

      <div className="flex items-center gap-1 my-1 w-full px-2">
        <span className="text-[10px]">☀️</span>
        <input
          type="range"
          min="0"
          max="100"
          value={light}
          onChange={(e) => data.onChangeLight?.(id, Number(e.target.value))}
          className="w-full h-1 bg-gray-300 rounded accent-yellow-600 cursor-pointer"
        />
      </div>
      <span className="text-[10px] font-mono">Light: {light}%</span>

      <Handle type="source" position={Position.Right} id="neg" className="!w-3 !h-3 !bg-gray-700 cursor-pointer" />
    </div>
  );
}