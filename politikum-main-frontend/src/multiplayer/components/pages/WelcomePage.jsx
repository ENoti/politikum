import React, { useEffect, useState } from 'react';
import { SERVER, createMatchApi, getMatchApi, joinMatchApi, renameMatchOwnerApi, deleteMatchOwnerApi } from '../../api.js';
import usePublicLobbyData from '../../hooks/usePublicLobbyData.js';
import usePublicProfile from '../../hooks/usePublicProfile.js';
import NewsPanel from '../content/NewsPanel.jsx';
import PublicProfileModal from '../profile/PublicProfileModal.jsx';

const NAMES = [
  'Hakon', 'Rixa', 'Gisela', 'Dunstan', 'Irmgard', 'Cedric', 'Freya', 'Ulric', 'Yolanda', 'Tristan',
  'Beatrix', 'Lambert', 'Maude', 'Odilia', 'Viggo', 'Sibylla', 'Katarina', 'Norbert', 'Quintus',
];

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

  return (
    <div className="h-screen w-screen text-slate-100 font-sans bg-cover bg-center bg-fixed bg-no-repeat flex flex-row overflow-hidden" style={{ backgroundImage: "url('/assets/lobby_bg.webp')" }}>
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

      <div className="fixed top-3 left-3 z-[2000] select-none flex items-center gap-2 pointer-events-auto">
        <button type="button" onClick={() => setShowWhereAmI(true)} className="px-3 py-2 rounded-xl bg-black/60 hover:bg-black/70 border border-amber-900/30 text-amber-100 font-black text-[10px] uppercase tracking-widest whitespace-nowrap">help with login</button>
        <button type="button" onClick={() => setShowRules(true)} className="px-3 py-2 rounded-xl bg-black/60 hover:bg-black/70 border border-amber-900/30 text-amber-100 font-black text-[10px] uppercase tracking-widest whitespace-nowrap">Правила игры</button>
        {String(playerName || '').trim().toLowerCase() === 'konsta' && (
          <a href="#/admin" target="_blank" rel="noreferrer" className="bg-black/70 border border-amber-900/30 rounded-lg px-2 py-1 text-[11px] font-mono font-black tracking-widest text-amber-200/70 hover:text-amber-50">ADMIN</a>
        )}
      </div>

      <div className="fixed top-3 left-3 right-3 z-[1999] pointer-events-none">
        <div className="pointer-events-auto max-w-3xl mx-auto flex flex-row gap-3 items-center justify-end ml-56 mr-6">
          {authToken ? (
            <>
              <div className="text-xs font-mono text-black/80 whitespace-nowrap flex items-center gap-2">
                <span>{String(playerName || 'User').trim() || 'User'}</span>
                {(authRating != null && !Number.isNaN(Number(authRating))) && (
                  <button type="button" className="px-2 py-1 rounded-lg bg-black/45 hover:bg-black/55 border border-amber-900/20 text-black/80" title="Открыть профиль" onClick={async () => { const pid = String(window.localStorage.getItem('politikum.sessionPlayerId') || '').trim(); openProfileById(pid); }}>{Math.round(Number(authRating))}</button>
                )}
              </div>
              <button type="button" onClick={() => { try { window.localStorage.removeItem('politikum.authToken'); } catch {} try { window.localStorage.removeItem('politikum.sessionPlayerId'); } catch {} setAuthToken(''); setAuthRating(null); }} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-100 font-black text-[10px] uppercase tracking-widest">Logout</button>
            </>
          ) : (
            <>
              <div className="text-[10px] uppercase tracking-widest text-amber-200/60 font-black">Alias</div>
              <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="w-[200px] max-w-[40vw] bg-amber-100/80 border border-amber-900/20 rounded px-3 py-2 text-black font-serif text-sm focus:outline-none focus:border-amber-500" placeholder="your name" />
              <div className="text-[10px] uppercase tracking-widest text-amber-200/60 font-black">Token</div>
              <input value={betaPassword} onChange={(e) => setBetaPassword(e.target.value)} type="password" placeholder="token" className="w-[200px] max-w-[40vw] bg-amber-100/80 border border-amber-900/20 rounded px-3 py-2 text-black font-mono text-sm focus:outline-none" />
              <button type="button" onClick={doBetaLogin} disabled={betaLoading || !String(betaPassword || '').trim()} className="px-3 py-2 rounded bg-emerald-700/80 hover:bg-emerald-600/90 disabled:opacity-60 text-emerald-50 font-black text-xs uppercase tracking-widest">{betaLoading ? '…' : 'Login'}</button>
              <div className="hidden md:block text-[10px] font-mono text-black/70 whitespace-nowrap">Not logged in{betaErr ? ` · ${betaErr}` : ''}</div>
            </>
          )}
        </div>
      </div>

      <div className="bg-transparent flex items-center justify-center w-full p-8 pt-28">
        <div className="flex items-start w-full mx-auto flex-row gap-8 max-w-7xl px-4 max-h-[85vh]">
          <div className="flex-1 min-w-0 space-y-6">
            <NewsPanel />
            <div className="bg-black/60 backdrop-blur-md p-6 rounded-3xl border border-amber-900/20 shadow-2xl flex flex-col h-[460px] max-h-[60vh]">
              <div className="text-[10px] uppercase tracking-[0.35em] text-amber-500/70 font-black">TAVERN BANTER</div>
              <div className="mt-3 flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2 min-h-0">
                {!lobbyChatEnabled && <div className="bg-red-950/35 border border-red-900/40 rounded-2xl px-4 py-3"><div className="text-[10px] font-mono text-red-200/70">System</div><div className="text-sm font-serif text-red-50/90">Lobby chat is disabled by admin.</div></div>}
                {!!lobbyChatErr && <div className="bg-black/35 border border-amber-900/20 rounded-2xl px-4 py-3"><div className="text-[10px] font-mono text-amber-200/50">System</div><div className="text-sm font-serif text-amber-50/80">Chat error: {lobbyChatErr}</div></div>}
                {(lobbyChat || []).map((m, idx) => {
                  const isMe = String(m?.name || '') === String(playerName || '');
                  return (
                    <div key={m.id ?? idx} className={isMe ? 'px-1 py-1' : 'bg-black/35 border border-amber-900/20 rounded-2xl px-4 py-3'}>
                      <div className="text-[10px] font-mono text-amber-200/50 flex items-center gap-2">
                        <span className={m?.playerId ? 'cursor-pointer hover:text-amber-100' : ''} onClick={() => { if (m?.playerId) openProfileById(m.playerId); }}>{m.name || m.playerId || 'Anon'}</span>
                        {(m?.playerId && (ratingsMap[String(m.playerId)] != null)) && <button type="button" className="px-2 py-0.5 rounded-lg bg-black/35 hover:bg-black/45 border border-amber-900/20 text-amber-100/80 font-black" title="Открыть профиль" onClick={() => openProfileById(m.playerId)}>{ratingsMap[String(m.playerId)]}</button>}
                      </div>
                      <div className="text-sm font-serif text-amber-50/90 whitespace-pre-wrap">{m.text}</div>
                    </div>
                  );
                })}
                {(!(lobbyChat || []).length && !lobbyChatErr) && <div className="bg-black/35 border border-amber-900/20 rounded-2xl px-4 py-3"><div className="text-[10px] font-mono text-amber-200/50">System</div><div className="text-sm font-serif text-amber-50/80">Say hi.</div></div>}
              </div>
              <div className="mt-4 flex gap-2">
                <input value={lobbyChatInput} onChange={(e) => setLobbyChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendLobbyChat(); } }} placeholder={authToken ? (lobbyChatEnabled ? 'Напиши что-нибудь…' : 'Чат выключен') : 'Войди в /#/beta чтобы писать…'} disabled={!authToken || !lobbyChatEnabled} className="flex-1 bg-black/40 border border-amber-900/30 rounded-lg px-3 py-2 text-amber-200 font-serif text-sm focus:outline-none disabled:opacity-60" />
                <button type="button" onClick={sendLobbyChat} disabled={!authToken || !lobbyChatEnabled || !String(lobbyChatInput||'').trim()} className="flex-none px-4 py-2 bg-amber-600 text-amber-950 font-black rounded-xl uppercase tracking-widest shadow-lg transition-all disabled:opacity-60 hover:bg-amber-500">Отправить</button>
              </div>
            </div>
          </div>

          <div className="max-w-full space-y-6 w-[360px]">
            <div className="bg-black/75 backdrop-blur-xl p-8 rounded-3xl border border-amber-900/40 shadow-2xl flex flex-col h-fit">
              <h2 className="text-xl font-serif text-amber-500 font-bold mb-4 text-center uppercase tracking-widest border-b border-amber-500/20 pb-2">Список игр</h2>
              <div className="mb-4 flex gap-2">
                {['games','top10','tournaments'].map((tab) => (
                  <button key={tab} type="button" onClick={() => setRightTab(tab)} className={'flex-1 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest ' + (rightTab === tab ? 'bg-amber-600 text-amber-950 border-amber-500/40' : 'bg-black/40 text-amber-200/70 border-amber-900/30 hover:bg-black/50')}>
                    {tab === 'games' ? 'Игры' : tab === 'top10' ? 'ТОП-10' : 'Турниры'}
                  </button>
                ))}
              </div>

              {rightTab === 'top10' && <div className="space-y-2">{(top10 && top10.length > 0) ? top10.map((r, i) => <div key={i} className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-amber-900/20"><div className="flex items-center gap-2 min-w-0"><span className="text-[11px] font-mono text-amber-200/50 w-7">#{i + 1}</span><button type="button" className="font-serif text-amber-100 text-sm font-bold truncate hover:opacity-90 text-left" onClick={() => { const pid = String(r?.playerId || r?.player_id || '').trim(); if (pid) openProfileById(pid); }} disabled={!String(r?.playerId || r?.player_id || '').trim()}>{r.name}</button></div><div className="flex items-baseline gap-3 font-mono tabular-nums"><span className="text-[12px] text-amber-200/75">G:{Number(r.games ?? 0) || 0}</span><span className="text-[12px] text-amber-200/75">W:{Number(r.wins ?? 0) || 0}</span><span className="text-[12px] text-amber-100/95 font-black">R:{Number(r.rating ?? 0) || 0}</span></div></div>) : <div className="text-[10px] font-mono text-amber-200/30">{top10Err ? `Top10 unavailable: ${top10Err}` : '—'}</div>}</div>}

              {rightTab === 'tournaments' && <div className="space-y-2">{tournamentsErr && <div className="text-[10px] font-mono text-amber-200/30">{tournamentsErr}</div>}{(tournaments || []).slice(0, 10).map((t) => <button key={t.id} type="button" onClick={() => { window.location.hash = `#/tournament/${t.id}`; }} className="w-full text-left bg-black/40 border border-amber-900/20 rounded-2xl px-4 py-3 hover:bg-black/50"><div className="flex items-baseline justify-between gap-3"><div className="font-black text-amber-50">{t.name || t.id}</div><div className="text-[10px] font-mono text-amber-200/60">{t.status}</div></div><div className="mt-1 text-xs font-mono text-amber-200/60">{t.type} · table {t.tableSize} · players {t.playersCount}{(t.config?.maxPlayers ? `/${t.config.maxPlayers}` : '')}</div></button>)}{(!(tournaments || []).length && !tournamentsErr) && <div className="text-[10px] font-mono text-amber-200/30">No open tournaments.</div>}</div>}

              {rightTab === 'games' && <>
                <div className="mb-4 rounded-2xl border border-amber-900/20 bg-black/25 px-4 py-3 text-[12px] text-amber-100/80 font-serif">
                  Название игры будет запрошено после нажатия на кнопку <span className="font-black uppercase tracking-widest text-amber-200">Создать игру</span>.
                </div>
                <div className="overflow-y-auto space-y-2 max-h-56 mb-4 pr-1 custom-scrollbar">
                  <h3 className="text-[10px] uppercase tracking-widest text-amber-900/60 mb-2 border-b border-amber-900/10 pb-1">Доступные игры</h3>
                  {(matches || []).filter((match) => {
                    if (match.gameover) return false;
                    const seats = Array.isArray(match.players) ? match.players : Object.values(match.players || {});
                    return seats.some((p) => p && p.name == null);
                  }).map((match) => {
                    const title = String(match?.setupData?.lobbyTitle || '').trim();
                    const host = match.setupData?.hostName || 'Noble';
                    const displayName = title || (host.endsWith('s') ? `${host}' Realm` : `${host}'s Realm`);
                    return <div key={match.matchID} className="flex justify-between items-center gap-3 bg-slate-900/60 p-3 rounded-xl border border-amber-900/20 hover:bg-slate-900/80 transition-colors"><div className="flex flex-col min-w-0"><span className="font-serif text-amber-100 text-sm font-bold truncate">{displayName}</span><span className="text-[8px] text-amber-900/60 font-mono">ID: {match.matchID.slice(0, 4)}</span></div><button onClick={() => joinMatch(match.matchID)} className="text-amber-600 hover:text-amber-400 font-black text-xs uppercase">[Join]</button></div>;
                  })}
                  {(!matches || matches.length === 0) && <div className="text-center py-8 text-amber-900/40 italic text-sm font-serif">Ждём игры…</div>}
                </div>
                {!!authToken && (
                  <div className="overflow-y-auto space-y-2 max-h-48 mb-5 pr-1 custom-scrollbar">
                    <h3 className="text-[10px] uppercase tracking-widest text-amber-900/60 mb-2 border-b border-amber-900/10 pb-1">Мои лобби и прошлые игры</h3>
                    {(myMatches || []).map((match) => {
                      const title = String(match?.setupData?.lobbyTitle || '').trim();
                      const host = match.setupData?.hostName || 'Лобби';
                      const displayName = title || host;
                      return (
                        <div key={match.matchID} className="bg-black/35 border border-amber-900/20 rounded-2xl px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-serif text-amber-100 text-sm font-bold truncate">{displayName}</div>
                              <div className="text-[10px] font-mono text-amber-200/50 mt-1">{String(match?.status || '').replace('_', ' ')} · {String(match?.matchID || '').slice(0, 8)}</div>
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => renameOwnedMatch(match)} className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-amber-100 text-[10px] font-black uppercase tracking-widest">Переименовать</button>
                              <button type="button" onClick={() => deleteOwnedMatch(match)} className="px-3 py-1.5 rounded-lg bg-red-900/70 hover:bg-red-800 text-red-100 text-[10px] font-black uppercase tracking-widest">Удалить</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {(!(myMatches || []).length) && <div className="text-[10px] font-mono text-amber-200/30">У вас пока нет созданных лобби.</div>}
                  </div>
                )}
                <button onClick={createMatch} disabled={loading} className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-amber-950 font-black rounded-xl uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-60">Создать игру</button>
              </>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
