import React from "react";

export default function PublicProfileModal({ open, onClose, loading, error, profile }) {
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
            <div className="flex items-center gap-4">
              <div className="w-24 aspect-[2/3] rounded-xl overflow-hidden border border-amber-900/20 bg-black/30">
                <img
                  src={`/public/profile_image/${encodeURIComponent(String(profile.playerId || ''))}.jpg`}
                  onError={(e) => { try { e.currentTarget.src = `/cards/persona_${1 + ((Number(String(profile.playerId || '').split('').reduce((a,c)=>a+c.charCodeAt(0),0)) || 0) % 45)}.webp`; } catch {} }}
                  className="w-full h-full object-cover"
                  alt="avatar"
                  draggable={false}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <div><span className="text-amber-200/70">PlayerId:</span> {String(profile.playerId || '')}</div>
                  <a className="px-3 py-2 rounded-xl bg-black/45 hover:bg-black/55 border border-amber-900/20 text-amber-50 font-black text-[10px] uppercase tracking-widest" href={`/profile/${encodeURIComponent(String(profile.playerId || ''))}`} target="_blank" rel="noreferrer">Открыть публичный профиль</a>
                </div>
                <div><span className="text-amber-200/70">Имя:</span> {String(profile.name || profile.username || '—')}</div>
                <div><span className="text-amber-200/70">Рейтинг:</span> {Math.round(Number(profile.rating || 0))}</div>
                <div><span className="text-amber-200/70">Игр:</span> {Number(profile.games || 0)}</div>
                <div><span className="text-amber-200/70">Побед:</span> {Number(profile.wins || 0)} ({profile.games ? Math.round((Number(profile.wins || 0) / Math.max(1, Number(profile.games || 0))) * 100) : 0}%)</div>
                {String(profile.bioText || '').trim() && (
                  <div className="mt-3 pt-3 border-t border-amber-900/20">
                    <div className="text-amber-200/70 text-[10px] uppercase tracking-[0.3em] font-black">about</div>
                    <div className="mt-2 whitespace-pre-wrap text-amber-50/85">{String(profile.bioText || '').trim()}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
