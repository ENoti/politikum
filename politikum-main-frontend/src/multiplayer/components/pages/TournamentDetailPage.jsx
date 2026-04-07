import React, { useEffect, useMemo, useState } from 'react';
import { SERVER } from '../../api.js';

function TournamentDetailPage({ tournamentId }) {
  const [t, setT] = useState(null);
  const [tables, setTables] = useState([]);
  const [bracket, setBracket] = useState(null);
  const [err, setErr] = useState('');
  const [tablesErr, setTablesErr] = useState('');
  const [loading, setLoading] = useState(false);
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


  const hasAdminToken = (() => {
    try { return !!window.localStorage.getItem('politikum.adminToken'); } catch { return false; }
  })();

  const load = async () => {
    setLoading(true);
    setErr('');
    setTablesErr('');
    try {
      const res = await fetch(`${SERVER}/public/tournament/${tournamentId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setT(json.tournament || null);

      const res2 = await fetch(`${SERVER}/public/tournament/${tournamentId}/tables?round=1`);
      if (!res2.ok) {
        if (res2.status === 404) {
          setTables([]);
          setTablesErr('Round 1 not generated yet.');
        } else {
          throw new Error(`tables: HTTP ${res2.status}`);
        }
      } else {
        const json2 = await res2.json();
        setTables(json2.tables || []);
      }

      // Load full bracket (all rounds) for single_elim.
      const res3 = await fetch(`${SERVER}/public/tournament/${tournamentId}/bracket`);
      if (res3.ok) {
        const json3 = await res3.json();
        setBracket(json3.rounds || json3.bracket || null);
      } else if (res3.status === 404) {
        setBracket(null);
      }
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tournamentId]);

  const publicCreateTournamentMatch = async (tb) => {
    try {
      setLoading(true);
      setErr('');
      const pname = (() => { try { return String(window.localStorage.getItem('politikum.playerName') || ''); } catch { return ''; } })();
      const res = await fetch(`${SERVER}/public/tournament/${tournamentId}/table/${tb.id}/create_match`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: pname }) });
      if (!res.ok) {
        let details = '';
        try { details = await res.text(); } catch {}
        details = String(details || '').trim();
        throw new Error(`HTTP ${res.status}${details ? ` — ${details}` : ''}`);
      }
      const json = await res.json();
      await load();
      if (json?.matchId) openMatch(json.matchId);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const adminCreateMatch = async (tableId) => {
    setLoading(true);
    setErr('');
    try {
      const tok = String(window.localStorage.getItem('politikum.adminToken') || '');
      if (!tok) throw new Error('Admin token missing');
      const res = await fetch(`${SERVER}/admin/tournament/${tournamentId}/table/${tableId}/create_match`, {
        method: 'POST',
        headers: { 'X-Admin-Token': tok },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const openMatch = (matchId) => {
    try { window.localStorage.setItem('politikum.prejoinMatchId', String(matchId || '')); } catch {}
    window.location.hash = '';
  };

  return (
    <div className="min-h-screen w-screen text-amber-50 flex items-center justify-center p-4 bg-cover bg-center bg-fixed" style={{ backgroundImage: "url('/assets/lobby_bg.webp')" }}>
      <div className="w-full max-w-4xl bg-slate-950/80 border border-amber-900/40 rounded-3xl p-6 shadow-2xl">
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <div className="text-amber-600 font-black uppercase tracking-[0.3em]">Tournament</div>
            {t && (
              <div className="mt-2 text-[10px] font-mono text-amber-200/60">({t.type} · table {t.tableSize} · {t.status})</div>
            )}
            <div className="text-amber-100/70 font-serif mt-1">{t?.name || tournamentId}</div>
          </div>
          <button type="button" onClick={() => { window.location.hash = '#/tournament'; }} className="text-xs font-mono text-amber-200/60 hover:text-amber-50">Back</button>
        </div>

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <button type="button" onClick={load} disabled={loading} className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-amber-950 font-black text-xs uppercase tracking-widest">
            {loading ? 'Loading…' : 'Refresh'}
          </button>

          <button type="button" disabled={loading} onClick={async () => {
            setLoading(true);
            setErr('');
            try {
              const tok = String(window.localStorage.getItem('politikum.authToken') || '');
              if (!tok) throw new Error('Not logged in (beta token missing)');
              let name = '';
              try { name = String(window.localStorage.getItem('politikum.playerName') || '').trim(); } catch {}
              const res = await fetch(`${SERVER}/public/tournament/${tournamentId}/join`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name || null }),
              });
              if (!res.ok) {
                let details = '';
                try { details = await res.text(); } catch {}
                details = String(details || '').trim();
                throw new Error(`HTTP ${res.status}${details ? ` — ${details}` : ''}`);
              }
              await load();
            } catch (e) { setErr(e?.message || String(e)); }
            finally { setLoading(false); }
          }} className="px-4 py-2 rounded-xl bg-emerald-700/60 hover:bg-emerald-600/70 disabled:opacity-60 text-emerald-50 font-black text-xs uppercase tracking-widest">Join</button>

          <button type="button" disabled={loading} onClick={async () => {
            setLoading(true);
            setErr('');
            try {
              const tok = String(window.localStorage.getItem('politikum.authToken') || '');
              if (!tok) throw new Error('Not logged in (beta token missing)');
              const res = await fetch(`${SERVER}/public/tournament/${tournamentId}/leave`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${tok}` },
              });
              if (!res.ok) {
                let details = '';
                try { details = await res.text(); } catch {}
                details = String(details || '').trim();
                throw new Error(`HTTP ${res.status}${details ? ` — ${details}` : ''}`);
              }
              await load();
            } catch (e) { setErr(e?.message || String(e)); }
            finally { setLoading(false); }
          }} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-amber-100 font-black text-xs uppercase tracking-widest">Leave</button>

          {err && <div className="text-xs font-mono text-red-300">Error: {err}</div>}
        </div>

        {t && (
          <div className="grid gap-3">
                        {(!(Array.isArray(bracket) && bracket.length > 0)) && (
              <div className="bg-black/40 border border-amber-900/20 rounded-2xl px-4 py-3">
                <div className="text-xs uppercase tracking-widest text-amber-200/70 font-black">Players</div>
                <div className="mt-2 grid gap-1 text-sm font-serif">
                  {(t.players || []).map((p) => (
                    <div key={p.playerId} className="text-amber-100/90">{p.name || p.playerId}</div>
                  ))}
                  {(!(t.players || []).length) && <div className="text-amber-200/40 italic">No players yet.</div>}
                </div>
              </div>
            )}

            {Array.isArray(bracket) && bracket.length > 0 && (
              <div className="bg-black/40 border border-amber-900/20 rounded-2xl px-4 py-3">
                <div className="text-xs uppercase tracking-widest text-amber-200/70 font-black mb-2">Bracket (MVP)</div>
                <div className="overflow-x-auto">
                  <div className="flex gap-4 min-w-full">
                    {bracket.map((round) => (
                      <div key={round.id || round.roundIndex} className="min-w-[180px]">
                        <div className="text-[10px] uppercase tracking-widest text-amber-200/60 font-black mb-2">
                          Round {round.roundIndex}
                        </div>
                        <div className="grid gap-2">
                          {(round.tables || []).map((tb) => (
                            <div key={tb.id || tb.tableIndex} className="rounded-xl border border-amber-900/30 bg-black/40 px-3 py-2">
                              <div className="flex items-baseline justify-between gap-2 mb-1">
                                <div className="text-[10px] font-mono text-amber-200/70">Table {tb.tableIndex}</div>
                                <div className="flex items-center gap-2">
                                  <div className="text-[10px] font-mono text-amber-200/50">{tb.status || 'pending'}</div>
                                  {tb.matchId && (
                                    <>
                                      <button type="button" onClick={() => openMatch(tb.matchId)} className="text-[10px] font-mono text-amber-200/70 hover:text-amber-50">Open match</button>
                                      {(tb.seats || []).some((s) => String(s.name || s.playerId || '').trim().toLowerCase() === viewerName) && (
                                        <button type="button" onClick={() => openMatch(tb.matchId)} className="text-[10px] font-mono text-emerald-300/80 hover:text-emerald-200">Join</button>
                                      )}
                                    </>
                                  )}
                                  {(!tb.matchId && (tb.seats || []).some((s) => String(s.name || s.playerId || '').trim().toLowerCase() === viewerName)) && (
                                    <button type="button" disabled={loading} onClick={() => publicCreateTournamentMatch(tb)} className="text-[10px] font-mono text-emerald-300/80 hover:text-emerald-200 disabled:opacity-60">Create match</button>
                                  )}
                                </div>
                              </div>
                              <div className="grid gap-0.5 text-xs font-serif">
                                {(tb.seats || []).map((s) => (
                                  <div key={String(s.seat)} className="text-amber-100/90">
                                    {s.name || s.playerId}
                                  </div>
                                ))}
                                {tb.winnerPlayerId && (
                                  <div className="mt-1 text-[10px] font-mono text-emerald-300">
                                    Winner: {tb.result?.winnerName || tb.winnerPlayerId}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          {!(round.tables || []).length && (
                            <div className="text-[10px] font-mono text-amber-200/40 italic">No tables.</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TournamentDetailPage;
