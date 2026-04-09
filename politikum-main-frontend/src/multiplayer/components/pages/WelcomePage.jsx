import React, { useEffect, useMemo, useState } from 'react';
import { SERVER, createMatchApi, getMatchApi, joinMatchApi, renameMatchOwnerApi, deleteMatchOwnerApi } from '../../api.js';
import usePublicLobbyData from '../../hooks/usePublicLobbyData.js';
import usePublicProfile from '../../hooks/usePublicProfile.js';
import NewsPanel from '../content/NewsPanel.jsx';
import PublicProfileModal from '../profile/PublicProfileModal.jsx';

const NAMES = [
  'Hakon', 'Rixa', 'Gisela', 'Dunstan', 'Irmgard', 'Cedric', 'Freya', 'Ulric', 'Yolanda', 'Tristan',
  'Beatrix', 'Lambert', 'Maude', 'Odilia', 'Viggo', 'Sibylla', 'Katarina', 'Norbert', 'Quintus',
];

function SectionCard({ title, eyebrow, right, className = '', children }) {
  return (
    <section className={`rounded-[28px] border border-amber-500/20 bg-[linear-gradient(180deg,rgba(20,10,8,0.84),rgba(10,6,5,0.72))] shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-md ${className}`}>
      <div className="px-6 pt-5 pb-4 border-b border-amber-500/10 flex items-center justify-between gap-3">
        <div>
          {eyebrow ? <div className="text-[10px] uppercase tracking-[0.38em] text-amber-200/45 font-black">{eyebrow}</div> : null}
          <div className="mt-1 text-[24px] leading-none font-serif font-bold text-amber-100">{title}</div>
        </div>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function SmallStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-amber-400/10 bg-black/25 px-4 py-3 min-w-[120px]">
      <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/40 font-black">{label}</div>
      <div className="mt-1 text-xl font-black text-amber-50">{value}</div>
    </div>
  );
}

function LobbyRow({ title, subtitle, status, statusTone = 'open', players, onClick, actionLabel = 'Подключиться' }) {
  const toneClass = statusTone === 'live'
    ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
    : statusTone === 'private'
      ? 'text-amber-200 bg-amber-500/10 border-amber-500/20'
      : 'text-amber-100 bg-amber-100/10 border-amber-100/10';

  return (
    <div className="rounded-[22px] border border-amber-500/12 bg-black/30 px-4 py-4 hover:bg-black/40 transition-colors">
      <div className="flex items-start gap-4 justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-lg font-serif font-bold text-amber-50 truncate">{title}</div>
            {status ? <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.22em] border font-black ${toneClass}`}>{status}</span> : null}
          </div>
          <div className="mt-2 text-xs font-mono text-amber-100/55">{subtitle}</div>
        </div>
        <div className="flex flex-col items-end gap-3 shrink-0">
          {players ? <div className="text-sm font-black text-amber-100">{players}</div> : null}
          <button type="button" onClick={onClick} className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black uppercase tracking-[0.18em] text-[11px] shadow-[0_8px_24px_rgba(251,191,36,0.28)]">
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PolitikumWelcome({ onJoin }) {
  const [playerName, setPlayerName] = useState(() => {
    try {
      const saved = window.localStorage.getItem('politikum.playerName');
      if (saved && String(saved).trim()) return String(saved);
    } catch {}
    const base = NAMES[Math.floor(Math.random() * NAMES.length)];
    return `[H] ${base}`;
  });
  const [loading, setLoading] = useState(false);
  const [authToken, setAuthToken] = useState(() => {
    try { return String(window.localStorage.getItem('politikum.authToken') || ''); } catch { return ''; }
  });
  const [authRating, setAuthRating] = useState(null);
  const [betaPassword, setBetaPassword] = useState('');
  const [betaLoading, setBetaLoading] = useState(false);
  const [betaErr, setBetaErr] = useState('');
  const [rightTab, setRightTab] = useState(() => {
    try { return String(window.localStorage.getItem('politikum.welcomeRightTab') || 'games'); } catch {}
    return 'games';
  });
  const [showWhereAmI, setShowWhereAmI] = useState(false);
  const [ratingsMap, setRatingsMap] = useState(() => ({}));
  const [lobbyTitle, setLobbyTitle] = useState('');
  const [showRules, setShowRules] = useState(false);

  const { open: showProfile, close: closeProfile, loading: profileLoading, error: profileErr, profile, openById: openProfileById } = usePublicProfile();

  const {
    matches, top10, tournaments, tournamentsErr, top10Err,
    lobbyChat, lobbyChatEnabled, lobbyChatErr, lobbyChatInput,
    setLobbyChatInput, sendLobbyChat, myMatches, refreshMatches, refreshMyMatches,
  } = usePublicLobbyData({ authToken, playerName });

  useEffect(() => {
    try { window.localStorage.setItem('politikum.welcomeRightTab', rightTab); } catch {}
  }, [rightTab]);

  useEffect(() => {
    try { window.localStorage.setItem('politikum.playerName', playerName); } catch {}
  }, [playerName]);

  useEffect(() => {
    (async () => {
      try {
        const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));
        const ids = uniq([
          ...((lobbyChat || []).map((m) => String(m?.playerId || '').trim())),
          (() => { try { return String(window.localStorage.getItem('politikum.sessionPlayerId') || ''); } catch { return ''; } })(),
        ]);
        const m = {};
        await Promise.all(ids.map(async (pid) => {
          if (!pid) return;
          try {
            const res = await fetch(`${SERVER}/public/profile/${encodeURIComponent(pid)}`, { cache: 'no-store' });
            if (!res.ok) return;
            const json = await res.json();
            if (!json?.ok) return;
            const rating = Math.round(Number(json?.rating || 0));
            if (Number.isFinite(rating)) m[String(pid)] = rating;
          } catch {}
        }));
        setRatingsMap(m);
        if (!authToken) { setAuthRating(null); return; }
        const pid = (() => { try { return String(window.localStorage.getItem('politikum.sessionPlayerId') || ''); } catch { return ''; } })();
        if (!pid) { setAuthRating(null); return; }
        const rating = m[String(pid)] ?? null;
        if (rating != null) setAuthRating(Number(rating));
      } catch {}
    })();
  }, [authToken, lobbyChat]);

  const doBetaLogin = async () => {
    const pw = String(betaPassword || '').trim();
    if (!pw) return;
    setBetaLoading(true);
    setBetaErr('');
    try {
      const deviceId = (() => {
        try {
          let d = window.localStorage.getItem('politikum.deviceId');
          if (!d) {
            d = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
            window.localStorage.setItem('politikum.deviceId', d);
          }
          return d;
        } catch {
          return null;
        }
      })();
      const res = await fetch(`${SERVER}/auth/register_or_login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: String(playerName || '').trim(), token: pw, deviceId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const tok = String(json?.token || '');
      const sessionPlayerId = String(json?.playerId || '');
      if (!tok) throw new Error('no_token');
      setAuthToken(tok);
      try { window.localStorage.setItem('politikum.authToken', tok); } catch {}
      if (sessionPlayerId) {
        try { window.localStorage.setItem('politikum.sessionPlayerId', sessionPlayerId); } catch {}
      }
      setBetaPassword('');
    } catch (e) {
      setBetaErr(e?.message || String(e));
    } finally {
      setBetaLoading(false);
    }
  };

  const createMatch = async () => {
    if (!playerName) return alert('Enter your name first!');

    const suggestedTitle = String(lobbyTitle || '').trim() || `Игра ${String(playerName || '').trim()}`;
    const requestedTitle = window.prompt('Название новой игры', suggestedTitle);
    if (requestedTitle == null) return;

    const nextTitle = String(requestedTitle || '').trim();
    setLobbyTitle(nextTitle);
    try { window.localStorage.setItem('politikum.currentLobbyTitle', nextTitle || `Игра ${String(playerName || '').trim()}`); } catch {}

    setLoading(true);
    try {
      const setupData = { hostName: playerName };
      if (nextTitle) setupData.lobbyTitle = nextTitle;
      const json = await createMatchApi({ numPlayers: 5, setupData });
      const matchID = String(json?.matchID || json?.matchId || '');
      if (!matchID) throw new Error('matchID_missing');
      setTimeout(() => joinMatch(matchID), 150);
    } catch (e) {
      alert('createMatch failed: ' + (e?.message || String(e)));
      setLoading(false);
    }
  };

  const joinMatch = async (matchID) => {
    if (!playerName) return alert('Enter your name first!');
    setLoading(true);
    try {
      const match = await getMatchApi(matchID);
      if (!match || !match.players) throw new Error('Match not found');
      const seats = Array.isArray(match.players) ? match.players : Object.values(match.players || {});
      let sessionPlayerId = '';
      try { sessionPlayerId = String(window.localStorage.getItem('politikum.sessionPlayerId') || '').trim(); } catch {}
      const reservedSeat = sessionPlayerId ? seats.find((p) => String(p?.data?.playerId || '') === sessionPlayerId) : null;
      const freeSeat = reservedSeat || seats.find((p) => !p.name && !p.isConnected && !p.isBot);
      if (!freeSeat) throw new Error('Match is full');
      const displayTitle = String(match?.setupData?.lobbyTitle || match?.setupData?.hostName || '').trim();
      try { window.localStorage.setItem('politikum.currentLobbyTitle', displayTitle); } catch {}
      const json = await joinMatchApi(matchID, { playerID: String(freeSeat.id), playerName });
      const playerCredentials = String(json?.playerCredentials || '');
      if (!playerCredentials) throw new Error('playerCredentials_missing');
      window.localStorage.setItem('politikum.playerName', playerName);
      onJoin({ matchID, playerID: String(freeSeat.id), credentials: playerCredentials });
    } catch (e) {
      alert('Join failed: ' + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  };

  const renameOwnedMatch = async (match) => {
    const currentTitle = String(match?.setupData?.lobbyTitle || match?.setupData?.hostName || '').trim();
    const nextTitle = window.prompt('Новое название лобби', currentTitle || '');
    if (nextTitle == null) return;
    const trimmed = String(nextTitle || '').trim();
    if (!trimmed) return alert('Название не может быть пустым');
    try {
      await renameMatchOwnerApi(match.matchID || match.matchId, { lobbyTitle: trimmed });
      await refreshMatches?.();
      await refreshMyMatches?.();
    } catch (e) {
      alert('Не удалось переименовать лобби: ' + (e?.message || String(e)));
    }
  };

  const deleteOwnedMatch = async (match) => {
    const matchId = String(match?.matchID || match?.matchId || '');
    if (!matchId) return;
    if (!window.confirm('Удалить это лобби/игру из списка?')) return;
    try {
      await deleteMatchOwnerApi(matchId);
      await refreshMatches?.();
      await refreshMyMatches?.();
    } catch (e) {
      alert('Не удалось удалить лобби: ' + (e?.message || String(e)));
    }
  };

  useEffect(() => {
    let mid = '';
    try { mid = String(window.localStorage.getItem('politikum.prejoinMatchId') || ''); } catch {}
    mid = String(mid || '').trim();
    if (!mid) return;
    try { window.localStorage.removeItem('politikum.prejoinMatchId'); } catch {}
    joinMatch(mid).catch(() => {});
  }, []);

  const publicMatches = useMemo(() => {
    return (matches || []).filter((match) => {
      if (match.gameover) return false;
      const seats = Array.isArray(match.players) ? match.players : Object.values(match.players || {});
      return seats.some((p) => p && p.name == null);
    });
  }, [matches]);

  const activeGameCount = publicMatches.length;
  const onlineCount = (lobbyChat?.length || 0) + (top10?.length || 0);

  return (
    <div className="relative min-h-screen w-screen overflow-hidden text-slate-100" style={{ backgroundImage: "url('/assets/lobby_bg.webp')", backgroundSize: 'cover', backgroundPosition: 'center top', backgroundRepeat: 'no-repeat' }}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center_bottom,rgba(255,228,145,0.28),transparent_23%),linear-gradient(180deg,rgba(12,7,6,0.32),rgba(8,4,4,0.62))]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,5,5,0.58)_0%,rgba(10,5,5,0.18)_24%,rgba(10,5,5,0.0)_50%,rgba(10,5,5,0.18)_76%,rgba(10,5,5,0.58)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[22vh] bg-[linear-gradient(180deg,rgba(10,5,5,0)_0%,rgba(10,5,5,0.3)_45%,rgba(10,5,5,0.88)_100%)]" />

      {showRules && (
        <div className="fixed inset-0 z-[9100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-[min(1100px,96vw)] h-[min(88vh,900px)] rounded-3xl border border-amber-700/30 bg-slate-950/95 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-amber-900/30 bg-black/30">
              <div>
                <div className="text-[10px] uppercase tracking-[0.35em] text-amber-300/60">Правила игры</div>
                <div className="text-xl font-black text-amber-50">Политикум — инструкция</div>
              </div>
              <button type="button" onClick={() => setShowRules(false)} className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-amber-950 font-black uppercase tracking-widest">Закрыть</button>
            </div>
            <div className="flex-1 bg-white/95">
              <object data="/politikum-rules.pdf" type="application/pdf" className="w-full h-full">
                <iframe src="/politikum-rules.pdf" title="Правила игры Политикум" className="w-full h-full" />
              </object>
            </div>
          </div>
        </div>
      )}

      {showWhereAmI && (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/55 backdrop-blur-sm pointer-events-auto">
          <div className="w-[min(1100px,95vw)] max-h-[92vh] overflow-auto rounded-2xl border border-amber-900/30 bg-black/60 shadow-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div><div className="text-amber-100 font-black text-sm">Что я? Где я?</div></div>
              <button type="button" onClick={() => setShowWhereAmI(false)} className="px-3 py-2 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 border border-amber-900/20 text-amber-50 font-black text-[10px] uppercase tracking-widest">Закрыть (Esc)</button>
            </div>
            <div className="mt-4"><img src="/assets/ui/tutorial.webp" alt="Tutorial" className="w-full rounded-xl border border-amber-900/20 shadow-[0_30px_80px_rgba(0,0,0,0.55)]" draggable={false} /></div>
          </div>
        </div>
      )}

      <PublicProfileModal open={showProfile} onClose={closeProfile} loading={profileLoading} error={profileErr} profile={profile} />

      <div className="relative z-10 min-h-screen px-4 md:px-8 pb-10 pt-4">
        <header className="mx-auto max-w-[1520px] rounded-[28px] border border-amber-500/15 bg-[linear-gradient(180deg,rgba(28,15,11,0.75),rgba(12,7,6,0.55))] shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md px-4 md:px-6 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <button type="button" onClick={() => setShowWhereAmI(true)} className="px-4 py-2 rounded-xl bg-black/35 hover:bg-black/50 border border-amber-500/15 text-amber-100 font-black text-[10px] uppercase tracking-[0.28em] whitespace-nowrap">Помощь</button>
            <button type="button" onClick={() => setShowRules(true)} className="px-4 py-2 rounded-xl bg-black/35 hover:bg-black/50 border border-amber-500/15 text-amber-100 font-black text-[10px] uppercase tracking-[0.28em] whitespace-nowrap">Правила игры</button>
            {String(playerName || '').trim().toLowerCase() === 'konsta' && (
              <a href="#/admin" target="_blank" rel="noreferrer" className="px-4 py-2 rounded-xl bg-black/35 hover:bg-black/50 border border-amber-500/15 text-amber-200 font-black text-[10px] uppercase tracking-[0.28em] whitespace-nowrap">Admin</a>
            )}
          </div>

          {authToken ? (
            <div className="flex items-center gap-3 flex-wrap justify-end">
              <div className="rounded-xl border border-amber-500/10 bg-amber-50/90 px-4 py-2 text-stone-900 flex items-center gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-stone-500 font-black">Профиль</div>
                  <div className="font-serif text-lg font-bold">{String(playerName || 'User').trim() || 'User'}</div>
                </div>
                {(authRating != null && !Number.isNaN(Number(authRating))) && (
                  <button type="button" className="px-3 py-2 rounded-xl bg-stone-900 text-amber-50 font-black hover:bg-black" title="Открыть профиль" onClick={async () => { const pid = String(window.localStorage.getItem('politikum.sessionPlayerId') || '').trim(); openProfileById(pid); }}>{Math.round(Number(authRating))}</button>
                )}
              </div>
              <button type="button" onClick={() => { try { window.localStorage.removeItem('politikum.authToken'); } catch {} try { window.localStorage.removeItem('politikum.sessionPlayerId'); } catch {} setAuthToken(''); setAuthRating(null); }} className="px-4 py-3 rounded-xl bg-stone-900/85 hover:bg-black text-amber-100 font-black text-[11px] uppercase tracking-[0.25em]">Выйти</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="w-[220px] max-w-[40vw] rounded-xl border border-amber-500/15 bg-amber-50/90 px-4 py-3 text-stone-900 font-serif text-sm focus:outline-none" placeholder="Твой ник" />
              <input value={betaPassword} onChange={(e) => setBetaPassword(e.target.value)} type="password" placeholder="token" className="w-[220px] max-w-[40vw] rounded-xl border border-amber-500/15 bg-amber-50/90 px-4 py-3 text-stone-900 font-mono text-sm focus:outline-none" />
              <button type="button" onClick={doBetaLogin} disabled={betaLoading || !String(betaPassword || '').trim()} className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-stone-950 font-black text-[11px] uppercase tracking-[0.25em]">{betaLoading ? '...' : 'Войти'}</button>
              <div className="text-[11px] font-mono text-amber-100/75">{betaErr ? betaErr : 'Гостевой режим'}</div>
            </div>
          )}
        </header>

        <main className="relative mx-auto max-w-[1520px] pt-6 md:pt-10 grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)_420px] gap-6 items-start">
          <div className="order-2 xl:order-1 space-y-5">
            <SectionCard title="Новости" eyebrow="Сводка" className="overflow-hidden">
              <NewsPanel />
            </SectionCard>

            <SectionCard title="Чат лобби" eyebrow="Общий канал" className="min-h-[420px] flex flex-col">
              <div className="flex-1 min-h-[260px] max-h-[320px] overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {!lobbyChatEnabled && <div className="bg-red-950/35 border border-red-900/40 rounded-2xl px-4 py-3"><div className="text-[10px] font-mono text-red-200/70">System</div><div className="text-sm font-serif text-red-50/90">Lobby chat is disabled by admin.</div></div>}
                {!!lobbyChatErr && <div className="bg-black/35 border border-amber-900/20 rounded-2xl px-4 py-3"><div className="text-[10px] font-mono text-amber-200/50">System</div><div className="text-sm font-serif text-amber-50/80">Chat error: {lobbyChatErr}</div></div>}
                {(lobbyChat || []).map((m, idx) => {
                  const isMe = String(m?.name || '') === String(playerName || '');
                  return (
                    <div key={m.id ?? idx} className={isMe ? 'rounded-2xl border border-amber-500/12 bg-amber-500/10 px-4 py-3' : 'rounded-2xl border border-amber-500/10 bg-black/28 px-4 py-3'}>
                      <div className="text-[10px] font-mono text-amber-200/55 flex items-center gap-2">
                        <span className={m?.playerId ? 'cursor-pointer hover:text-amber-100' : ''} onClick={() => { if (m?.playerId) openProfileById(m.playerId); }}>{m.name || m.playerId || 'Anon'}</span>
                        {(m?.playerId && (ratingsMap[String(m.playerId)] != null)) && <button type="button" className="px-2 py-0.5 rounded-lg bg-black/35 hover:bg-black/45 border border-amber-900/20 text-amber-100/80 font-black" title="Открыть профиль" onClick={() => openProfileById(m.playerId)}>{ratingsMap[String(m.playerId)]}</button>}
                      </div>
                      <div className="mt-1 text-base font-serif text-amber-50/92 whitespace-pre-wrap">{m.text}</div>
                    </div>
                  );
                })}
                {(!(lobbyChat || []).length && !lobbyChatErr) && <div className="bg-black/35 border border-amber-900/20 rounded-2xl px-4 py-3"><div className="text-[10px] font-mono text-amber-200/50">System</div><div className="text-sm font-serif text-amber-50/80">Скажи всем привет.</div></div>}
              </div>
              <div className="mt-4 flex gap-2">
                <input value={lobbyChatInput} onChange={(e) => setLobbyChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendLobbyChat(); } }} placeholder={authToken ? (lobbyChatEnabled ? 'Напиши что-нибудь…' : 'Чат выключен') : 'Войди, чтобы писать…'} disabled={!authToken || !lobbyChatEnabled} className="flex-1 rounded-xl border border-amber-500/12 bg-black/35 px-4 py-3 text-amber-100 font-serif text-sm focus:outline-none disabled:opacity-60" />
                <button type="button" onClick={sendLobbyChat} disabled={!authToken || !lobbyChatEnabled || !String(lobbyChatInput||'').trim()} className="px-5 py-3 rounded-xl bg-amber-500 text-stone-950 font-black uppercase tracking-[0.18em] text-[11px] shadow-[0_8px_24px_rgba(251,191,36,0.28)] transition-all disabled:opacity-60 hover:bg-amber-400">Отправить</button>
              </div>
            </SectionCard>
          </div>

          <div className="order-1 xl:order-2 min-h-[620px] flex flex-col items-center justify-between gap-8 px-2 xl:px-8 pt-4 xl:pt-10">
            <div className="w-full max-w-[760px] text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/15 bg-black/25 px-5 py-2 text-[11px] uppercase tracking-[0.34em] text-amber-100/70 font-black shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                Premium Poster Lobby
              </div>
              <h1 className="mt-8 text-[84px] md:text-[120px] xl:text-[138px] leading-[0.88] font-black tracking-tight text-amber-50 drop-shadow-[0_0_18px_rgba(255,226,164,0.22)]">
                ПОЛИ<br />ТИКУМ
              </h1>
              <p className="mt-5 text-xl md:text-[34px] leading-tight font-bold text-amber-50/92 drop-shadow-[0_4px_12px_rgba(0,0,0,0.28)]">
                Собери оппозиционеров<br className="hidden md:block" /> за одним столом.
              </p>
            </div>

            <div className="w-full max-w-[640px] rounded-[34px] border border-amber-400/20 bg-[linear-gradient(180deg,rgba(28,15,11,0.82),rgba(16,9,8,0.62))] shadow-[0_30px_80px_rgba(0,0,0,0.4)] backdrop-blur-md px-6 md:px-8 py-7 text-center">
              <div className="text-[11px] uppercase tracking-[0.34em] text-amber-200/55 font-black">Главное действие</div>
              <div className="mt-2 text-lg md:text-2xl font-serif text-amber-50/90">Создай лобби и пригласи друзей. Или зайди в уже открытое.</div>
              <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={createMatch} disabled={loading} className="min-w-[280px] px-8 py-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-lg uppercase tracking-[0.22em] shadow-[0_14px_36px_rgba(251,191,36,0.35)] transition-all active:scale-[0.99] disabled:opacity-60">Создать игру</button>
                <button type="button" onClick={() => setRightTab('games')} className="min-w-[220px] px-8 py-5 rounded-2xl border border-amber-400/20 bg-black/30 hover:bg-black/40 text-amber-50 font-black text-lg uppercase tracking-[0.18em]">Открытые лобби</button>
              </div>
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 justify-center">
                <SmallStat label="Онлайн" value={onlineCount} />
                <SmallStat label="Лобби" value={activeGameCount} />
                <SmallStat label="Турниры" value={(tournaments || []).length || 0} />
                <SmallStat label="Версия" value="0.8b" />
              </div>
            </div>

            <div className="hidden xl:block h-8" />
          </div>

          <div className="order-3 space-y-5">
            <SectionCard title="Лобби и подключение" eyebrow="Список игр" right={<div className="text-[11px] font-mono text-amber-100/55">{activeGameCount} открыто</div>}>
              <div className="mb-4 flex gap-2">
                {['games','top10','tournaments'].map((tab) => (
                  <button key={tab} type="button" onClick={() => setRightTab(tab)} className={'flex-1 py-3 rounded-xl border text-[10px] font-black uppercase tracking-[0.28em] ' + (rightTab === tab ? 'bg-amber-500 text-stone-950 border-amber-300/40' : 'bg-black/30 text-amber-200/75 border-amber-500/12 hover:bg-black/40')}>
                    {tab === 'games' ? 'Лобби' : tab === 'top10' ? 'ТОП-10' : 'Турниры'}
                  </button>
                ))}
              </div>

              {rightTab === 'top10' && (
                <div className="space-y-3">
                  {(top10 && top10.length > 0) ? top10.map((r, i) => (
                    <div key={i} className="rounded-[20px] border border-amber-500/10 bg-black/28 p-4 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[11px] font-mono text-amber-100/45">#{i + 1}</div>
                        <button type="button" className="mt-1 text-left text-lg font-serif font-bold text-amber-50 truncate hover:opacity-90" onClick={() => { const pid = String(r?.playerId || r?.player_id || '').trim(); if (pid) openProfileById(pid); }} disabled={!String(r?.playerId || r?.player_id || '').trim()}>{r.name}</button>
                      </div>
                      <div className="text-right font-mono text-sm text-amber-100/78">
                        <div>G: {Number(r.games ?? 0) || 0}</div>
                        <div>W: {Number(r.wins ?? 0) || 0}</div>
                        <div className="font-black text-amber-50">R: {Number(r.rating ?? 0) || 0}</div>
                      </div>
                    </div>
                  )) : <div className="text-[12px] font-mono text-amber-100/40">{top10Err ? `Top10 unavailable: ${top10Err}` : 'Пока пусто.'}</div>}
                </div>
              )}

              {rightTab === 'tournaments' && (
                <div className="space-y-3">
                  {tournamentsErr && <div className="text-[12px] font-mono text-amber-100/40">{tournamentsErr}</div>}
                  {(tournaments || []).slice(0, 10).map((t) => (
                    <button key={t.id} type="button" onClick={() => { window.location.hash = `#/tournament/${t.id}`; }} className="w-full text-left rounded-[20px] border border-amber-500/10 bg-black/28 px-4 py-4 hover:bg-black/38">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="font-serif font-bold text-amber-50 text-lg truncate">{t.name || t.id}</div>
                        <div className="text-[10px] uppercase tracking-[0.2em] font-black text-amber-200/60">{t.status}</div>
                      </div>
                      <div className="mt-2 text-xs font-mono text-amber-100/55">{t.type} · стол {t.tableSize} · игроков {t.playersCount}{(t.config?.maxPlayers ? `/${t.config.maxPlayers}` : '')}</div>
                    </button>
                  ))}
                  {(!(tournaments || []).length && !tournamentsErr) && <div className="text-[12px] font-mono text-amber-100/40">Нет открытых турниров.</div>}
                </div>
              )}

              {rightTab === 'games' && (
                <>
                  <div className="rounded-[22px] border border-amber-500/10 bg-black/22 px-4 py-4 text-sm text-amber-100/82 font-serif">Название игры будет запрошено после нажатия на кнопку <span className="font-black uppercase tracking-[0.18em] text-amber-50">Создать игру</span>.</div>
                  <div className="mt-4 space-y-3 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                    {publicMatches.map((match) => {
                      const title = String(match?.setupData?.lobbyTitle || '').trim();
                      const host = match.setupData?.hostName || 'Лобби';
                      const displayName = title || host;
                      const seats = Array.isArray(match.players) ? match.players : Object.values(match.players || {});
                      const activeSeats = seats.filter((p) => p?.name || p?.isBot || p?.isConnected).length;
                      const maxSeats = seats.length || 5;
                      const isPrivate = !!match?.isPrivate;
                      const tone = match?.status === 'in_progress' ? 'live' : isPrivate ? 'private' : 'open';
                      return (
                        <LobbyRow
                          key={match.matchID}
                          title={displayName}
                          subtitle={`ID ${String(match.matchID || '').slice(0, 8)} · host ${host}`}
                          status={match?.status === 'in_progress' ? 'идёт' : isPrivate ? 'приватная' : 'открыта'}
                          statusTone={tone}
                          players={`${activeSeats}/${maxSeats}`}
                          onClick={() => joinMatch(match.matchID)}
                        />
                      );
                    })}
                    {(!publicMatches || publicMatches.length === 0) && <div className="text-center py-8 text-amber-100/40 italic text-base font-serif">Сейчас нет открытых лобби — создай своё первым.</div>}
                  </div>

                  {!!authToken && (
                    <div className="mt-5 space-y-3 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                      <div className="text-[10px] uppercase tracking-[0.32em] text-amber-200/45 font-black">Мои лобби</div>
                      {(myMatches || []).map((match) => {
                        const title = String(match?.setupData?.lobbyTitle || '').trim();
                        const host = match?.setupData?.hostName || 'Лобби';
                        const displayName = title || host;
                        return (
                          <div key={match.matchID} className="rounded-[22px] border border-amber-500/10 bg-black/24 px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-serif text-amber-50 text-lg font-bold truncate">{displayName}</div>
                                <div className="mt-1 text-[11px] font-mono text-amber-100/45">{String(match?.status || '').replace('_', ' ')} · {String(match?.matchID || '').slice(0, 8)}</div>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <button type="button" onClick={() => renameOwnedMatch(match)} className="px-3 py-2 rounded-lg bg-stone-900/85 hover:bg-black text-amber-100 text-[10px] font-black uppercase tracking-[0.22em]">Переименовать</button>
                                <button type="button" onClick={() => deleteOwnedMatch(match)} className="px-3 py-2 rounded-lg bg-red-900/70 hover:bg-red-800 text-red-100 text-[10px] font-black uppercase tracking-[0.22em]">Удалить</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {(!(myMatches || []).length) && <div className="text-[12px] font-mono text-amber-100/40">У тебя пока нет созданных лобби.</div>}
                    </div>
                  )}
                </>
              )}
            </SectionCard>
          </div>
        </main>

        <footer className="relative z-10 mx-auto max-w-[1520px] mt-6 rounded-[24px] border border-amber-500/10 bg-black/25 backdrop-blur-md px-5 py-3 flex flex-wrap items-center justify-center gap-4 text-sm font-mono text-amber-100/70">
          <span>{onlineCount} в сети</span>
          <span>•</span>
          <span>{activeGameCount} активных игр</span>
          <span>•</span>
          <span>версия 0.8b</span>
        </footer>
      </div>
    </div>
  );
}
