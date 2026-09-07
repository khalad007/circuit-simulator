import { Handle, Position } from '@xyflow/react';

export default function PushButtonNode({
  data,
  id,
}: {
  data: { isPressed?: boolean; onPushPress?: (id: string, pressed: boolean) => void };
  id: string;
}) {
  const isPressed = data.isPressed ?? false;

  return (
    <div className="flex flex-col items-center border-2 border-gray-800 bg-red-50 rounded-md p-2 w-32 shadow-md relative">
      <Handle type="source" position={Position.Left} id="pos" className="!w-3 !h-3 !bg-gray-700 cursor-pointer" />

      <div className="text-[11px] font-bold text-gray-800">Push Button</div>

      <button
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); data.onPushPress?.(id, true); }}
        onPointerUp={() => data.onPushPress?.(id, false)}
        onPointerCancel={() => data.onPushPress?.(id, false)}
        onLostPointerCapture={() => data.onPushPress?.(id, false)}
        onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); data.onPushPress?.(id, true); } }}
        onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') data.onPushPress?.(id, false); }}
        onBlur={() => data.onPushPress?.(id, false)}
        className={`nodrag w-12 h-12 my-1 rounded-full border-4 font-bold text-xs flex items-center justify-center transition-transform shadow-inner ${
          isPressed
            ? 'bg-red-600 border-red-800 scale-95 text-white shadow-lg'
            : 'bg-red-500 border-red-700 text-white hover:bg-red-600'
        }`}
      >
        PUSH
      </button>

      <span className="text-[9px] text-gray-500 font-mono">
        {isPressed ? 'HELD DOWN' : 'RELEASED'}
      </span>

      <Handle type="source" position={Position.Right} id="neg" className="!w-3 !h-3 !bg-gray-700 cursor-pointer" />
    </div>
  );
}
