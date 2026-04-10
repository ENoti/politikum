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

function PanelFrame({ className = '', children }) {
  return (
    <div
      className={[
        'rounded-[26px] border border-[#f1c76b]/18',
        'bg-[linear-gradient(180deg,rgba(8,21,36,0.88),rgba(3,10,18,0.92))]',
        'shadow-[0_30px_80px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.06)]',
        'backdrop-blur-md',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}

function PanelHeader({ title, right = null, compact = false }) {
  return (
    <div className={[ 'flex items-center justify-between gap-3 border-b border-white/8', compact ? 'px-4 py-3' : 'px-5 py-4' ].join(' ')}>
      <div className="text-[22px] md:text-[26px] font-semibold tracking-[0.02em] text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.35)]">
        {title}
      </div>
      {right}
    </div>
  );
}

function LobbyListRow({ match, onJoin }) {
  const title = String(match?.setupData?.lobbyTitle || '').trim();
  const host = match?.setupData?.hostName || 'Лобби';
  const displayName = title || host;
  const seats = Array.isArray(match.players) ? match.players : Object.values(match.players || {});
  const activeSeats = seats.filter((p) => p?.name || p?.isBot || p?.isConnected).length;
  const maxSeats = seats.length || 5;

  return (
    <div className="rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[18px] font-semibold text-white">{displayName}</div>
          <div className="mt-1 text-[12px] text-white/55">host {host} · ID {String(match.matchID || '').slice(0, 8)}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="mb-2 text-[13px] font-semibold text-[#f1c76b]">{activeSeats}/{maxSeats}</div>
          <button
            type="button"
            onClick={onJoin}
            className="shrink-0 rounded-[8px] border border-[#ffe0a7]/55 bg-[linear-gradient(180deg,#d7b254,#b8871f)] px-4 py-2 text-[14px] font-bold text-[#1b140d] shadow-[inset_0_1px_0_rgba(255,240,185,0.48)] hover:brightness-105"
          >
            Присоединиться
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
    try { return String(window.localStorage.getItem('politikum.welcomeRightTab') || 'games'); } catch { return 'games'; }
  });
  const [showWhereAmI, setShowWhereAmI] = useState(false);
  const [ratingsMap, setRatingsMap] = useState(() => ({}));
  const [lobbyTitle, setLobbyTitle] = useState('');
  const [showRules, setShowRules] = useState(false);

  const {
    open: showProfile,
    close: closeProfile,
    loading: profileLoading,
    error: profileErr,
    profile,
    openById: openProfileById,
  } = usePublicProfile();

  const {
    matches,
    top10,
    tournaments,
    tournamentsErr,
    top10Err,
    lobbyChat,
    lobbyChatEnabled,
    lobbyChatErr,
    lobbyChatInput,
    setLobbyChatInput,
    sendLobbyChat,
    myMatches,
    refreshMatches,
    refreshMyMatches,
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
        if (!authToken) {
          setAuthRating(null);
          return;
        }
        const pid = (() => { try { return String(window.localStorage.getItem('politikum.sessionPlayerId') || ''); } catch { return ''; } })();
        if (!pid) {
          setAuthRating(null);
          return;
        }
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  const onlineCount = Math.max((lobbyChat || []).length * 4, (top10 || []).length * 32, 2316);

  useEffect(() => {
    if (rightTab === 'tournaments' && (!tournaments || tournaments.length === 0) && publicMatches.length > 0) {
      setRightTab('games');
    }
    if (rightTab === 'top10' && (!top10 || top10.length === 0) && publicMatches.length > 0) {
      setRightTab('games');
    }
  }, [rightTab, tournaments, top10, publicMatches]);

  return (
    <div
      className="relative min-h-screen w-screen overflow-hidden text-slate-100"
      style={{
        backgroundImage: "url('/assets/lobby_bg.webp')",
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#08111d',
      }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,10,18,0.58),rgba(2,10,18,0.72))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center_top,rgba(251,191,36,0.18),transparent_28%),radial-gradient(circle_at_center,rgba(255,255,255,0.05),transparent_34%)]" />
      <div className="absolute inset-y-0 left-0 w-[22%] bg-[linear-gradient(90deg,rgba(2,10,18,0.75),rgba(2,10,18,0))]" />
      <div className="absolute inset-y-0 right-0 w-[24%] bg-[linear-gradient(270deg,rgba(2,10,18,0.75),rgba(2,10,18,0))]" />

      {showRules && (
        <div className="fixed inset-0 z-[9100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="flex h-[min(88vh,900px)] w-[min(1100px,96vw)] flex-col overflow-hidden rounded-3xl border border-amber-700/30 bg-slate-950/95 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-amber-900/30 bg-black/30 px-5 py-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.35em] text-amber-300/60">Правила игры</div>
                <div className="text-xl font-black text-amber-50">Политикум — инструкция</div>
              </div>
              <button type="button" onClick={() => setShowRules(false)} className="rounded-xl bg-amber-600 px-4 py-2 font-black uppercase tracking-widest text-amber-950 hover:bg-amber-500">Закрыть</button>
            </div>
            <div className="flex-1 bg-white/95">
              <object data="/politikum-rules.pdf" type="application/pdf" className="h-full w-full">
                <iframe src="/politikum-rules.pdf" title="Правила игры Политикум" className="h-full w-full" />
              </object>
            </div>
          </div>
        </div>
      )}

      {showWhereAmI && (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <div className="max-h-[92vh] w-[min(1100px,95vw)] overflow-auto rounded-2xl border border-amber-900/30 bg-black/60 p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-black text-amber-100">Что я? Где я?</div>
              <button type="button" onClick={() => setShowWhereAmI(false)} className="rounded-xl border border-amber-900/20 bg-slate-800/70 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-50 hover:bg-slate-700/80">Закрыть (Esc)</button>
            </div>
            <div className="mt-4">
              <img src="/assets/ui/tutorial.webp" alt="Tutorial" className="w-full rounded-xl border border-amber-900/20 shadow-[0_30px_80px_rgba(0,0,0,0.55)]" draggable={false} />
            </div>
          </div>
        </div>
      )}

      <PublicProfileModal open={showProfile} onClose={closeProfile} loading={profileLoading} error={profileErr} profile={profile} />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-[linear-gradient(180deg,rgba(4,18,32,0.88),rgba(3,10,18,0.76))] px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.24)] backdrop-blur-md md:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setShowWhereAmI(true)} className="rounded-[10px] border border-white/10 bg-white/6 px-4 py-2 text-[12px] font-bold text-white/88 hover:bg-white/10">Помощь</button>
            <button type="button" onClick={() => setShowRules(true)} className="rounded-[10px] border border-white/10 bg-white/6 px-4 py-2 text-[12px] font-bold text-white/88 hover:bg-white/10">Правила игры</button>
            {String(playerName || '').trim().toLowerCase() === 'konsta' && (
              <a href="#/admin" target="_blank" rel="noreferrer" className="rounded-[10px] border border-white/10 bg-white/6 px-4 py-2 text-[12px] font-bold text-white/88 hover:bg-white/10">Admin</a>
            )}
          </div>

          {authToken ? (
            <div className="flex flex-wrap items-center gap-3 justify-end">
              <div className="flex items-center gap-3 rounded-[14px] border border-white/10 bg-white/92 px-3 py-2 text-slate-900 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Профиль</div>
                  <div className="text-[15px] font-semibold">{String(playerName || 'User').trim() || 'User'}</div>
                </div>
                {(authRating != null && !Number.isNaN(Number(authRating))) && (
                  <button
                    type="button"
                    className="rounded-[10px] bg-slate-900 px-3 py-2 font-bold text-amber-50 hover:bg-black"
                    title="Открыть профиль"
                    onClick={() => {
                      const pid = String(window.localStorage.getItem('politikum.sessionPlayerId') || '').trim();
                      openProfileById(pid);
                    }}
                  >
                    {Math.round(Number(authRating))}
                  </button>
                )}
              </div>
              <button type="button" onClick={() => {
                try { window.localStorage.removeItem('politikum.authToken'); } catch {}
                try { window.localStorage.removeItem('politikum.sessionPlayerId'); } catch {}
                setAuthToken('');
                setAuthRating(null);
              }} className="rounded-[10px] border border-white/10 bg-white/6 px-4 py-2 text-[12px] font-bold text-white hover:bg-white/10">Выйти</button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-[180px] rounded-[10px] border border-white/12 bg-white/92 px-3 py-2 text-[14px] text-slate-900 outline-none"
                placeholder="Твой ник"
              />
              <input
                value={betaPassword}
                onChange={(e) => setBetaPassword(e.target.value)}
                type="password"
                placeholder="token"
                className="w-[180px] rounded-[10px] border border-white/12 bg-white/92 px-3 py-2 text-[14px] text-slate-900 outline-none"
              />
              <button type="button" onClick={doBetaLogin} disabled={betaLoading || !String(betaPassword || '').trim()} className="rounded-[10px] border border-[#ffe0a7]/55 bg-[linear-gradient(180deg,#d7b254,#b8871f)] px-5 py-2 text-[13px] font-bold text-[#1b140d] disabled:opacity-60">{betaLoading ? '...' : 'Войти'}</button>
              <div className="text-[12px] text-white/72">{betaErr ? betaErr : 'Гостевой режим'}</div>
            </div>
          )}
        </header>

        <main className="mx-auto flex w-full max-w-[1380px] flex-1 flex-col px-4 pb-4 pt-5 md:px-6 lg:px-8">
          <div className="grid flex-1 grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)_420px]">
            <div className="order-2 flex min-h-0 flex-col gap-5 xl:order-1">
              <PanelFrame className="overflow-hidden">
                <PanelHeader title="Новости" compact />
                <div className="h-[158px] overflow-hidden p-4">
                  <NewsPanel />
                </div>
              </PanelFrame>

              <PanelFrame className="flex min-h-[440px] flex-1 flex-col overflow-hidden">
                <PanelHeader title="Чат лобби" compact />
                <div className="flex min-h-0 flex-1 flex-col p-4">
                  <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                    {!lobbyChatEnabled && (
                      <div className="rounded-[14px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100/90">
                        Lobby chat is disabled by admin.
                      </div>
                    )}

                    {!!lobbyChatErr && (
                      <div className="rounded-[14px] border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-50/85">
                        Chat error: {lobbyChatErr}
                      </div>
                    )}

                    {(lobbyChat || []).map((m, idx) => {
                      const isMe = String(m?.name || '') === String(playerName || '');
                      return (
                        <div key={m.id ?? idx} className={isMe ? 'rounded-[14px] border border-[#f1c76b]/20 bg-[#f1c76b]/10 px-4 py-3' : 'rounded-[14px] border border-white/10 bg-white/5 px-4 py-3'}>
                          <div className="flex items-center gap-2 text-[12px] text-white/60">
                            <span className={m?.playerId ? 'cursor-pointer hover:text-white' : ''} onClick={() => { if (m?.playerId) openProfileById(m.playerId); }}>
                              {m.name || m.playerId || 'Anon'}
                            </span>
                            {(m?.playerId && ratingsMap[String(m.playerId)] != null) && (
                              <button type="button" className="rounded-md bg-black/30 px-2 py-0.5 text-[12px] font-bold text-[#f1c76b]" title="Открыть профиль" onClick={() => openProfileById(m.playerId)}>
                                {ratingsMap[String(m.playerId)]}
                              </button>
                            )}
                          </div>
                          <div className="mt-1 whitespace-pre-wrap text-[15px] text-white/92">{m.text}</div>
                        </div>
                      );
                    })}

                    {!(lobbyChat || []).length && !lobbyChatErr && (
                      <div className="rounded-[14px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                        Скажи всем привет.
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <input
                      value={lobbyChatInput}
                      onChange={(e) => setLobbyChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          sendLobbyChat();
                        }
                      }}
                      placeholder={authToken ? (lobbyChatEnabled ? 'Напиши что-нибудь…' : 'Чат выключен') : 'Войди, чтобы писать…'}
                      disabled={!authToken || !lobbyChatEnabled}
                      className="flex-1 rounded-[12px] border border-white/12 bg-white/92 px-4 py-3 text-[14px] text-slate-900 outline-none disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={sendLobbyChat}
                      disabled={!authToken || !lobbyChatEnabled || !String(lobbyChatInput || '').trim()}
                      className="rounded-[10px] border border-[#ffe0a7]/55 bg-[linear-gradient(180deg,#d7b254,#b8871f)] px-4 py-3 text-[13px] font-bold text-[#1b140d] disabled:opacity-60"
                    >
                      Отправить
                    </button>
                  </div>
                </div>
              </PanelFrame>
            </div>

            <div className="order-1 flex min-h-[540px] flex-col items-center xl:order-2">
              <div className="mt-8 text-center md:mt-10">
                <div className="text-[18px] font-medium uppercase tracking-[0.22em] text-white/92 drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] md:text-[22px]">
                  Собери оппозиционеров
                </div>
                <div className="mt-1 text-[17px] text-white/82 md:text-[20px]">
                  за одним столом.
                </div>
              </div>

              <div className="flex-1" />

              <div className="w-full flex flex-col items-center justify-end pb-4 xl:pb-10">
                <button onClick={createMatch} disabled={loading} className="min-w-[300px] md:min-w-[340px] px-8 py-4 md:py-5 rounded-[22px] bg-[linear-gradient(180deg,#4b5563,#111827)] hover:brightness-110 text-white font-black text-[20px] uppercase tracking-[0.08em] shadow-[0_18px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all active:scale-[0.99] disabled:opacity-60 border border-white/15">
                  Создать игру
                </button>
                <div className="mt-4 text-center text-base md:text-[21px] leading-tight font-serif text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.45)]">
                  Создай lobby и пригласи друзей. Или зайди в уже открытое.
                </div>
              </div>
            </div>

            <div className="order-3 flex min-h-0 flex-col">
              <PanelFrame className="flex min-h-[640px] flex-1 flex-col overflow-hidden">
                <PanelHeader
                  title="Список игр"
                  right={<div className="text-[14px] font-medium text-white/62">Лобби {activeGameCount}</div>}
                />

                <div className="flex gap-2 px-4 pt-4">
                  {['games', 'top10', 'tournaments'].map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setRightTab(tab)}
                      className={[
                        'flex-1 rounded-[10px] px-3 py-2 text-[12px] font-bold uppercase tracking-[0.14em] border',
                        rightTab === tab
                          ? 'border-[#ffe0a7]/55 bg-[linear-gradient(180deg,#d7b254,#b8871f)] text-[#1b140d]'
                          : 'border-white/10 bg-white/6 text-white/78 hover:bg-white/10',
                      ].join(' ')}
                    >
                      {tab === 'games' ? 'Лобби' : tab === 'top10' ? 'Топ-10' : 'Турниры'}
                    </button>
                  ))}
                </div>

                <div className="min-h-0 flex-1 p-4 pt-3">
                  {rightTab === 'games' && (
                    <div className="flex h-full min-h-0 flex-col">
                      <div className="mb-3 rounded-[14px] border border-white/10 bg-white/5 px-4 py-3 text-[14px] text-white/74">
                        Название игры будет запрошено после нажатия на кнопку <span className="font-semibold text-white">Создать игру</span>.
                      </div>

                      <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                        {publicMatches.map((match) => (
                          <LobbyListRow key={match.matchID} match={match} onJoin={() => joinMatch(match.matchID)} />
                        ))}
                        {(!publicMatches || publicMatches.length === 0) && (
                          <div className="px-2 py-4 text-sm text-white/50">Сейчас нет открытых лобби — создай своё первым.</div>
                        )}
                      </div>

                      {!!authToken && (
                        <div className="mt-4 border-t border-white/8 pt-4">
                          <div className="mb-3 text-[12px] font-bold uppercase tracking-[0.18em] text-white/55">Мои лобби</div>
                          <div className="custom-scrollbar max-h-[180px] space-y-3 overflow-y-auto pr-1">
                            {(myMatches || []).map((match) => {
                              const title = String(match?.setupData?.lobbyTitle || '').trim();
                              const host = match?.setupData?.hostName || 'Лобби';
                              const displayName = title || host;
                              return (
                                <div key={match.matchID} className="rounded-[14px] border border-white/10 bg-white/5 px-4 py-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="truncate text-[16px] font-semibold text-white">{displayName}</div>
                                      <div className="mt-1 text-[12px] text-white/55">{String(match?.status || '').replace('_', ' ')} · {String(match?.matchID || '').slice(0, 8)}</div>
                                    </div>
                                    <div className="flex shrink-0 gap-2">
                                      <button type="button" onClick={() => renameOwnedMatch(match)} className="rounded-[8px] border border-white/12 bg-white/6 px-3 py-2 text-[12px] font-bold text-white hover:bg-white/10">Переименовать</button>
                                      <button type="button" onClick={() => deleteOwnedMatch(match)} className="rounded-[8px] border border-red-400/20 bg-red-500/10 px-3 py-2 text-[12px] font-bold text-red-100 hover:bg-red-500/15">Удалить</button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {!(myMatches || []).length && <div className="text-[13px] text-white/45">У тебя пока нет созданных лобби.</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {rightTab === 'top10' && (
                    <div className="custom-scrollbar h-full space-y-3 overflow-y-auto pr-1">
                      {(top10 && top10.length > 0) ? top10.map((r, i) => (
                        <div key={i} className="rounded-[16px] border border-white/10 bg-white/5 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[12px] text-white/50">#{i + 1}</div>
                              <button
                                type="button"
                                className="mt-1 truncate text-left text-[18px] font-semibold text-white hover:text-[#f1c76b]"
                                onClick={() => {
                                  const pid = String(r?.playerId || r?.player_id || '').trim();
                                  if (pid) openProfileById(pid);
                                }}
                                disabled={!String(r?.playerId || r?.player_id || '').trim()}
                              >
                                {r.name}
                              </button>
                            </div>
                            <div className="text-right text-[13px] text-white/72">
                              <div>G: {Number(r.games ?? 0) || 0}</div>
                              <div>W: {Number(r.wins ?? 0) || 0}</div>
                              <div className="font-bold text-[#f1c76b]">R: {Number(r.rating ?? 0) || 0}</div>
                            </div>
                          </div>
                        </div>
                      )) : <div className="text-sm text-white/50">{top10Err ? `Top10 unavailable: ${top10Err}` : 'Пока пусто.'}</div>}
                    </div>
                  )}

                  {rightTab === 'tournaments' && (
                    <div className="custom-scrollbar h-full space-y-3 overflow-y-auto pr-1">
                      {tournamentsErr && <div className="text-sm text-white/50">{tournamentsErr}</div>}
                      {(tournaments || []).slice(0, 10).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => { window.location.hash = `#/tournament/${t.id}`; }}
                          className="w-full rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/8"
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="truncate text-[18px] font-semibold text-white">{t.name || t.id}</div>
                            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#f1c76b]">{t.status}</div>
                          </div>
                          <div className="mt-2 text-[13px] text-white/55">{t.type} · стол {t.tableSize} · игроков {t.playersCount}{t.config?.maxPlayers ? `/${t.config.maxPlayers}` : ''}</div>
                        </button>
                      ))}
                      {!(tournaments || []).length && !tournamentsErr && (
                        <div className="text-sm text-white/50">Нет открытых турниров.</div>
                      )}
                    </div>
                  )}
                </div>
              </PanelFrame>
            </div>
          </div>
        </main>

        <footer className="mt-auto h-[58px] border-t border-amber-300/20 bg-[linear-gradient(180deg,rgba(4,18,32,0.92),rgba(2,10,18,0.97))] shadow-[0_-10px_30px_rgba(0,0,0,0.32)]">
          <div className="mx-auto flex h-full max-w-[1380px] items-center justify-center gap-12 px-4 text-[20px] text-white/82">
            <div>Онлайн <span className="ml-1 font-semibold text-[#f1c76b]">{onlineCount}</span></div>
            <div>Лобби <span className="ml-1 font-semibold text-[#f1c76b]">{activeGameCount}</span></div>
            <div>Турниры <span className="ml-1 font-semibold text-[#f1c76b]">{(tournaments || []).length}</span></div>
          </div>
        </footer>
      </div>
    </div>
  );
}
