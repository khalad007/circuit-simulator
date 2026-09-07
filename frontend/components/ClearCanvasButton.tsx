'use client';

import { useRef, useState } from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Trash2 } from 'lucide-react';

export default function ClearCanvasButton({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);

  return <AlertDialog.Root open={open} onOpenChange={setOpen}>
    <AlertDialog.Trigger className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">
      <Trash2 size={14} aria-hidden="true" /> Clear Canvas
    </AlertDialog.Trigger>
    <AlertDialog.Portal>
      <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm" />
      <AlertDialog.Popup initialFocus={cancel} className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600"><Trash2 size={23} aria-hidden="true" /></div>
        <AlertDialog.Title className="text-lg font-bold text-slate-900">Clear your canvas?</AlertDialog.Title>
        <AlertDialog.Description className="mt-2 text-sm leading-6 text-slate-600">
          Are you sure you want to clear your progress? All components and wires will be removed, and the simulation will stop. This cannot be undone.
        </AlertDialog.Description>
        <p className="mt-3 text-xs text-slate-500">Save your circuit as JSON first if you want to keep a copy.</p>
        <div className="mt-6 flex justify-end gap-3">
          <AlertDialog.Close ref={cancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500">Cancel</AlertDialog.Close>
          <button onClick={() => { onConfirm(); setOpen(false); }} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">Yes, clear canvas</button>
        </div>
      </AlertDialog.Popup>
    </AlertDialog.Portal>
  </AlertDialog.Root>;
}
