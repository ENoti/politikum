import { useState } from 'react';
import { SERVER, getMyMatchesApi } from '../api.js';
import usePollingValue from './usePollingValue.js';

async function fetchJson(path) {
  const res = await fetch(`${SERVER}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function usePublicLobbyData({ authToken, playerName }) {
  const [lobbyChatInput, setLobbyChatInput] = useState('');

  const matchesState = usePollingValue(async () => {
    const json = await fetchJson('/public/matches_open?limit=50');
    return Array.isArray(json.matches) ? json.matches : [];
  }, { initialValue: [], intervalMs: 4000 });

  const lobbyChatState = usePollingValue(async () => {
    const json = await fetchJson('/public/lobby_chat?limit=80');
    return {
      items: Array.isArray(json.items) ? json.items : [],
      enabled: json.enabled !== false,
    };
  }, { initialValue: { items: [], enabled: true }, intervalMs: 2000 });

  const top10State = usePollingValue(async () => {
    const json = await fetchJson('/public/leaderboard?limit=10');
    const items = Array.isArray(json.items) ? json.items : [];
    return items.filter((r) => {
      const n = String(r?.name || '').trim();
      if (!n) return false;
      if (n.startsWith('[H] Seat')) return false;
      return true;
    });
  }, { initialValue: [], intervalMs: 30000 });


  const myMatchesState = usePollingValue(async () => {
    if (!authToken) return [];
    const json = await getMyMatchesApi({ limit: 30 });
    return Array.isArray(json.matches) ? json.matches : [];
  }, { initialValue: [], intervalMs: 7000 });

  const tournamentsState = usePollingValue(async () => {
    const json = await fetchJson('/public/tournaments?includeFinished=0');
    return Array.isArray(json.items) ? json.items : [];
  }, { initialValue: [], intervalMs: 30000 });

  const sendLobbyChat = async () => {
    const text = String(lobbyChatInput || '').trim();
    if (!text) return { ok: false, error: 'empty' };
    if (!authToken) {
      alert('Chat requires beta login first (open /#/beta).');
      return { ok: false, error: 'auth_required' };
    }
    try {
      const res = await fetch(`${SERVER}/public/lobby_chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ text, name: playerName }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        const err = json?.error || `HTTP ${res.status}`;
        if (err === 'rate_limited') alert('Slow down (3s).');
        else if (err === 'disabled') alert('Lobby chat disabled.');
        else alert(`Chat failed: ${err}`);
        return { ok: false, error: err };
      }
      setLobbyChatInput('');
      lobbyChatState.setValue((prev) => ({
        items: prev?.items || [],
        enabled: prev?.enabled !== false,
      }));
      return { ok: true };
    } catch (e) {
      const err = e?.message || String(e);
      alert(`Chat failed: ${err}`);
      return { ok: false, error: err };
    }
  };

  return {
    matches: matchesState.value,
    matchesLoading: matchesState.loading,
    matchesErr: matchesState.error,
    refreshMatches: async () => {
      const json = await fetchJson('/public/matches_open?limit=50');
      const items = Array.isArray(json.matches) ? json.matches : [];
      matchesState.setValue(items);
      matchesState.setError('');
      return items;
    },
    lobbyChat: lobbyChatState.value?.items || [],
    lobbyChatEnabled: lobbyChatState.value?.enabled !== false,
    lobbyChatErr: lobbyChatState.error,
    lobbyChatInput,
    setLobbyChatInput,
    sendLobbyChat,
    top10: top10State.value,
    top10Err: top10State.error,
    tournaments: tournamentsState.value,
    tournamentsErr: tournamentsState.error,
    myMatches: myMatchesState.value,
    myMatchesErr: myMatchesState.error,
    refreshMyMatches: async () => {
      if (!authToken) return [];
      const json = await getMyMatchesApi({ limit: 30 });
      const items = Array.isArray(json.matches) ? json.matches : [];
      myMatchesState.setValue(items);
      myMatchesState.setError('');
      return items;
    },

  };
}
