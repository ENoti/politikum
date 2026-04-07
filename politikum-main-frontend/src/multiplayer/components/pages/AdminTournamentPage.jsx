import React, { useEffect, useState } from 'react';
import useAdminToken from '../../hooks/useAdminToken.js';
import useAdminTournamentData from '../../hooks/useAdminTournamentData.js';

export default function AdminTournamentPage() {
  const { token, saveToken } = useAdminToken();
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

  const {
    loading, error, items, includeFinished, setIncludeFinished,
    name, setName, type, setType, tableSize, setTableSize, maxPlayers, setMaxPlayers,
    load, create, setStatus, generateRound1,
  } = useAdminTournamentData(token);

  const fmt = (ms) => {
    if (!ms) return '—';
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  };

  return (
    <div className="min-h-screen w-screen text-amber-50 flex items-center justify-center p-4 bg-cover bg-center bg-fixed" style={{ backgroundImage: "url('/assets/lobby_bg.webp')" }}>
      <div className="w-full max-w-5xl bg-slate-950/80 border border-amber-900/40 rounded-3xl p-6 shadow-2xl">
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <div className="text-amber-600 font-black uppercase tracking-[0.3em]">Politikum</div>
            <div className="text-amber-100/70 font-serif mt-1">Admin / tournaments (v1)</div>
          </div>
          <div className="flex items-center gap-3 w-full">
            <button type="button" onClick={() => { window.location.hash = '#/admin'; }} className="text-xs font-mono text-amber-200/60 hover:text-amber-50">Stats</button>
            <button type="button" disabled className="text-xs font-mono text-amber-50/90 font-black">Турниры</button>
            <button type="button" onClick={() => { window.location.hash = ''; }} className="text-xs font-mono text-amber-200/60 hover:text-amber-50">Exit</button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-widest text-amber-400 font-black block mb-1">X-Admin-Token</label>
            <input type="password" value={token} onChange={(e) => saveToken(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-black/60 border border-amber-900/40 text-amber-50 text-sm font-mono" placeholder="Paste shared secret" />
          </div>
          <div className="flex items-end gap-2">
            <button type="button" onClick={load} disabled={loading} className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-amber-950 font-black text-xs uppercase tracking-widest">{loading ? 'Loading…' : 'Refresh'}</button>
            <label className="flex items-center gap-2 text-xs font-mono text-amber-200/70">
              <input type="checkbox" checked={includeFinished} onChange={(e) => setIncludeFinished(e.target.checked)} />
              include finished
            </label>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-xs font-mono text-red-300 bg-red-950/40 border border-red-900/40 rounded-xl px-3 py-2">Error: {error}</div>
        )}

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-black/40 border border-amber-900/20 rounded-2xl p-4">
            <div className="text-xs uppercase tracking-widest text-amber-200/70 font-black">Create tournament</div>
            <div className="mt-3 grid gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full px-3 py-2 rounded-xl bg-black/60 border border-amber-900/40 text-amber-50 text-sm font-mono" />
              <div className="grid grid-cols-3 gap-2">
                <select value={type} onChange={(e) => setType(e.target.value)} className="px-3 py-2 rounded-xl bg-black/60 border border-amber-900/40 text-amber-50 text-sm font-mono">
                  <option value="single_elim">Single elimination</option>
                  <option value="double_elim">Double elimination</option>
                </select>
                <input value={String(tableSize)} onChange={(e) => setTableSize(e.target.value)} placeholder="tableSize" className="px-3 py-2 rounded-xl bg-black/60 border border-amber-900/40 text-amber-50 text-sm font-mono" />
                <input value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} placeholder="maxPlayers" className="px-3 py-2 rounded-xl bg-black/60 border border-amber-900/40 text-amber-50 text-sm font-mono" />
              </div>
              <button type="button" onClick={create} disabled={loading} className="px-3 py-2 rounded bg-emerald-700/80 hover:bg-emerald-600/90 disabled:opacity-60 text-emerald-50 font-black text-xs uppercase tracking-widest">Create</button>
            </div>
          </div>

          <div className="bg-black/40 border border-amber-900/20 rounded-2xl p-4">
            <div className="text-xs uppercase tracking-widest text-amber-200/70 font-black">Notes</div>
            <div className="mt-2 text-xs font-mono text-amber-100/70 leading-relaxed">v1: create/open/close/cancel + join/leave on public page. No brackets yet.</div>
          </div>
        </div>

        <div className="text-[11px] uppercase tracking-[0.25em] text-amber-300/80 font-black mb-2">Турниры</div>
        <div className="overflow-x-auto -mx-2">
          <table className="min-w-full text-left text-xs font-mono text-amber-100/90">
            <thead>
              <tr className="border-b border-amber-900/40">
                <th className="px-2 py-2 whitespace-nowrap">Created</th>
                <th className="px-2 py-2 whitespace-nowrap">Name</th>
                <th className="px-2 py-2 whitespace-nowrap">Status</th>
                <th className="px-2 py-2 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-b border-amber-900/20">
                  <td className="px-2 py-2 align-top whitespace-nowrap">{fmt(t.createdAt)}</td>
                  <td className="px-2 py-2 align-top">
                    <div className="font-black">{t.name}</div>
                    <div className="text-[10px] text-amber-200/40">{t.id} · table {t.tableSize} · players {(t.playersCount ?? t.playerCount ?? '?')}/{Math.max(2, Number(t.tableSize)||2)}</div>
                    <a href={`#/tournament/${t.id}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[10px] uppercase tracking-widest text-amber-200/70 hover:text-amber-50 font-black">Open public page</a>
                  </td>
                  <td className="px-2 py-2 align-top whitespace-nowrap">{t.status}</td>
                  <td className="px-2 py-2 align-top whitespace-nowrap">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={loading} onClick={() => setStatus(t.id, 'open_registration')} className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-amber-100 font-black text-[10px] uppercase tracking-widest">Open reg</button>
                      <button type="button" disabled={loading} onClick={() => setStatus(t.id, 'close_registration')} className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-amber-100 font-black text-[10px] uppercase tracking-widest">Close reg</button>
                      <button type="button" disabled={loading} onClick={() => generateRound1(t.id)} className="px-2 py-1 rounded-lg bg-amber-700/70 hover:bg-amber-600/80 disabled:opacity-60 text-amber-50 font-black text-[10px] uppercase tracking-widest">Generate R1</button>
                      {t.status === 'running' && (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={async () => {
                            setLoading(true);
                            setError('');
                            try {
                              await adminPost(`/admin/tournament/${t.id}/generate_next_round`, null);
                              await load();
                            } catch (e) {
                              setError(e?.message || String(e));
                            } finally {
                              setLoading(false);
                            }
                          }}
                          className="px-2 py-1 rounded-lg bg-amber-700/70 hover:bg-amber-600/80 disabled:opacity-60 text-amber-50 font-black text-[10px] uppercase tracking-widest"
                        >
                          Next round
                        </button>
                      )}
                      <button type="button" disabled={loading} onClick={() => setStatus(t.id, 'cancel')} className="px-2 py-1 rounded-lg bg-red-900/60 hover:bg-red-900/80 disabled:opacity-60 text-red-100 font-black text-[10px] uppercase tracking-widest">Cancel</button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-2 py-6 text-center text-amber-300/60 text-xs">No tournaments yet. Ask an admin to create one.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
