import React from 'react';

export default function TargetConfirm({ title, onConfirm, onCancel, confirmLabel = 'Confirm' }) {
  return (
    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[9600] pointer-events-auto select-none">
      <div className="flex items-center gap-3 bg-black/70 border border-amber-900/30 rounded-full px-4 py-2 text-amber-100/90 font-mono text-[12px] shadow-2xl">
        <span>{title}</span>
        <button type="button" className="px-3 py-1 rounded-full text-[11px] font-black border border-emerald-400/40 bg-emerald-700/60 hover:bg-emerald-600/70" onClick={onConfirm}>{confirmLabel}</button>
        <button type="button" className="px-3 py-1 rounded-full text-[11px] font-black border border-amber-900/20 bg-slate-800/60 hover:bg-slate-700/60" onClick={onCancel}>Отмена</button>
      </div>
    </div>
  );
}
