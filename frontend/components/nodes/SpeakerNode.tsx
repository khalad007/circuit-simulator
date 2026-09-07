import { Handle, Position } from '@xyflow/react';

export default function SpeakerNode({ data }: { data: { isPlaying?: boolean } }) {
  return (
    <div className="flex flex-col items-center border-2 border-gray-800 bg-purple-50 rounded-md p-2 w-32 shadow-md relative">
      <Handle type="target" position={Position.Left} id="pos" className="!w-3 !h-3 !bg-red-500 cursor-pointer" />

      <div className="text-[11px] font-bold text-gray-700">8Ω Speaker</div>

      <div className={`my-2 text-2xl transition-transform ${data.isPlaying ? 'animate-ping' : ''}`}>
        🔊
      </div>

      <Handle type="source" position={Position.Right} id="neg" className="!w-3 !h-3 !bg-gray-800 cursor-pointer" />
    </div>
  );
}