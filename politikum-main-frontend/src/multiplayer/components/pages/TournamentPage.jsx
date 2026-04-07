import React, { useEffect, useMemo, useState } from 'react';
import { SERVER } from '../../api.js';

function TournamentPage() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [lobbyChat, setLobbyChat] = useState([]);
  const [lobbyChatEnabled, setLobbyChatEnabled] = useState(true);
  const [lobbyChatErr, setLobbyChatErr] = useState('');
  const [lobbyChatInput, setLobbyChatInput] = useState('');

  const lobbyChatToken = (() => {
    try { return String(window.localStorage.getItem('politikum.authToken') || ''); } catch { return ''; }
  })();

  const [rightTab, setRightTab] = useState(() => {
    try { return String(window.localStorage.getItem('politikum.welcomeRightTab') || 'games'); } catch {}
    return 'games';
  });

  useEffect(() => {
    try { window.localStorage.setItem('politikum.welcomeRightTab', rightTab); } catch {}
  }, [rightTab]);

  const [includeFinished, setIncludeFinished] = useState(false);


  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`${SERVER}/public/tournaments?includeFinished=${includeFinished ? '1' : '0'}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setItems(json.items || []);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [includeFinished]);

  return (
    <div className="min-h-screen w-screen text-amber-50 flex items-center justify-center p-4 bg-cover bg-center bg-fixed" style={{ backgroundImage: "url('/assets/lobby_bg.webp')" }}>
      <div className="w-full max-w-4xl bg-slate-950/80 border border-amber-900/40 rounded-3xl p-6 shadow-2xl">
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <div className="text-amber-600 font-black uppercase tracking-[0.3em]">Politikum</div>
            <div className="text-amber-100/70 font-serif mt-1">Турниры</div>
          </div>
          <button type="button" onClick={() => { window.location.hash = ''; }} className="text-xs font-mono text-amber-200/60 hover:text-amber-50">Exit</button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <button type="button" onClick={load} disabled={loading} className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-amber-950 font-black text-xs uppercase tracking-widest">
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <label className="flex items-center gap-2 text-xs font-mono text-amber-200/60 select-none">
            <input type="checkbox" className="accent-amber-500" checked={includeFinished} onChange={(e) => { setIncludeFinished(e.target.checked); }} />
            <span>Show finished</span>
          </label>
          {err && <div className="text-xs font-mono text-red-300">Error: {err}</div>}
        </div>

        <div className="grid gap-3">
          {items.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { window.location.hash = `#/tournament/${t.id}`; }}
              className="text-left w-full bg-black/40 border border-amber-900/20 rounded-2xl px-4 py-3 hover:bg-black/50"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="font-black text-amber-50">{t.name || t.id}</div>
                <div className="text-[10px] font-mono text-amber-200/60">{t.status}</div>
              </div>
              <div className="mt-1 text-xs font-mono text-amber-200/60">{t.type} · table {t.tableSize}</div>
            </button>
          ))}
          {(!items.length && !loading) && (
            <div className="text-xs font-mono text-amber-200/50">No tournaments yet. Ask an admin to create one.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TournamentPage;
