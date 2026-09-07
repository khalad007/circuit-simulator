import { Handle, Position } from '@xyflow/react';

export default function LEDNode({ data }: { data: { status?: string } }) {
  const status = data.status || 'OFF';

  return (
    <div className="flex flex-col items-center border-2 border-gray-800 bg-white rounded-md p-3 w-32 shadow-md relative">
      {/* POSITIVE TERMINAL */}
      <div className="absolute -top-3 left-3 flex flex-col items-center">
        <Handle
          type="source"
          position={Position.Top}
          id="pos"
          className="!w-4 !h-4 !bg-red-500 !border-2 !border-white cursor-pointer"
        />
        <span className="text-[10px] text-red-600 font-bold mt-4">+</span>
      </div>

      {/* NEGATIVE TERMINAL */}
      <div className="absolute -top-3 right-3 flex flex-col items-center">
        <Handle
          type="source"
          position={Position.Top}
          id="neg"
          className="!w-4 !h-4 !bg-gray-800 !border-2 !border-white cursor-pointer"
        />
        <span className="text-[10px] text-gray-800 font-bold mt-4">-</span>
      </div>

      <div className="text-xs font-bold my-2 pt-2">LED</div>

      {/* Dynamic Visual State */}
      {status === 'BURNT' || status === 'BLOWN' ? (
        <div className="flex flex-col items-center led-explosion" role="status" aria-label="LED burnt out">
          <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-xl border-2 border-red-600 shadow-[0_0_20px_rgba(220,38,38,1)]">
            💥
          </div>
          <span className="text-[10px] text-red-600 font-extrabold mt-1 uppercase tracking-wider">BURNT</span>
        </div>
      ) : (
        <div
          className={`w-10 h-10 rounded-full border-2 border-gray-400 transition-all duration-300 ${
            status === 'ON'
              ? 'bg-yellow-400 border-yellow-500 shadow-[0_0_30px_rgba(250,204,21,1)]'
              : 'bg-gray-200'
          }`}
        />
      )}
    </div>
  );
}
