import { useCallback, useEffect, useState } from 'react';
import { SERVER } from '../api.js';

export default function useAdminDashboard(token) {
  const [summary, setSummary] = useState(null);
  const [games, setGames] = useState([]);
  const [gamesOffset, setGamesOffset] = useState(0);
  const [gamesHasMore, setGamesHasMore] = useState(false);
  const [gamesTotalFinished, setGamesTotalFinished] = useState(null);
  const [liveMatches, setLiveMatches] = useState([]);
  const [liveTotal, setLiveTotal] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [matchLogId, setMatchLogId] = useState('');
  const [matchLogJson, setMatchLogJson] = useState('');

  const fetchAdmin = useCallback(async (opts = {}) => {
    if (!token) {
      setError('Set X-Admin-Token first.');
      return;
    }
    const loadMore = !!opts.loadMore;
    const limitGames = 20;
    const offset = loadMore ? Number(gamesOffset || 0) : 0;

    setLoading(true);
    setError('');
    try {
      const headers = { 'X-Admin-Token': token };
      const [summaryRes, gamesRes, matchesRes, lbRes] = await Promise.all([
        fetch(`${SERVER}/admin/summary`, { headers }),
        fetch(`${SERVER}/admin/games?limit=${limitGames}&offset=${offset}`, { headers }),
        fetch(`${SERVER}/admin/matches?limit=20`, { headers }),
        fetch(`${SERVER}/admin/leaderboard?limit=20`, { headers }),
      ]);
      if (!summaryRes.ok) throw new Error(`summary: HTTP ${summaryRes.status}`);
      if (!gamesRes.ok) throw new Error(`games: HTTP ${gamesRes.status}`);
      if (!matchesRes.ok) throw new Error(`matches: HTTP ${matchesRes.status}`);
      if (!lbRes.ok) throw new Error(`leaderboard: HTTP ${lbRes.status}`);
      const summaryJson = await summaryRes.json();
      const gamesJson = await gamesRes.json();
      const matchesJson = await matchesRes.json();
      const lbJson = await lbRes.json();
      setSummary(summaryJson);
      setGamesTotalFinished(summaryJson?.gamesFinished ?? null);

      const newItems = gamesJson.items || [];
      setGames((prev) => loadMore ? [...prev, ...newItems] : newItems);

      const nextOffset = offset + newItems.length;
      setGamesOffset(nextOffset);

      const totalFinished = Number(summaryJson?.gamesFinished ?? NaN);
      if (Number.isFinite(totalFinished)) setGamesHasMore(nextOffset < totalFinished);
      else setGamesHasMore(newItems.length >= limitGames);

      setLiveMatches(matchesJson.items || []);
      setLiveTotal(matchesJson.total ?? null);
      setLeaderboard(lbJson.items || []);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [token, gamesOffset]);

  useEffect(() => {
    if (!token) return;
    fetchAdmin();
  }, [token, fetchAdmin]);

  const forceSync = useCallback(async () => {
    if (!token) { setError('Set X-Admin-Token first.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SERVER}/admin/sync`, { method: 'POST', headers: { 'X-Admin-Token': token } });
      if (!res.ok) throw new Error(`sync: HTTP ${res.status}`);
      await fetchAdmin();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [token, fetchAdmin]);

  const killMatch = useCallback(async (matchId) => {
    if (!token) { setError('Set X-Admin-Token first.'); return; }
    const mid = String(matchId || '').trim();
    if (!mid) return;
    if (!window.confirm(`Kill match ${mid}? This deletes it from server storage.`)) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SERVER}/admin/match/${encodeURIComponent(mid)}/kill`, {
        method: 'POST', headers: { 'X-Admin-Token': token },
      });
      if (!res.ok) throw new Error(`kill: HTTP ${res.status}`);
      await fetchAdmin();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [token, fetchAdmin]);

  const fetchMatchLog = useCallback(async () => {
    if (!token) { setError('Set X-Admin-Token first.'); return; }
    const mid = String(matchLogId || '').trim();
    if (!mid) { setError('Set Match ID.'); return; }
    setLoading(true);
    setError('');
    setMatchLogJson('');
    try {
      const res = await fetch(`${SERVER}/admin/match/${encodeURIComponent(mid)}/log?limit=200`, {
        headers: { 'X-Admin-Token': token },
      });
      if (!res.ok) throw new Error(`match log: HTTP ${res.status}`);
      const json = await res.json();
      setMatchLogJson(JSON.stringify(json, null, 2));
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [token, matchLogId]);

  return {
    summary, games, gamesOffset, gamesHasMore, gamesTotalFinished,
    liveMatches, liveTotal, leaderboard, loading, error,
    matchLogId, setMatchLogId, matchLogJson,
    setError, setLoading, fetchAdmin, forceSync, killMatch, fetchMatchLog,
  };
}
