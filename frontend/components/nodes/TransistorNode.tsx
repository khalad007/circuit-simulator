import { Handle, Position } from '@xyflow/react';

export default function TransistorNode() {
  return (
    <div className="flex flex-col items-center border-2 border-gray-800 bg-sky-50 rounded-md p-3 w-36 shadow-md relative">
      <div className="text-[11px] font-bold text-gray-800 mb-1">NPN Transistor</div>

      {/* Collector (Top) */}
      <div className="absolute -top-3 right-4 flex flex-col items-center">
        <Handle type="source" position={Position.Top} id="collector" className="!w-3 !h-3 !bg-blue-600" />
        <span className="text-[9px] font-bold mt-3">C</span>
      </div>

      {/* Base (Left) */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 flex items-center">
        <Handle type="source" position={Position.Left} id="base" className="!w-3 !h-3 !bg-amber-600" />
        <span className="text-[9px] font-bold ml-4">B</span>
      </div>

      {/* Schematic Diagram */}
      <svg className="w-12 h-12 my-1 stroke-gray-900 fill-none stroke-2" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="16" className="stroke-gray-400 stroke-1" />
        <line x1="12" y1="10" x2="12" y2="30" className="stroke-[3]" />
        <line x1="4" y1="20" x2="12" y2="20" />
        <line x1="12" y1="14" x2="28" y2="6" />
        <line x1="12" y1="26" x2="28" y2="34" />
      </svg>

      {/* Emitter (Bottom) */}
      <div className="absolute -bottom-3 right-4 flex flex-col items-center">
        <span className="text-[9px] font-bold mb-3">E</span>
        <Handle type="source" position={Position.Bottom} id="emitter" className="!w-3 !h-3 !bg-emerald-600" />
      </div>
    </div>
  );
}