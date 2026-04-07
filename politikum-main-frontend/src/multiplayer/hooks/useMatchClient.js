import { useEffect, useMemo, useRef, useState } from 'react';
import { getGameStateApi, sendMoveApi, surrenderMatchApi } from '../api.js';

export default function useMatchClient({ matchID, playerID, credentials }) {
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [moveInFlight, setMoveInFlight] = useState(false);
  const queueRef = useRef(Promise.resolve());
  const aliveRef = useRef(true);
  const pollTimerRef = useRef(null);
  const failCountRef = useRef(0);
  const moveInFlightRef = useRef(false);

  const refreshState = async () => {
    const json = await getGameStateApi(matchID);
    const state = json?.state || json;
    if (!aliveRef.current) return state;
    failCountRef.current = 0;
    setGameState(state);
    setError('');
    setLoading(false);
    return state;
  };

  useEffect(() => {
    aliveRef.current = true;
    setLoading(true);

    const clearPoll = () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const scheduleNext = (stateOverride = null) => {
      clearPoll();
      if (!aliveRef.current) return;
      const state = stateOverride || gameState;
      const hasResponse = !!state?.G?.response;
      const hasPending = !!state?.G?.pending;
      const isMyTurn = String(state?.ctx?.currentPlayer ?? '') === String(playerID ?? '');
      const fastMs = (hasResponse || hasPending || isMyTurn || moveInFlightRef.current) ? 250 : 700;
      const backoff = Math.min(8000, failCountRef.current > 0 ? 1000 * Math.pow(2, failCountRef.current - 1) : 0);
      const nextMs = failCountRef.current > 0 ? backoff : fastMs;
      pollTimerRef.current = setTimeout(async () => {
        try {
          const nextState = await refreshState();
          scheduleNext(nextState);
        } catch (e) {
          if (!aliveRef.current) return;
          failCountRef.current += 1;
          setError(e?.message || String(e));
          setLoading(false);
          scheduleNext();
        }
      }, nextMs);
    };

    refreshState().then((state) => scheduleNext(state)).catch((e) => {
      if (!aliveRef.current) return;
      failCountRef.current += 1;
      setError(e?.message || String(e));
      setLoading(false);
      scheduleNext();
    });

    return () => {
      aliveRef.current = false;
      clearPoll();
    };
  }, [matchID, playerID]);

  const moves = useMemo(() => new Proxy({}, {
    get(_target, prop) {
      return (...args) => {
        const moveName = String(prop || '');
        const state = gameState;

        if (moveInFlightRef.current) {
          return Promise.resolve({ ok: false, error: 'move_in_flight', moveName });
        }

        if (moveName === 'drawCard' || moveName === 'beginTurnDraw') {
          const currentPlayer = String(state?.ctx?.currentPlayer ?? '');
          const myPlayer = String(playerID ?? '');
          const hasDrawn = !!state?.G?.hasDrawn;
          const hasPlayed = !!state?.G?.hasPlayed;
          if (currentPlayer && currentPlayer !== myPlayer) {
            const res = { ok: false, error: 'not_current_player', moveName, currentPlayer, playerID: myPlayer };
            console.error(`[move blocked locally] ${moveName}`, JSON.stringify(res, null, 2));
            return Promise.resolve(res);
          }
          if (moveName === 'beginTurnDraw') {
            if (hasDrawn) {
              const res = { ok: false, error: 'turn_already_primed', moveName };
              console.error(`[move blocked locally] ${moveName}`, JSON.stringify(res, null, 2));
              return Promise.resolve(res);
            }
            if (hasPlayed) {
              const res = { ok: false, error: 'turn_action_already_used', moveName };
              console.error(`[move blocked locally] ${moveName}`, JSON.stringify(res, null, 2));
              return Promise.resolve(res);
            }
          } else {
            if (!hasDrawn) {
              const res = { ok: false, error: 'turn_not_primed', moveName };
              console.error(`[move blocked locally] ${moveName}`, JSON.stringify(res, null, 2));
              return Promise.resolve(res);
            }
            if (hasPlayed) {
              const res = { ok: false, error: 'turn_action_already_used', moveName };
              console.error(`[move blocked locally] ${moveName}`, JSON.stringify(res, null, 2));
              return Promise.resolve(res);
            }
          }
        }

        if (
            state?.G?.response &&
            ![
              'playAction',
              'skipResponseWindow',
              'cancelPersonaResponse',
              'persona8SwapWithPlayedPersona',
              'tickBot',
              'tick',
            ].includes(moveName)
        ) {
          const res = {
            ok: false,
            error: 'blocked_by_response',
            moveName,
            response: state?.G?.response || null,
          };
          console.error(`[move blocked locally] ${moveName}`, JSON.stringify(res, null, 2));
          return Promise.resolve(res);
        }

        queueRef.current = queueRef.current.then(async () => {
          moveInFlightRef.current = true;
          setMoveInFlight(true);

          try {
            const res = await sendMoveApi(matchID, { playerID, credentials, moveName, args });

            if (!res?.ok) {
              if (res?.error !== 'move_in_flight') {
                console.error(`[move rejected] ${moveName}`, JSON.stringify(res, null, 2));
              }
              await refreshState().catch((e) => {
                console.error(`[refresh after rejected move failed] ${moveName}`, e);
              });
              return res;
            }

            failCountRef.current = 0;

            if (res?.state) {
              setGameState(res.state);
            }

            await refreshState().catch((e) => {
              console.error(`[refresh after move failed] ${moveName}`, e);
            });

            return res;
          } catch (e) {
            console.error(`[move failed] ${moveName}`, e);
            await refreshState().catch(() => {});
            return { ok: false, error: 'client_exception', message: e?.message || String(e) };
          } finally {
            moveInFlightRef.current = false;
            if (aliveRef.current) setMoveInFlight(false);
          }
        });
        return queueRef.current;
      };
    },
  }), [matchID, playerID, credentials, gameState]);

  const surrender = useMemo(() => async () => {
    if (moveInFlightRef.current) return { ok: false, error: 'move_in_flight' };
    moveInFlightRef.current = true;
    setMoveInFlight(true);
    try {
      const res = await surrenderMatchApi(matchID, { playerID, credentials });
      await refreshState().catch(() => {});
      return res;
    } finally {
      moveInFlightRef.current = false;
      if (aliveRef.current) setMoveInFlight(false);
    }
  }, [matchID, playerID, credentials]);

  const events = useMemo(() => ({
    endTurn: (...args) => moves.endTurn(...args),
  }), [moves]);

  return { gameState, error, loading, moves, events, refreshState, moveInFlight, surrender };
}
