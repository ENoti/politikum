import { useCallback, useState } from 'react';
import { SERVER } from '../api.js';

export default function usePublicProfile() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);

  const close = useCallback(() => setOpen(false), []);

  const fetchProfile = useCallback(async (playerId) => {
    const res = await fetch(`${SERVER}/public/profile/${encodeURIComponent(String(playerId))}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json?.ok) throw new Error(String(json?.error || 'profile_not_found'));
    return json;
  }, []);

  const openById = useCallback(async (playerId) => {
    const id = String(playerId || '').trim();
    if (!id) return null;
    setOpen(true);
    setLoading(true);
    setError('');
    setProfile(null);
    try {
      const json = await fetchProfile(id);
      setProfile(json);
      return json;
    } catch (e) {
      setError(e?.message || String(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchProfile]);

  return { open, close, loading, error, profile, openById, setOpen };
}
