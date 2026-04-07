import React, { useEffect, useState } from 'react';
import { SERVER } from '../../api.js';

export default function AdminBugreportsPage() {
  const [token, setToken] = useState(() => {
    try { return window.localStorage.getItem('politikum.adminToken') || ''; } catch { return ''; }
  });
  const saveToken = (t) => {
    const v = String(t || '');
    setToken(v);
    try { window.localStorage.setItem('politikum.adminToken', v); } catch {}
  };

  const [items, setItems] = useState([]);
  const [status, setStatus] = useState(''); // '' | new | seen | done
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchList = async () => {
    if (!token) { setError('Set X-Admin-Token first.'); return; }
    setLoading(true);
    setError('');
    try {
      const q = status ? `?status=${encodeURIComponent(status)}&limit=100` : `?limit=100`;
      const res = await fetch(`${SERVER}/admin/bugreports${q}`, { headers: { 'X-Admin-Token': token } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setItems(Array.isArray(json?.rows) ? json.rows : []);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); /* eslint-disable-next-line */ }, [status]);

  const setItemStatus = async (id, st) => {
    if (!token) { setError('Set X-Admin-Token first.'); return; }
    const sid = Number(id);
    if (!Number.isFinite(sid)) return;

    // optimistic update
    setItems((arr) => (arr || []).map((r) => (Number(r.id) === sid ? { ...r, status: st } : r)));

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SERVER}/admin/bugreport/${encodeURIComponent(String(id))}/status`, {
        method: 'POST',
        headers: { 'X-Admin-Token': token, 'content-type': 'application/json' },
        body: JSON.stringify({ status: st }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json().catch(() => ({}));
      if (j?.ok === false) throw new Error(j?.error || 'failed');
      // re-fetch to confirm
      await fetchList();
    } catch (e) {
      setError(e?.message || String(e));
      await fetchList().catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  const fmt = (ms) => {
    if (!ms) return '—';
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  };

  return (
    <div className="min-h-screen w-screen overflow-x-hidden text-amber-50 flex items-center justify-center p-4 bg-cover bg-center bg-fixed" style={{ backgroundImage: "url('/assets/lobby_bg.webp')" }}>
      <div className="w-full max-w-5xl bg-slate-950/80 border border-amber-900/40 rounded-3xl p-6 shadow-2xl">
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <div className="text-amber-600 font-black uppercase tracking-[0.3em]">Politikum</div>
            <div className="text-amber-100/70 font-serif mt-1">Admin / bugreports</div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => { window.location.hash = '#/admin'; }} className="text-xs font-mono text-amber-200/60 hover:text-amber-50">Stats</button>
            <button type="button" onClick={() => { window.location.hash = '#/admin/tournament'; }} className="text-xs font-mono text-amber-200/60 hover:text-amber-50">Tournaments</button>
            <button type="button" disabled className="text-xs font-mono text-amber-50/90 font-black">Bugreports</button>
            <button type="button" onClick={() => { window.location.hash = ''; }} className="text-xs font-mono text-amber-200/60 hover:text-amber-50">Exit</button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-widest text-amber-400 font-black block mb-1">X-Admin-Token</label>
            <input type="password" value={token} onChange={(e) => saveToken(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-black/60 border border-amber-900/40 text-amber-50 text-sm font-mono" placeholder="Paste shared secret" />
          </div>
          <div className="flex items-end gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 rounded-xl bg-black/60 border border-amber-900/40 text-amber-50 text-sm font-mono">
              <option value="">all</option>
              <option value="new">new</option>
              <option value="seen">seen</option>
              <option value="done">done</option>
            </select>
            <button type="button" onClick={fetchList} disabled={loading} className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-amber-950 font-black text-xs uppercase tracking-widest">{loading ? 'Loading…' : 'Refresh'}</button>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-xs font-mono text-red-300 bg-red-950/40 border border-red-900/40 rounded-xl px-3 py-2">Error: {error}</div>
        )}

        <div className="overflow-x-hidden -mx-2">
          <table className="w-full text-left text-xs font-mono text-amber-100/90" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="border-b border-amber-900/40">
                <th className="px-2 py-2 whitespace-nowrap w-[140px]">When</th>
                <th className="px-2 py-2 whitespace-nowrap w-[64px]">Status</th>
                <th className="px-2 py-2 whitespace-nowrap w-[96px]">Match</th>
                <th className="px-2 py-2 whitespace-nowrap w-[120px]">From</th>
                <th className="px-2 py-2">Text</th>
                <th className="px-2 py-2 whitespace-nowrap w-[160px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const isOpen = String(expandedId) === String(r.id);
                const txt = String(r.text || '').trim();
                const oneLine = txt.replace(/\s+/g, ' ').slice(0, 100);
                const matchShort = String(r.match_id || '').slice(0, 12) || '—';
                const from = r.name || r.player_id || '—';
                return (
                  <React.Fragment key={r.id}>
                    <tr
                      className={"border-b border-amber-900/20 align-top cursor-pointer hover:bg-black/20"}
                      onClick={() => setExpandedId((v) => (String(v) === String(r.id) ? null : r.id))}
                      title="Click to expand"
                    >
                      <td className="px-2 py-2 whitespace-nowrap text-amber-200/70">{fmt(r.created_at)}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{r.status}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-amber-200/70">{matchShort}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{from}</td>
                      <td className="px-2 py-2">
                        <div className="whitespace-nowrap overflow-hidden text-ellipsis">{oneLine}{txt.length > oneLine.length ? '…' : ''}</div>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button type="button" disabled={loading} onClick={() => setItemStatus(r.id, 'seen')} className="px-2 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-700/70 disabled:opacity-60 text-amber-100 font-black text-[10px] uppercase tracking-widest">Seen</button>
                          <button type="button" disabled={loading} onClick={() => setItemStatus(r.id, 'done')} className="px-2 py-1 rounded-lg bg-emerald-700/60 hover:bg-emerald-600/70 disabled:opacity-60 text-emerald-50 font-black text-[10px] uppercase tracking-widest">Done</button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-amber-900/20 bg-black/20">
                        <td colSpan="6" className="px-2 py-3">
                          <div className="text-[11px] font-mono text-amber-200/60 flex flex-wrap gap-3">
                            <span>id: {r.id}</span>
                            <span>match: {String(r.match_id || '—')}</span>
                            <span>from: {from}</span>
                            {(r.contact || '').trim() && <span>contact: {String(r.contact)}</span>}
                          </div>
                          <div className="mt-2 whitespace-pre-wrap text-sm font-serif text-amber-50/90">{txt || '—'}</div>
                          {(r.context_json || '').trim() && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-[11px] font-mono text-amber-200/70">context_json</summary>
                              <pre className="mt-2 max-h-[260px] overflow-auto text-[10px] bg-black/40 border border-amber-900/20 rounded-xl p-2">{String(r.context_json)}</pre>
                            </details>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-2 py-6 text-center text-amber-300/60 text-xs">No bugreports.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
