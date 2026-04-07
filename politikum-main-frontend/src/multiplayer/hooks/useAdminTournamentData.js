import { useCallback, useEffect, useState } from 'react';
import { SERVER } from '../api.js';

export default function useAdminTournamentData(token) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [includeFinished, setIncludeFinished] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('single_elim');
  const [tableSize, setTableSize] = useState(4);
  const [maxPlayers, setMaxPlayers] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SERVER}/public/tournaments?includeFinished=${includeFinished ? '1' : '0'}`);
      if (!res.ok) throw new Error(`list: HTTP ${res.status}`);
      const json = await res.json();
      setItems(json.items || []);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [includeFinished]);

  useEffect(() => { load(); }, [load]);

  const adminPost = useCallback(async (path, body = null) => {
    if (!token) throw new Error('Set X-Admin-Token first.');

    const headers = { 'X-Admin-Token': token };
    const opts = { method: 'POST', headers };

    if (body !== null && body !== undefined) {
      opts.headers = { ...headers, 'Content-Type': 'application/json' };
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(`${SERVER}${path}`, opts);
    if (!res.ok) {
      let details = '';
      try { details = await res.text(); } catch {}
      details = String(details || '').trim();
      throw new Error(`${path}: HTTP ${res.status}${details ? ` — ${details}` : ''}`);
    }

    if (res.status === 204) return null;
    const ct = String(res.headers.get('content-type') || '');
    if (ct.includes('application/json')) return await res.json();
    const text = await res.text();
    return text ? { ok: true, text } : null;
  }, [token]);

  const create = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const mp = String(maxPlayers || '').trim();
      await adminPost('/admin/tournament/create', {
        name: String(name || '').trim(),
        type,
        tableSize: Number(tableSize) || 2,
        maxPlayers: mp ? (Number(mp) || null) : null,
      });
      setName('');
      setMaxPlayers('');
      await load();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [adminPost, load, maxPlayers, name, tableSize, type]);

  const setStatus = useCallback(async (id, action) => {
    setLoading(true);
    setError('');
    try {
      await adminPost(`/admin/tournament/${id}/${action}`);
      await load();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [adminPost, load]);

  const generateRound1 = useCallback(async (id) => {
    setLoading(true);
    setError('');
    try {
      await adminPost(`/admin/tournament/${id}/generate_round1`, null);
      await load();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [adminPost, load]);

  return {
    loading, error, items, includeFinished, setIncludeFinished,
    name, setName, type, setType, tableSize, setTableSize, maxPlayers, setMaxPlayers,
    setError, load, create, setStatus, generateRound1,
  };
}
