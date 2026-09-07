import { Handle, Position } from '@xyflow/react';

export default function LEDNode({ data }: { data: { isOn?: boolean } }) {
  return (
    <div className="flex flex-col items-center border-2 border-gray-800 bg-white rounded-md p-2 w-24 shadow-md">
      {/* Negative Input */}
      <Handle
        type="target"
        position={Position.Top}
        id="neg"
        className="w-3 h-3 bg-gray-800 !-top-3 left-1/4"
      />
      {/* Positive Input */}
      <Handle
        type="target"
        position={Position.Top}
        id="pos"
        className="w-3 h-3 bg-red-500 !-top-3 left-3/4"
      />
      
      <div className="text-xs font-bold mb-2">LED</div>
      {/* The Lightbulb Visual */}
      <div 
        className={`w-8 h-8 rounded-full border-2 border-gray-400 transition-colors duration-300 ${
          data.isOn ? 'bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.8)]' : 'bg-gray-200'
        }`} 
      />
    </div>
  );
}