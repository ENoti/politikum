import React from 'react';
import usePublicProfile from '../../hooks/usePublicProfile.js';
import PublicProfileModal from '../profile/PublicProfileModal.jsx';

export default function ProfilePage({ playerId }) {
  const { open, close, loading, error, profile, openById } = usePublicProfile();

  React.useEffect(() => {
    if (!playerId) return;
    openById(playerId);
  }, [playerId, openById]);

  return (
    <div className="min-h-screen w-screen bg-cover bg-center bg-fixed bg-no-repeat text-slate-100 flex items-center justify-center" style={{ backgroundImage: "url('/assets/lobby_bg.webp')" }}>
      <div className="w-[min(760px,92vw)] rounded-3xl border border-amber-900/20 bg-black/55 backdrop-blur-md p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.35em] text-amber-500/70 font-black">Public profile</div>
            <div className="mt-2 text-amber-50 font-serif text-lg">Игрок {String(playerId || '—')}</div>
          </div>
          <a href="#/" className="px-3 py-2 rounded-xl bg-black/45 hover:bg-black/55 border border-amber-900/20 text-amber-50 font-black text-[11px]">Назад</a>
        </div>
        <div className="mt-4 text-amber-100/75 font-mono text-[12px]">
          {loading ? 'Загрузка профиля…' : error ? `Ошибка: ${error}` : profile?.ok ? 'Профиль загружен.' : 'Нет данных.'}
        </div>
      </div>
      <PublicProfileModal open={open} onClose={close} loading={loading} error={error} profile={profile} />
    </div>
  );
}
