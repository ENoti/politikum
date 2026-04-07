import { useMemo } from 'react';
import useSessionStorageState from './useSessionStorageState.js';

export default function useMatchSession() {
  const [matchID, setMatchID] = useSessionStorageState('politikum.lastMatchID', null, {
    serialize: (v) => String(v),
    deserialize: (v) => String(v || '') || null,
  });
  const [playerID, setPlayerID] = useSessionStorageState('politikum.lastPlayerID', null, {
    serialize: (v) => String(v),
    deserialize: (v) => String(v || '') || null,
  });
  const [credentials, setCredentials] = useSessionStorageState('politikum.lastCredentials', null);

  const api = useMemo(() => ({
    matchID,
    playerID,
    credentials,
    setMatchSession(next) {
      setMatchID(next?.matchID ? String(next.matchID) : null);
      setPlayerID(next?.playerID != null ? String(next.playerID) : null);
      setCredentials(next?.credentials || null);
    },
    clearMatchSession() {
      setMatchID(null);
      setPlayerID(null);
      setCredentials(null);
      try { window.localStorage.removeItem('politikum.prejoinMatchId'); } catch {}
    },
  }), [credentials, matchID, playerID, setCredentials, setMatchID, setPlayerID]);

  return api;
}
