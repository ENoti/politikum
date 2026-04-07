import React, { useEffect, useState } from 'react';
import { SERVER } from '../../api.js';
function DesktopLobbyBoard({ G, ctx, moves, playerID, forgetMatch = () => {} }) {
  const me = (G.players || []).find((p) => String(p.id) === String(playerID));
  const isHost = String(playerID) === '0' || String(me?.name || '') === 'You';
  const [name, setName] = useState(() => {
    const cur = String(me?.name || '').trim();
    if (!cur) return '';
    if (cur.startsWith('[H] Seat')) return '';
    return cur;
  });

  // Auto-apply saved alias into the match lobby (seat name) on first load.
  useEffect(() => {
    try {
      const cur = String(me?.name || '').trim();
      if (cur && !cur.startsWith('[H] Seat') && cur !== 'You') return;
      const saved = String(window.localStorage.getItem('politikum.playerName') || '').trim();
      if (!saved) return;
      if (saved.startsWith('[H] Seat')) return;
      // Only auto-set for your own seat.
      if (String(playerID) !== String(me?.id ?? playerID)) return;
      try { moves.setPlayerName(saved); } catch {}
      setName(saved);
    } catch {}
  }, [me?.name, playerID]);
  const [chatInput, setChatInput] = useState('');
  const [ratingsMap, setRatingsMap] = useState(() => ({}));
  const [showProfile, setShowProfile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileErr, setProfileErr] = useState('');
  const [profile, setProfile] = useState(null);

  const openProfileById = async (pid) => {
    const id = String(pid || '').trim();
    if (!id) return;
    setShowProfile(true);
    setProfileLoading(true);
    setProfileErr('');
    try {
      const res = await fetch(`${SERVER}/public/profile/${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setProfile(json);
    } catch (e) {
      setProfileErr(e?.message || String(e));
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${SERVER}/public/leaderboard?limit=200`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        const items = Array.isArray(json?.items) ? json.items : [];
        const m = {};
        for (const r of items) {
          const pid = String(r?.playerId || '').trim();
          if (!pid) continue;
          m[pid] = Math.round(Number(r?.rating || 0));
        }
        setRatingsMap(m);
      } catch {}
    })();
  }, []);

  // (Top10 moved to the Guest List screen; keep lobby light.)

  const [betaPassword, setBetaPassword] = useState('');
  const [authToken, setAuthToken] = useState(() => {
    try { return window.localStorage.getItem('politikum.authToken') || ''; } catch { return ''; }
  });
  const [authStatus, setAuthStatus] = useState('');
  const [lobbyTitle, setLobbyTitle] = useState(() => {
    try { return String(window.localStorage.getItem('politikum.currentLobbyTitle') || '').trim(); } catch { return ''; }
  });

  const activeCount = (G.activePlayerIds || []).length;

  // Top10 moved to Guest List screen.

  const doBetaLogin = async () => {
    try {
      setAuthStatus('');
      const res = await fetch(`${SERVER}/auth/register_or_login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: String(name || '').trim() || '',
          token: betaPassword,
          deviceId: (() => {
            try {
              let id = window.localStorage.getItem('politikum.deviceId');
              if (!id) {
                id = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
                window.localStorage.setItem('politikum.deviceId', id);
              }
              return id;
            } catch {
              return null;
            }
          })(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const tok = String(json?.token || '');
      if (!tok) throw new Error('No token returned');
      setAuthToken(tok);
      try { window.localStorage.setItem('politikum.authToken', tok); } catch {}

      // Bind stable player identity into match state (for Рейтинг/rankings).
      try {
        const pid = json?.playerId;
        if (pid) {
          try { window.localStorage.setItem('politikum.sessionPlayerId', String(pid)); } catch {}
          if (String(ctx?.phase || '') === 'lobby') {
            try { moves.setPlayerIdentity({ playerId: pid, email: null }); } catch {}
          }
        }
      } catch {}

      setAuthStatus('Logged in');
    } catch (e) {
      setAuthStatus(`Login failed: ${e?.message || String(e)}`);
    }
  };

  return (
    <div
      className="min-h-screen w-screen text-slate-100 font-sans bg-cover bg-center bg-fixed bg-no-repeat overflow-hidden flex items-center justify-center p-6"
      style={{ backgroundImage: "url('/assets/lobby_bg.webp')" }}
    >
      {showProfile && (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/55 backdrop-blur-sm pointer-events-auto">
          <div className="w-[min(520px,92vw)] max-h-[92vh] overflow-auto rounded-2xl border border-amber-900/30 bg-black/60 shadow-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-amber-100 font-black text-sm">Профиль</div>
                <div className="text-amber-200/70 font-mono text-[12px] mt-1">Доступен всем</div>
              </div>
              <button
                type="button"
                onClick={() => setShowProfile(false)}
                className="px-3 py-2 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 border border-amber-900/20 text-amber-50 font-black text-[10px] uppercase tracking-widest"
              >
                Закрыть
              </button>
            </div>

            {profileLoading && (
              <div className="mt-4 text-amber-200/80 font-mono text-[12px]">loading…</div>
            )}
            {!profileLoading && profileErr && (
              <div className="mt-4 text-red-200/90 font-mono text-[12px]">{profileErr}</div>
            )}
            {!profileLoading && !profileErr && profile?.ok && (
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
                      <a
                        className="px-3 py-2 rounded-xl bg-black/45 hover:bg-black/55 border border-amber-900/20 text-amber-50 font-black text-[10px] uppercase tracking-widest"
                        href={`/profile/${encodeURIComponent(String(profile.playerId || ''))}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Открыть публичный профиль
                      </a>
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
      )}

      <div className="w-full max-w-5xl bg-black/60 backdrop-blur-md p-6 rounded-3xl border border-amber-900/20 shadow-2xl">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-amber-600 font-black uppercase tracking-[0.3em]">Politikum</div>
            <div className="text-amber-100/95 font-serif mt-1 text-xl font-bold">{lobbyTitle || 'Лобби'}</div>
            <div className="text-amber-100/55 font-serif mt-1">Комната ожидания</div>
          </div>
          {/* player count hidden */}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Main column */}
          <div className="flex flex-col gap-4 min-h-[520px]">
            {/* Lobby chat */}
            <div className="bg-slate-900/40 rounded-2xl p-4 border border-amber-900/20 flex flex-col flex-1 min-h-0">
              <div className="text-xs uppercase tracking-widest text-amber-200/70 font-black">Чат лобби</div>
              <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                {(G.chat || []).map((m, i) => {
                  const sender = String(m?.sender || '').trim();
                  const p = (G.players || []).find((pp) => String(pp?.name || '').trim() === sender);
                  const pid = String(p?.identity?.playerId || '');
                  const r = pid ? ratingsMap[pid] : null;
                  return (
                    <div key={i} className="text-sm font-serif">
                      <button
                        type="button"
                        className="text-amber-200/60 font-mono text-[11px] mr-2 hover:text-amber-100"
                        onClick={() => { if (pid) openProfileById(pid); }}
                        disabled={!pid}
                        title={pid ? 'Открыть профиль' : ''}
                      >
                        {m.sender}{(r != null) ? ` (${r})` : ''}:
                      </button>
                      <span className="text-amber-50/90">{m.text}</span>
                      {it.kind === 'face' && String(it.card?.blockedBy || '') === 'action_7' && (
                        <img
                          src={'/cards/action_7.webp'}
                          alt={'action_7'}
                          className="absolute z-30 pointer-events-none select-none opacity-95"
                          style={{ width: '50%', aspectRatio: '2 / 3', left: '6%', top: '-6%', transform: 'rotate(18deg)' }}
                          draggable={false}
                        />
                      )}
                      {it.kind === 'face' && String(it.card?.shieldedBy || '') === 'action_13' && (
                        <img src={'/cards/action_13.webp'} alt={'action_13'} className="absolute z-30 pointer-events-none select-none opacity-95" style={{ width: '50%', aspectRatio: '2 / 3', right: '6%', top: '-6%', transform: 'rotate(-18deg)' }} draggable={false} />
                      )}
                      {it.kind === 'face' && (() => {
                        const plus = Number(it.card?.plusTokens ?? Math.max(0, Number(it.card?.vpDelta || 0)));
                        const minus = Number(it.card?.minusTokens ?? Math.max(0, -Number(it.card?.vpDelta || 0)));
                        if (!plus && !minus) return null;
                        return <div className="absolute left-2 bottom-2 z-20 flex items-center gap-1">{minus > 0 && <div className="w-7 h-7 rounded-full border flex items-center justify-center text-white font-black text-[13px] shadow-[0_2px_10px_rgba(0,0,0,0.6)] bg-red-700/95 border-red-200/50">-{minus}</div>}{plus > 0 && <div className="w-7 h-7 rounded-full border flex items-center justify-center text-white font-black text-[13px] shadow-[0_2px_10px_rgba(0,0,0,0.6)] bg-emerald-700/95 border-emerald-200/50">+{plus}</div>}</div>;
                      })()}
                      {(it.kind === 'face' && Number(it.card?.passiveVpDelta || 0) !== 0) && (
                        <TokenPips delta={it.card.passiveVpDelta} compact right dim />
                      )}
                      {it.kind === 'face' && it.card?.blockedAbilities && (
                        <div className="absolute top-[42px] left-1/2 -translate-x-1/2 flex gap-1 text-[9px] font-mono font-black z-40">
                          <span className="px-1.5 py-0.5 rounded-full bg-red-800/90 border border-red-300/40 text-red-50 shadow-md">X</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {(!(G.chat || []).length) && <div className="text-amber-200/40 italic text-sm font-serif">Пока нет сообщений.</div>}
              </div>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const msg = String(chatInput || '').trim();
                  if (!msg) return;
                  try { moves.submitChat(msg, String(me?.name || playerID)); } catch {}
                  setChatInput('');
                }}
              >
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Напиши что-нибудь…"
                  className="flex-1 px-3 py-1.5 rounded-xl bg-black/50 border border-amber-900/30 text-amber-50 text-sm"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-100 font-black text-xs uppercase"
                >
                  Отправить
                </button>
              </form>
            </div>

          </div>

          {/* Side panel */}
          <div className="grid gap-4">
            {/* Beta login block removed from pregame lobby (register on main page). */}

            {/* Seats */}
            <div className="bg-slate-900/40 rounded-2xl p-3 border border-amber-900/20">
              <div className="text-xs uppercase tracking-widest text-amber-200/70 font-black">Игроки</div>
              <div className="mt-3 grid gap-2">
                {(G.players || []).filter((p) => !!p?.active).map((p) => {
                  const active = !!p.active;
                  const bot = !!p.isBot || String(p.name || '').startsWith('[B]');
                  return (
                    <div key={p.id} className="flex items-center justify-between bg-black/40 rounded-xl px-3 py-2 border border-amber-900/10">
                      <div className="flex items-center gap-2">
                        <div className={(active ? 'text-amber-100' : 'text-amber-900/50') + ' font-serif text-sm flex items-center gap-2'}>
                          <span>{p.name || `Seat ${p.id}`}</span>
                          {(() => {
                            const pid = String(p?.identity?.playerId || '').trim();
                            const r = pid ? ratingsMap?.[pid] : null;
                            if (!pid || r == null) return null;
                            return (
                              <button
                                type="button"
                                className="text-amber-100/80 hover:text-amber-100 underline underline-offset-2 text-[11px] font-mono"
                                title="Открыть профиль"
                                onClick={() => openProfileById(pid, String(p?.name || ''))}
                              >
                                ({r})
                              </button>
                            );
                          })()}
                        </div>
                        {active && bot && <div className="text-[10px] font-mono text-amber-200/50">(bot)</div>}
                      </div>

                      {isHost && String(p.id) !== '0' && active && bot && (
                        <button
                          onClick={() => moves.removePlayer(String(p.id))}
                          className="text-amber-600 hover:text-amber-400 font-black text-xs uppercase"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>


              <div className="mt-4 flex gap-2 items-center">
                <button
                  type="button"
                  onClick={() => { try { forgetMatch(); } catch {} }}
                  className="flex-1 py-3 rounded-xl bg-red-900/70 hover:bg-red-800/80 text-red-100 font-black text-xs uppercase tracking-widest"
                >
                  Выйти
                </button>
              </div>

              {isHost && (
                <div className="mt-4 flex gap-2 items-center">
                  <button
                    onClick={() => moves.addBot()}
                    className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-100 font-black text-xs uppercase tracking-widest"
                  >
                    Добавить бота
                  </button>
                  <button
                    onClick={() => moves.startGame()}
                    className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-amber-950 font-black text-xs uppercase tracking-widest"
                  >
                    Старт
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* phase debug hidden */}
      </div>
    </div>
  );
}

export default DesktopLobbyBoard;
