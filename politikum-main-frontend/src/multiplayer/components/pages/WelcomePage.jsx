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

function OrnatePanel({ title, right = null, className = '', bodyClassName = '', children }) {
  return (
    <div
      className={[
        'relative overflow-hidden rounded-[24px] border border-[#d9a84b]/40',
        'bg-[linear-gradient(180deg,rgba(18,15,22,0.80),rgba(11,8,14,0.84))]',
        'shadow-[0_30px_70px_rgba(0,0,0,0.35),inset_0_0_0_1px_rgba(255,227,159,0.06)]',
        'backdrop-blur-[5px]',
        className,
      ].join(' ')}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(244,186,77,0.12),transparent_35%)]" />
      <div className="relative border-b border-[#d9a84b]/18 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[17px] md:text-[18px] font-black uppercase tracking-[0.08em] text-[#f7cf74]">
            {title}
          </div>
          {right}
        </div>
      </div>
      <div className={[ 'relative', bodyClassName ].join(' ')}>{children}</div>
    </div>
  );
}

function LobbyCard({ match, onJoin }) {
  const title = String(match?.setupData?.lobbyTitle || '').trim();
  const host = match?.setupData?.hostName || 'Лобби';
  const displayName = title || host;
  const seats = Array.isArray(match.players) ? match.players : Object.values(match.players || {});
  const activeSeats = seats.filter((p) => p?.name || p?.isBot || p?.isConnected).length;
  const maxSeats = seats.length || 5;
  const mode = match?.status === 'in_progress' ? 'Идёт игра' : 'Открытое лобби';

  return (
    <div className="rounded-[16px] border border-[#d9a84b]/16 bg-black/20 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-center gap-3">
        <div className="h-[52px] w-[52px] shrink-0 rounded-[10px] border border-[#d9a84b]/28 bg-[linear-gradient(180deg,rgba(255,213,119,0.14),rgba(255,213,119,0.03))]" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold text-[#fff2ca]">{displayName}</div>
          <div className="mt-1 text-[12px] text-white/60">{activeSeats}/{maxSeats} · {mode}</div>
          <div className="mt-0.5 truncate text-[11px] text-white/38">host {host} · ID {String(match.matchID || '').slice(0, 8)}</div>
        </div>
        <button
          type="button"
          onClick={onJoin}
          className="shrink-0 rounded-[10px] border border-[#f5d88e]/45 bg-[linear-gradient(180deg,#e9c764,#bf8e2c)] px-3 py-2 text-[12px] font-black uppercase tracking-[0.02em] text-[#231809] shadow-[inset_0_1px_0_rgba(255,244,195,0.45)] hover:brightness-105"
        >
          Войти
        </button>
      </div>
    </div>
  );
}

function BottomIconButton({ children }) {
  return (
    <button
      type="button"
      className="flex h-[48px] w-[48px] items-center justify-center rounded-[14px] border border-[#d9a84b]/35 bg-[linear-gradient(180deg,rgba(23,20,28,0.92),rgba(11,8,14,0.96))] text-[#f2c867] shadow-[0_10px_24px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-black/70"
    >
      {children}
    </button>
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
  const [ratingsMap, setRatingsMap] = useState(() => ({}));
  const [lobbyTitle, setLobbyTitle] = useState('');
  const [showRules, setShowRules] = useState(false);
  const [showWhereAmI, setShowWhereAmI] = useState(false);

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
        backgroundColor: '#0a0e16',
      }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,7,13,0.22),rgba(8,7,13,0.36))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_68%,rgba(255,214,113,0.28),transparent_25%),radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.04),transparent_26%)]" />
      <div className="absolute inset-x-0 top-0 h-[110px] bg-[linear-gradient(180deg,rgba(6,10,20,0.55),transparent)]" />
      <div className="absolute inset-x-0 bottom-0 h-[180px] bg-[linear-gradient(180deg,transparent,rgba(8,7,13,0.34))]" />

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
        <header className="px-4 pt-4 md:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1440px] items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setShowWhereAmI(true)} className="rounded-[12px] border border-[#d9a84b]/28 bg-black/18 px-3 py-2 text-[12px] font-bold text-[#f4d485] backdrop-blur-sm hover:bg-black/26">Помощь</button>
              <button type="button" onClick={() => setShowRules(true)} className="rounded-[12px] border border-[#d9a84b]/28 bg-black/18 px-3 py-2 text-[12px] font-bold text-[#f4d485] backdrop-blur-sm hover:bg-black/26">Правила</button>
              {String(playerName || '').trim().toLowerCase() === 'konsta' && (
                <a href="#/admin" target="_blank" rel="noreferrer" className="rounded-[12px] border border-[#d9a84b]/28 bg-black/18 px-3 py-2 text-[12px] font-bold text-[#f4d485] backdrop-blur-sm hover:bg-black/26">Admin</a>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {authToken ? (
                <>
                  <div className="rounded-[14px] border border-[#d9a84b]/28 bg-black/18 px-3 py-2 text-right backdrop-blur-sm">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/42">Игрок</div>
                    <div className="text-[15px] font-bold text-[#fff1ca]">{String(playerName || 'User').trim() || 'User'}</div>
                  </div>
                  {(authRating != null && !Number.isNaN(Number(authRating))) && (
                    <button
                      type="button"
                      className="rounded-[14px] border border-[#d9a84b]/28 bg-black/18 px-4 py-2 font-black text-[#f7cf74] backdrop-blur-sm"
                      title="Открыть профиль"
                      onClick={() => {
                        const pid = String(window.localStorage.getItem('politikum.sessionPlayerId') || '').trim();
                        openProfileById(pid);
                      }}
                    >
                      {Math.round(Number(authRating))}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      try { window.localStorage.removeItem('politikum.authToken'); } catch {}
                      try { window.localStorage.removeItem('politikum.sessionPlayerId'); } catch {}
                      setAuthToken('');
                      setAuthRating(null);
                    }}
                    className="rounded-[14px] border border-[#d9a84b]/28 bg-black/18 px-4 py-2 text-[12px] font-bold text-[#f4d485] backdrop-blur-sm hover:bg-black/26"
                  >
                    Выйти
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-[170px] rounded-[14px] border border-[#d9a84b]/26 bg-[rgba(255,248,230,0.94)] px-3 py-2 text-[14px] text-slate-900 outline-none"
                    placeholder="Твой ник"
                  />
                  <input
                    value={betaPassword}
                    onChange={(e) => setBetaPassword(e.target.value)}
                    type="password"
                    placeholder="token"
                    className="w-[150px] rounded-[14px] border border-[#d9a84b]/26 bg-[rgba(255,248,230,0.94)] px-3 py-2 text-[14px] text-slate-900 outline-none"
                  />
                  <button type="button" onClick={doBetaLogin} disabled={betaLoading || !String(betaPassword || '').trim()} className="rounded-[14px] border border-[#f5d88e]/45 bg-[linear-gradient(180deg,#e9c764,#bf8e2c)] px-4 py-2 text-[13px] font-black text-[#231809] disabled:opacity-60">
                    {betaLoading ? '...' : 'Войти'}
                  </button>
                  <div className="text-[12px] text-white/70">{betaErr ? betaErr : 'Гостевой режим'}</div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 pb-5 pt-5 md:px-6 lg:px-8">
          <div className="grid flex-1 grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)_420px] xl:gap-7">
            <div className="order-2 flex min-h-0 flex-col gap-4 xl:order-1 xl:pt-[340px]">
              <OrnatePanel title="Новости" className="min-h-[226px]" bodyClassName="p-4">
                <div className="h-[188px] overflow-hidden rounded-[16px] bg-black/10">
                  <NewsPanel />
                </div>
              </OrnatePanel>

              <OrnatePanel title="Чат лобби" className="flex min-h-[280px] flex-col" bodyClassName="flex min-h-0 flex-1 flex-col p-4">
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

                  {(lobbyChat || []).slice(-6).map((m, idx) => {
                    const isMe = String(m?.name || '') === String(playerName || '');
                    return (
                      <div key={m.id ?? idx} className={isMe ? 'rounded-[14px] border border-[#d9a84b]/22 bg-[#d9a84b]/10 px-4 py-3' : 'rounded-[14px] border border-white/8 bg-white/[0.04] px-4 py-3'}>
                        <div className="flex items-center gap-2 text-[12px] text-white/56">
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

                <div className="mt-3 flex gap-2">
                  <input
                    value={lobbyChatInput}
                    onChange={(e) => setLobbyChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        sendLobbyChat();
                      }
                    }}
                    placeholder={authToken ? (lobbyChatEnabled ? 'Напиши сообщение…' : 'Чат выключен') : 'Войди, чтобы писать…'}
                    disabled={!authToken || !lobbyChatEnabled}
                    className="flex-1 rounded-[12px] border border-[#d9a84b]/18 bg-black/18 px-4 py-3 text-[14px] text-white outline-none placeholder:text-white/32 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={sendLobbyChat}
                    disabled={!authToken || !lobbyChatEnabled || !String(lobbyChatInput || '').trim()}
                    className="rounded-[12px] border border-[#f5d88e]/45 bg-[linear-gradient(180deg,#e9c764,#bf8e2c)] px-4 py-3 text-[12px] font-black uppercase tracking-[0.03em] text-[#231809] disabled:opacity-60"
                  >
                    Отпр.
                  </button>
                </div>
              </OrnatePanel>
            </div>

            <div className="order-1 flex min-h-[640px] flex-col items-center xl:order-2">
              <div className="pt-[94px] text-center">
                <div className="mx-auto max-w-[540px] text-[28px] font-bold leading-[1.14] text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.4)] md:text-[34px]">
                  Собери оппозиционеров
                  <br />
                  за одним столом!
                </div>
              </div>

              <div className="flex-1" />

              <div className="pb-[96px] md:pb-[114px] xl:pb-[122px]">
                <button
                  onClick={createMatch}
                  disabled={loading}
                  className="min-w-[320px] md:min-w-[360px] rounded-[18px] border border-[#ffe4a4]/45 bg-[linear-gradient(180deg,#f5d86d,#d39a29)] px-10 py-5 text-[22px] font-black uppercase tracking-[0.04em] text-[#291d08] shadow-[0_18px_44px_rgba(255,187,50,0.24),inset_0_1px_0_rgba(255,248,214,0.55)] transition-all hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
                >
                  {loading ? 'Загрузка…' : 'Начать игру'}
                </button>
              </div>
            </div>

            <div className="order-3 flex min-h-0 flex-col xl:pt-[340px]">
              <OrnatePanel
                title="Лобби игроков"
                right={<div className="text-[12px] font-semibold text-white/50">{activeGameCount} открыто</div>}
                className="flex min-h-[620px] flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col p-4"
              >
                <div className="mb-4 flex gap-2">
                  {['games', 'top10', 'tournaments'].map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setRightTab(tab)}
                      className={[
                        'flex-1 rounded-[12px] border px-3 py-2.5 text-[13px] font-black uppercase tracking-[0.02em]',
                        rightTab === tab
                          ? 'border-[#f5d88e]/45 bg-[linear-gradient(180deg,#e9c764,#bf8e2c)] text-[#231809]'
                          : 'border-[#d9a84b]/18 bg-black/16 text-[#f7cf74] hover:bg-black/24',
                      ].join(' ')}
                    >
                      {tab === 'games' ? 'Лобби' : tab === 'top10' ? 'Топ-10' : 'Турниры'}
                    </button>
                  ))}
                </div>

                {rightTab === 'top10' && (
                  <div className="custom-scrollbar space-y-3 overflow-y-auto pr-1">
                    {top10 && top10.length > 0 ? (
                      top10.map((r, i) => (
                        <div key={i} className="rounded-[16px] border border-[#d9a84b]/16 bg-black/16 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[11px] text-white/42">#{i + 1}</div>
                              <button
                                type="button"
                                className="mt-0.5 truncate text-left text-[17px] font-bold text-[#fff2ca] hover:opacity-90"
                                onClick={() => {
                                  const pid = String(r?.playerId || r?.player_id || '').trim();
                                  if (pid) openProfileById(pid);
                                }}
                                disabled={!String(r?.playerId || r?.player_id || '').trim()}
                              >
                                {r.name}
                              </button>
                            </div>
                            <div className="text-right text-[13px] text-white/70">
                              <div>W {Number(r.wins ?? 0) || 0}</div>
                              <div className="font-black text-[#f7cf74]">R {Number(r.rating ?? 0) || 0}</div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-[13px] text-white/50">{top10Err ? `Top10 unavailable: ${top10Err}` : 'Пока пусто.'}</div>
                    )}
                  </div>
                )}

                {rightTab === 'tournaments' && (
                  <div className="custom-scrollbar space-y-3 overflow-y-auto pr-1">
                    {tournamentsErr && <div className="text-[13px] text-white/50">{tournamentsErr}</div>}
                    {(tournaments || []).slice(0, 10).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          window.location.hash = `#/tournament/${t.id}`;
                        }}
                        className="w-full rounded-[16px] border border-[#d9a84b]/16 bg-black/16 px-4 py-4 text-left hover:bg-black/24"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="truncate text-[17px] font-bold text-[#fff2ca]">{t.name || t.id}</div>
                          <div className="text-[11px] uppercase tracking-[0.12em] text-[#f7cf74]">{t.status}</div>
                        </div>
                        <div className="mt-2 text-[12px] text-white/58">
                          {t.type} · стол {t.tableSize} · игроков {t.playersCount}
                          {t.config?.maxPlayers ? `/${t.config.maxPlayers}` : ''}
                        </div>
                      </button>
                    ))}
                    {!(tournaments || []).length && !tournamentsErr && (
                      <div className="py-8 text-center text-[13px] text-white/50">Нет открытых турниров.</div>
                    )}
                  </div>
                )}

                {rightTab === 'games' && (
                  <>
                    <div className="mb-4 rounded-[16px] border border-[#d9a84b]/14 bg-black/14 px-4 py-3 text-[13px] text-white/70">
                      Название игры будет запрошено после нажатия на кнопку <span className="font-black text-[#f7cf74]">«Начать игру»</span>.
                    </div>

                    <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                      {publicMatches.map((match) => (
                        <LobbyCard key={match.matchID} match={match} onJoin={() => joinMatch(match.matchID)} />
                      ))}

                      {(!publicMatches || publicMatches.length === 0) && (
                        <div className="py-8 text-center text-[14px] text-white/50">Сейчас нет открытых лобби — создай своё первым.</div>
                      )}
                    </div>

                    {!!authToken && (
                      <div className="mt-5 space-y-3 border-t border-[#d9a84b]/14 pt-4">
                        <div className="text-[10px] uppercase tracking-[0.28em] text-white/34">Мои лобби</div>
                        <div className="custom-scrollbar max-h-[188px] space-y-3 overflow-y-auto pr-1">
                          {(myMatches || []).map((match) => {
                            const title = String(match?.setupData?.lobbyTitle || '').trim();
                            const host = match?.setupData?.hostName || 'Лобби';
                            const displayName = title || host;

                            return (
                              <div key={match.matchID} className="rounded-[16px] border border-[#d9a84b]/14 bg-black/16 px-4 py-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-[16px] font-bold text-[#fff2ca]">{displayName}</div>
                                    <div className="mt-1 text-[11px] text-white/42">
                                      {String(match?.status || '').replace('_', ' ')} · {String(match?.matchID || '').slice(0, 8)}
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => renameOwnedMatch(match)}
                                      className="rounded-[10px] border border-[#d9a84b]/20 bg-black/24 px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#f7cf74]"
                                    >
                                      Имя
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteOwnedMatch(match)}
                                      className="rounded-[10px] border border-red-400/18 bg-red-950/35 px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-red-200"
                                    >
                                      Удалить
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {!(myMatches || []).length && (
                            <div className="text-[12px] text-white/42">У тебя пока нет созданных лобби.</div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </OrnatePanel>
            </div>
          </div>
        </main>

        <footer className="px-4 pb-4 md:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1440px] items-end justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-[14px] border border-[#d9a84b]/35 bg-[linear-gradient(180deg,rgba(23,20,28,0.92),rgba(11,8,14,0.96))] px-6 py-3 text-[20px] font-black text-[#fff2ca] shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
                500
              </div>
              <div className="rounded-[14px] border border-[#d9a84b]/35 bg-[linear-gradient(180deg,rgba(23,20,28,0.92),rgba(11,8,14,0.96))] px-6 py-3 text-[20px] font-black text-[#fff2ca] shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
                25
              </div>
            </div>

            <div className="flex items-center gap-6 text-[16px] text-[#fff1ca] drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
              <span>Онлайн <span className="font-black text-[#f6cf74]">{onlineCount}</span></span>
              <span>Лобби <span className="font-black text-[#f6cf74]">{activeGameCount}</span></span>
              <span>Турниры <span className="font-black text-[#f6cf74]">{(tournaments || []).length}</span></span>
            </div>

            <div className="flex items-center gap-3">
              <BottomIconButton>
                <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current"><path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4.5 3.3A.8.8 0 0 1 3 18.6V6a1 1 0 0 1 1-1Zm2 4v2h12V9H6Zm0 4v1h8v-1H6Z" /></svg>
              </BottomIconButton>
              <BottomIconButton>
                <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current"><path d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 1a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm8 1c-2.67 0-8 1.34-8 4v2h14v-2c0-2.66-5.33-4-8-4ZM8 14c-.29 0-.62.02-.97.05A4.5 4.5 0 0 1 10 17v2H2v-2c0-1.94 3.11-3 6-3Z" /></svg>
              </BottomIconButton>
              <BottomIconButton>
                <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current"><path d="M19.14 12.94a7.48 7.48 0 0 0 .05-.94 7.48 7.48 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.28 7.28 0 0 0-1.63-.94L14.5 2.5a.5.5 0 0 0-.49-.5h-4a.5.5 0 0 0-.49.5l-.36 2.56c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.62 8.58a.5.5 0 0 0 .12.64l2.03 1.58a7.48 7.48 0 0 0-.05.94c0 .32.02.63.05.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.56a.5.5 0 0 0 .49.5h4a.5.5 0 0 0 .49-.5l.36-2.56c.58-.23 1.13-.54 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64ZM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5Z" /></svg>
              </BottomIconButton>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
