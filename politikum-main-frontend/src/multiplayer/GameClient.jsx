import React from 'react';
import useMatchClient from './hooks/useMatchClient.js';

export default function GameClient({ matchID, playerID, credentials, board: Board, forgetMatch = () => {} }) {
  const { gameState, error, loading, moves, events, moveInFlight, surrender } = useMatchClient({ matchID, playerID, credentials });

  if (loading && !gameState) {
    return <div className="min-h-screen w-screen flex items-center justify-center bg-black text-amber-100 font-mono">Loading match…</div>;
  }
  if (error && !gameState) {
    return <div className="min-h-screen w-screen flex items-center justify-center bg-black text-red-200 font-mono">Failed to load match: {error}</div>;
  }

  return (
    <Board
      G={gameState?.G || {}}
      ctx={gameState?.ctx || {}}
      moves={moves}
      events={events}
      playerID={String(playerID)}
      matchID={String(matchID)}
      credentials={credentials}
      forgetMatch={forgetMatch}
      moveInFlight={moveInFlight}
      surrender={surrender}
    />
  );
}
