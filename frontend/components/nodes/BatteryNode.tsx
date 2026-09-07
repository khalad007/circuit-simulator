import { Handle, Position } from '@xyflow/react';

export default function BatteryNode() {
  return (
    <div className="flex flex-col items-center border-2 border-gray-800 bg-gray-100 rounded-md p-2 w-24 shadow-md">
      <div className="text-xs font-bold mb-1">9V Battery</div>
      {/* Positive Terminal (Red) */}
      <div className="flex justify-between w-full mt-2">
        <div className="relative flex items-center justify-center">
          <span className="text-[10px] text-red-600 font-bold mr-1">+</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="pos"
            className="w-3 h-3 bg-red-500 !-bottom-3"
          />
        </div>
        {/* Negative Terminal (Black) */}
        <div className="relative flex items-center justify-center">
          <span className="text-[10px] text-gray-800 font-bold mr-1">-</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="neg"
            className="w-3 h-3 bg-gray-800 !-bottom-3"
          />
        </div>
      </div>
    </div>
  );
}