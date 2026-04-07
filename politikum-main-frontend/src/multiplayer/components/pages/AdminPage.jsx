import React, { useEffect, useState } from 'react';
import { SERVER } from '../../api.js';
import useAdminToken from '../../hooks/useAdminToken.js';
import useAdminDashboard from '../../hooks/useAdminDashboard.js';
import usePublicProfile from '../../hooks/usePublicProfile.js';
import AdminProfileModal from '../profile/AdminProfileModal.jsx';

function formatTimeOnly(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString();
}

export default function AdminPage() {
  const { token, saveToken } = useAdminToken();
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [lobbyChat, setLobbyChat] = useState([]);
  const [lobbyChatEnabled, setLobbyChatEnabled] = useState(true);
  const [lobbyChatErr, setLobbyChatErr] = useState('');
  const [lobbyChatInput, setLobbyChatInput] = useState('');

  const lobbyChatToken = (() => {
    try { return String(window.localStorage.getItem('politikum.authToken') || ''); } catch { return ''; }
  })();
  const viewerName = (() => {
    try { return String(window.localStorage.getItem('politikum.playerName') || '').trim().toLowerCase(); } catch { return ''; }
  })();

  const [rightTab, setRightTab] = useState(() => {
    try { return String(window.localStorage.getItem('politikum.welcomeRightTab') || 'games'); } catch {}
    return 'top10';
  });

  useEffect(() => {
    try { window.localStorage.setItem('politikum.welcomeRightTab', rightTab); } catch {}
  }, [rightTab]);

  const [bugTgChatId, setBugTgChatId] = useState(() => {
    try { return window.localStorage.getItem('politikum.bugTgChatId') || ''; } catch { return ''; }
  });
  const [bugTgToken, setBugTgToken] = useState('');
  const [bugTgStatus, setBugTgStatus] = useState('');

  const [gamesWindow, setGamesWindow] = useState('day'); // hour|day|week|all

  const { open: showProfile, close: closeProfile, loading: profileLoading, error: profileErr, profile, openById: openProfileById } = usePublicProfile();
  const {
    summary, games, gamesOffset, gamesHasMore, gamesTotalFinished,
    liveMatches, liveTotal, leaderboard, loading, error,
    matchLogId, setMatchLogId, matchLogJson,
    setError, setLoading, fetchAdmin, forceSync, killMatch, fetchMatchLog,
  } = useAdminDashboard(token);

  const openProfileByIdMaybe = async (pid, expectedName = '') => {
    const id = String(pid || '').trim();
    if (!id) return;
    await openProfileById(id);
  };


  const filteredGames = (games || []).filter((g) => {
    const t = Number(g?.finishedAt || g?.createdAt || 0);
    if (!t) return true;
    const now = Date.now();
    if (gamesWindow === 'hour') return (now - t) <= 3600_000;
    if (gamesWindow === 'day') return (now - t) <= 24 * 3600_000;
    if (gamesWindow === 'week') return (now - t) <= 7 * 24 * 3600_000;
    return true;
  });

  const copyAdminText = (txt) => {
    const s = String(txt ?? '');
    try {
      const fn = navigator.clipboard?.writeText;
      if (fn) { fn.call(navigator.clipboard, s); return true; }
    } catch {}
    try { window.prompt('Copy to clipboard:', s); return false; } catch {}
    return false;
  };

  const formatTimeShortDay = (ms) => {
    try {
      if (!ms) return '';
      const d = new Date(ms);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}`;
    } catch { return ''; }
  };

  const formatTime = (ms) => {
    if (!ms) return '—';
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  };

  const formatDuration = (ms) => {
    if (!ms || ms <= 0) return '—';
    const minutes = Math.round(ms / 60000);
    if (minutes < 1) return '<1 min';
    return `${minutes} min`;
  };

  return (
    <div className="min-h-screen w-screen overflow-x-hidden text-amber-50 flex items-center justify-center p-4 bg-cover bg-center bg-fixed" style={{ backgroundImage: "url('/assets/lobby_bg.webp')" }}>
      <AdminProfileModal open={showProfile} onClose={closeProfile} loading={profileLoading} error={profileErr} profile={profile} />

      <div className="w-full max-w-5xl bg-slate-950/80 border border-amber-900/40 rounded-3xl p-6 shadow-2xl">
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <div className="text-amber-600 font-black uppercase tracking-[0.3em]">Politikum</div>
            <div className="text-amber-100/70 font-serif mt-1">Admin / stats (MVP)</div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                value={matchLogId}
                onChange={(e) => setMatchLogId(e.target.value)}
                placeholder="Match ID"
                className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-amber-900/30 text-amber-50/90 font-mono text-xs"
              />
              <button
                type="button"
                disabled={loading || !token}
                onClick={fetchMatchLog}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-amber-100 font-black text-[10px] uppercase tracking-widest"
                title="Fetch /admin/match/:id/log"
              >
                Fetch log
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={loading || !token}
                onClick={async () => {
                  if (!token) { setError('Set X-Admin-Token first.'); return; }
                  setLoading(true); setError('');
                  try {
                    const res = await fetch(`${SERVER}/admin/lobby_chat/disable`, { method: 'POST', headers: { 'X-Admin-Token': token } });
                    if (!res.ok) throw new Error(`disable: HTTP ${res.status}`);
                    await fetchAdmin();
                  } catch (e) { setError(e?.message || String(e)); } finally { setLoading(false); }
                }}
                className="px-3 py-2 rounded-xl bg-red-900/60 hover:bg-red-900/80 disabled:opacity-60 text-red-100 font-black text-[10px] uppercase tracking-widest"
                title="Disable lobby chat"
              >
                Chat OFF
              </button>
              <button
                type="button"
                disabled={loading || !token}
                onClick={async () => {
                  if (!token) { setError('Set X-Admin-Token first.'); return; }
                  setLoading(true); setError('');
                  try {
                    const res = await fetch(`${SERVER}/admin/lobby_chat/enable`, { method: 'POST', headers: { 'X-Admin-Token': token } });
                    if (!res.ok) throw new Error(`enable: HTTP ${res.status}`);
                    await fetchAdmin();
                  } catch (e) { setError(e?.message || String(e)); } finally { setLoading(false); }
                }}
                className="px-3 py-2 rounded-xl bg-emerald-700/70 hover:bg-emerald-600/80 disabled:opacity-60 text-emerald-50 font-black text-[10px] uppercase tracking-widest"
                title="Enable lobby chat"
              >
                Chat ON
              </button>
              <button
                type="button"
                disabled={loading || !token}
                onClick={async () => {
                  if (!token) { setError('Set X-Admin-Token first.'); return; }
                  if (!confirm('Clear all lobby chat messages?')) return;
                  setLoading(true); setError('');
                  try {
                    const res = await fetch(`${SERVER}/admin/lobby_chat/clear`, { method: 'POST', headers: { 'X-Admin-Token': token } });
                    if (!res.ok) throw new Error(`clear: HTTP ${res.status}`);
                    await fetchAdmin();
                  } catch (e) { setError(e?.message || String(e)); } finally { setLoading(false); }
                }}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-amber-100 font-black text-[10px] uppercase tracking-widest"
                title="Clear lobby chat"
              >
                Clear
              </button>

              {/* Copy moved into the match log panel */}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { window.location.hash = '#/admin/tournament'; }}
                className="text-xs font-mono text-amber-200/60 hover:text-amber-50"
              >
                Tournaments
              </button>
              <button
                type="button"
                onClick={() => { window.location.hash = '#/admin/bugreports'; }}
                className="text-xs font-mono text-amber-200/60 hover:text-amber-50"
              >
                Bugreports
              </button>
              <button
                type="button"
                onClick={() => { window.location.hash = ''; }}
                className="text-xs font-mono text-amber-200/60 hover:text-amber-50"
              >
                Exit
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-widest text-amber-400 font-black block mb-1">
              X-Admin-Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => saveToken(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-black/60 border border-amber-900/40 text-amber-50 text-sm font-mono"
              placeholder="Paste shared secret"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={fetchAdmin}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-amber-950 font-black text-xs uppercase tracking-widest"
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={forceSync}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-amber-100 font-black text-xs uppercase tracking-widest"
              title="Force rescan finished matches and write to SQLite"
            >
              Sync
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-xs font-mono text-red-300 bg-red-950/40 border border-red-900/40 rounded-xl px-3 py-2">
            Error: {error}
          </div>
        )}

        {!!matchLogJson && (
          <div className="mb-4">
            <div className="flex items-center justify-between gap-3 mb-1">
              <div className="text-[10px] uppercase tracking-widest text-amber-300/70 font-black">Match log JSON</div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="text-[10px] font-mono font-black text-amber-200/70 hover:text-amber-50 underline underline-offset-4"
                  onClick={() => {
                    const s = String(matchLogJson || '');
                    try {
                      const fn = navigator.clipboard?.writeText;
                      if (fn) { fn.call(navigator.clipboard, s); return; }
                    } catch {}
                    try { window.prompt('Copy match log JSON:', s); } catch {}
                  }}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="text-[10px] font-mono font-black text-amber-200/70 hover:text-amber-50 underline underline-offset-4"
                  onClick={() => setMatchLogJson('')}
                >
                  Hide
                </button>
              </div>
            </div>
            <textarea
              readOnly
              value={matchLogJson}
              className="w-full h-[240px] px-3 py-2 rounded-2xl bg-black/50 border border-amber-900/30 text-amber-50/90 font-mono text-[11px]"
            />
          </div>
        )}

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-center">
            <div className="bg-black/50 border border-amber-900/40 rounded-2xl p-3">
              <div className="text-[10px] uppercase tracking-widest text-amber-300/70 font-black mb-1">Total games</div>
              <div className="text-xl font-mono font-bold text-amber-50">{summary.gamesTotal}</div>
            </div>
            <div className="bg-black/50 border border-amber-900/40 rounded-2xl p-3">
              <div className="text-[10px] uppercase tracking-widest text-emerald-300/70 font-black mb-1">Finished</div>
              <div className="text-xl font-mono font-bold text-emerald-300">{summary.gamesFinished}</div>
            </div>
            <div className="bg-black/50 border border-amber-900/40 rounded-2xl p-3">
              <div className="text-[10px] uppercase tracking-widest text-amber-300/70 font-black mb-1">In progress</div>
              <div className="text-xl font-mono font-bold text-amber-300">{summary.liveInProgressTotal ?? summary.gamesInProgress}</div>
            </div>
            <div className="bg-black/50 border border-amber-900/40 rounded-2xl p-3">
              <div className="text-[10px] uppercase tracking-widest text-amber-300/70 font-black mb-1">Last finished</div>
              <div className="text-[11px] font-mono text-amber-100/80 leading-tight">
                {summary.lastFinishedAt ? formatTime(summary.lastFinishedAt) : '—'}
              </div>
              <div className="mt-1 text-[10px] font-mono text-amber-200/40">
                sync: {summary.lastAdminSyncAt ? formatTime(summary.lastAdminSyncAt) : '—'}
              </div>
            </div>
          </div>
        )}

        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowLeaderboard((v) => !v)}
            className="w-full flex items-baseline justify-between mb-2 text-left"
          >
            <div className="text-[11px] uppercase tracking-[0.25em] text-amber-300/80 font-black">Leaderboard (MVP)</div>
            <div className="text-[11px] font-mono text-amber-200/60">{showLeaderboard ? 'Hide' : 'Show'}</div>
          </button>
          {showLeaderboard && (
          <div className="overflow-x-auto -mx-2 mb-6">
            <table className="min-w-full text-left text-xs font-mono text-amber-100/90">
              <thead>
                <tr className="border-b border-amber-900/40">
                  <th className="px-2 py-2 whitespace-nowrap">Player</th>
                  <th className="px-2 py-2 whitespace-nowrap">Рейтинг</th>
                  <th className="px-2 py-2 whitespace-nowrap">Wins</th>
                  <th className="px-2 py-2 whitespace-nowrap">Игры</th>
                  <th className="px-2 py-2 whitespace-nowrap">Last win</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((r, i) => {
                  const canOpen = !!String(r?.playerId || '').trim();
                  return (
                  <tr key={i} className="border-b border-amber-900/20">
                    <td className="px-2 py-2 align-top whitespace-nowrap">
                      <button
                        type="button"
                        disabled={!canOpen}
                        onClick={() => { if (canOpen) openProfileById(r.playerId, r.name); }}
                        className={(canOpen ? 'underline underline-offset-4 hover:text-amber-50 ' : '') + 'text-amber-100/90 font-black'}
                        title={canOpen ? 'Open profile' : ''}
                      >
                        {r.name || '(anon)'}
                      </button>
                    </td>
                    <td className="px-2 py-2 align-top whitespace-nowrap text-amber-100/90 font-black tabular-nums">{Number(r.rating ?? 0) || 0}</td>
                    <td className="px-2 py-2 align-top whitespace-nowrap text-emerald-300 font-black tabular-nums">{r.wins}</td>
                    <td className="px-2 py-2 align-top whitespace-nowrap tabular-nums">{r.games}</td>
                    <td className="px-2 py-2 align-top whitespace-nowrap">{r.lastFinishedAt ? formatTimeShortDay(r.lastFinishedAt) : '—'}</td>
                  </tr>
                );
                })}
                {leaderboard.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-2 py-4 text-center text-amber-300/60 text-xs">
                      No finished games recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}

          <div className="flex items-baseline justify-between mb-2">
            <div className="text-[11px] uppercase tracking-[0.25em] text-amber-300/80 font-black">Live matches</div>
            <div className="text-[11px] font-mono text-amber-200/60">{liveTotal == null ? '' : `total ${liveTotal}`}</div>
          </div>
          <div className="overflow-x-auto -mx-2 mb-6">
            <table className="min-w-full text-left text-xs font-mono text-amber-100/90">
              <thead>
                <tr className="border-b border-amber-900/40">
                  <th className="px-2 py-2 whitespace-nowrap">Updated</th>
                  <th className="px-2 py-2 whitespace-nowrap">Players</th>
                  <th className="px-2 py-2 whitespace-nowrap">Match</th>
                  <th className="px-2 py-2 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {liveMatches.map((m) => (
                  <tr key={m.matchId} className="border-b border-amber-900/20">
                    <td className="px-2 py-2 align-top whitespace-nowrap">{formatTime(m.updatedAt || m.createdAt)}</td>
                    <td className="px-2 py-2 align-top">
                      <div className="flex flex-wrap gap-1">
                        {(m.players || []).map((p, idx) => (
                          <div
                            key={idx}
                            className={
                              'px-2 py-0.5 rounded-full text-[11px] flex items-center gap-1 ' +
                              (p.isBot ? 'bg-slate-800/80 text-amber-200/80 border border-amber-900/50' : 'bg-amber-700/25 text-amber-50 border border-amber-500/20')
                            }
                          >
                            <span>{p.name || '(anon)'}</span>
                            {p.isBot && <span className="text-[9px] uppercase tracking-widest">BOT</span>}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-2 align-top whitespace-nowrap text-amber-200/70">{String(m.matchId).slice(0, 8)}</td>
                    <td className="px-2 py-2 align-top whitespace-nowrap">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => killMatch(m.matchId)}
                        className="px-2 py-1 rounded-lg bg-red-900/40 hover:bg-red-900/60 border border-red-400/20 text-red-200/90 text-[11px] font-black"
                        title={String(m.matchId)}
                      >
                        Kill
                      </button>
                    </td>
                  </tr>
                ))}
                {liveMatches.length === 0 && (
                  <tr>
                    <td colSpan="3" className="px-2 py-4 text-center text-amber-300/60 text-xs">
                      No active matches.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-[11px] uppercase tracking-[0.25em] text-amber-300/80 font-black">Last games</div>
            <div className="flex items-center gap-2">
              <div className="text-[10px] font-mono text-amber-200/50">show:</div>
              <select
                value={gamesWindow}
                onChange={(e) => setGamesWindow(e.target.value)}
                className="px-2 py-1 rounded-lg bg-black/40 border border-amber-900/30 text-amber-50/80 font-mono text-[11px]"
              >
                <option value="hour">last hour</option>
                <option value="day">today</option>
                <option value="week">week</option>
                <option value="all">all</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-hidden">
            <div className="max-h-[280px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-xs font-mono text-amber-100/90">
              <thead>
                <tr className="border-b border-amber-900/40">
                  <th className="px-2 py-2 whitespace-nowrap">Finished</th>
                  <th className="px-2 py-2 whitespace-nowrap">Match</th>
                  <th className="px-2 py-2 whitespace-nowrap">Players</th>
                  <th className="px-2 py-2 whitespace-nowrap">Duration</th>
                </tr>
              </thead>
              <tbody>
                {filteredGames.map((g) => (
                  <tr key={g.matchId} className="border-b border-amber-900/20">
                    <td className="px-2 py-2 align-top whitespace-nowrap">{gamesWindow === 'day' ? formatTimeOnly(g.finishedAt || g.createdAt) : formatTime(g.finishedAt || g.createdAt)}</td>
                    <td className="px-2 py-2 align-top whitespace-nowrap">
                      <button
                        type="button"
                        className="font-mono text-[11px] text-amber-200/70 hover:text-amber-50 underline underline-offset-4"
                        onClick={() => { copyAdminText(String(g.matchId || '')); }}
                        title={g.matchId}
                      >
                        {String(g.matchId || '').slice(0, 12)}
                      </button>
                    </td>
                    <td className="px-2 py-2 align-top">
                      <div className="flex flex-wrap gap-1">
                        {(g.players || []).map((p, idx) => {
                          const label = String(p?.name || '(anon)');
                          const isWin = !!label && label === String(g.winnerName || '');
                          const canOpen = !!String(p?.playerId || '').trim();
                          return (
                            <button
                              key={idx}
                              type="button"
                              disabled={!canOpen}
                              onClick={() => { if (canOpen) openProfileById(p.playerId, p.name); }}
                              className={
                                'px-2 py-0.5 rounded-full text-[11px] flex items-center gap-1 border ' +
                                (isWin
                                  ? 'bg-emerald-700/25 border-emerald-400/40 text-emerald-100'
                                  : (p.isBot ? 'bg-slate-800/80 text-amber-200/80 border-amber-900/50' : 'bg-amber-700/25 text-amber-50 border-amber-500/20')) +
                                (canOpen ? ' hover:opacity-95' : ' opacity-80')
                              }
                              title={canOpen ? 'Open profile' : ''}
                            >
                              <span>{label}{isWin ? ' ★' : ''}</span>
                              {p.isBot && <span className="text-[9px] uppercase tracking-widest">BOT</span>}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-2 py-2 align-top whitespace-nowrap">{formatDuration(g.durationMs)}</td>
                  </tr>
                ))}
                {games.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-2 py-6 text-center text-amber-300/60 text-xs">
                      {summary ? 'No recorded games yet.' : 'Set token and refresh to load stats.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

              <div className="mt-2 flex items-center justify-center">
                <button
                  type="button"
                  disabled={loading || !gamesHasMore}
                  onClick={() => fetchAdmin({ loadMore: true })}
                  className="px-4 py-2 rounded-xl bg-black/40 hover:bg-black/55 border border-amber-900/20 text-amber-50 font-black text-[11px] uppercase tracking-widest disabled:opacity-50"
                  title={(gamesTotalFinished != null) ? `${gamesOffset}/${gamesTotalFinished}` : ''}
                >
                  {gamesHasMore ? 'Load more' : 'No more'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ card, onClick, disabled, showCheck }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'relative w-40 aspect-[2/3] rounded-2xl overflow-hidden border shadow-2xl transition-transform ' +
        (disabled ? 'opacity-40 cursor-not-allowed border-black/30' : 'cursor-pointer hover:scale-[1.03] border-amber-500/30')
      }
      title={card?.id}
    >
      <img src={card.img} alt={card.id} className="w-full h-full object-cover" draggable={false} />
      {showCheck && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-6 h-6 rounded-full bg-white/90 text-black border border-black/20 flex items-center justify-center text-[14px] font-black shadow">
          ✓
        </div>
      )}
    </button>
  );
}
