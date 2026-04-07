import React from "react";

export default function AdminProfileModal({ open, onClose, loading, error, profile }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/55 backdrop-blur-sm pointer-events-auto">
      <div className="w-[min(520px,92vw)] max-h-[92vh] overflow-auto rounded-2xl border border-amber-900/30 bg-black/60 shadow-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-amber-100 font-black text-sm">Профиль</div>
            <div className="text-amber-200/70 font-mono text-[12px] mt-1">Доступен всем</div>
          </div>
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 border border-amber-900/20 text-amber-50 font-black text-[10px] uppercase tracking-widest">Закрыть</button>
        </div>
        {loading && <div className="mt-4 text-amber-200/80 font-mono text-[12px]">loading…</div>}
        {!loading && error && <div className="mt-4 text-red-200/90 font-mono text-[12px]">{error}</div>}
        {!loading && !error && profile?.ok && (
          <div className="mt-4 text-amber-100/90 font-mono text-[12px] space-y-2">
            <div><span className="opacity-60">Name:</span> {profile.name || profile.playerName || profile.playerId}</div>
            <div><span className="opacity-60">Рейтинг:</span> {profile.rating ?? '—'}</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-black/30 border border-amber-900/20 rounded-xl p-2"><div className="opacity-60 text-[10px]">Games</div><div className="font-black">{profile.games ?? '—'}</div></div>
              <div className="bg-black/30 border border-amber-900/20 rounded-xl p-2"><div className="opacity-60 text-[10px]">Wins</div><div className="font-black">{profile.wins ?? '—'}</div></div>
              <div className="bg-black/30 border border-amber-900/20 rounded-xl p-2"><div className="opacity-60 text-[10px]">Win%</div><div className="font-black">{profile.winRate != null ? `${Math.round(Number(profile.winRate) * 100)}%` : '—'}</div></div>
            </div>
            {(profile.bioText || '').trim() && <div className="mt-2 whitespace-pre-wrap text-amber-100/80">{String(profile.bioText)}</div>}
            {!!profile.playerId && (
              <a className="inline-block mt-2 px-3 py-2 rounded-xl bg-black/40 hover:bg-black/55 border border-amber-900/20 text-amber-50 font-black text-[11px]" href={`#/`} onClick={(e) => { e.preventDefault(); window.open(`/profile/${encodeURIComponent(String(profile.playerId))}`, '_blank'); }}>
                Открыть публичный профиль
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
