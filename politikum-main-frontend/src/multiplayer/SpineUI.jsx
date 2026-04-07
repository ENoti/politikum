import React, { useEffect } from 'react';
import GameClient from './GameClient.jsx';
import { SERVER } from './api.js';
import ActionBoard from './components/ActionBoard.jsx';
import DesktopLobbyBoard from './components/lobby/DesktopLobbyBoard.jsx';
import TournamentPage from './components/pages/TournamentPage.jsx';
import TournamentDetailPage from './components/pages/TournamentDetailPage.jsx';
import PolitikumWelcome from './components/pages/WelcomePage.jsx';
import AdminTournamentPage from './components/pages/AdminTournamentPage.jsx';
import AdminPage from './components/pages/AdminPage.jsx';
import AdminBugreportsPage from './components/pages/AdminBugreportsPage.jsx';
import ProfilePage from './components/pages/ProfilePage.jsx';
import useHashRoute from './hooks/useHashRoute.js';
import useMatchSession from './hooks/useMatchSession.js';

function Board(props) {
  const phase = String(props?.ctx?.phase || '');

  // Expose current phase so outer shell can decide whether to rotate the whole UI on mobile.
  try { window.__POLITIKUM_PHASE__ = phase; } catch {}

  if (phase === 'lobby') return <DesktopLobbyBoard {...props} />;
  return <ActionBoard {...props} matchID={props.matchID} />;
}

export default function SpineUI() {
  useEffect(() => {
    try { document.title = 'Politikum'; } catch {}
  }, []);

  const { hash, navigateHash } = useHashRoute('');
  const { matchID, playerID, credentials, setMatchSession, clearMatchSession } = useMatchSession();

  const forgetMatch = () => {
    clearMatchSession();
    navigateHash('');
  };

  useEffect(() => {
    if (!matchID) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${SERVER}/games/politikum/${encodeURIComponent(String(matchID))}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch {
        if (!cancelled) forgetMatch();
      }
    })();
    return () => { cancelled = true; };
  }, [matchID]);

  if (hash.startsWith('#/tournament/')) {
    const tid = hash.slice('#/tournament/'.length).split('?')[0];
    return <TournamentDetailPage tournamentId={tid} />;
  }

  if (hash.startsWith('#/tournament')) return <TournamentPage />;
  if (hash.startsWith('#/admin/tournament')) return <AdminTournamentPage />;
  if (hash.startsWith('#/admin/bugreports')) return <AdminBugreportsPage />;
  if (hash.startsWith('#/admin')) return <AdminPage />;
  if (hash.startsWith('#/profile/')) {
    const pid = hash.slice('#/profile/'.length).split('?')[0];
    return <ProfilePage playerId={pid} />;
  }

  if (!matchID) {
    return (
      <PolitikumWelcome
        onJoin={({ matchID: mid, playerID: pid, credentials: cred }) => {
          setMatchSession({ matchID: mid, playerID: pid, credentials: cred });
        }}
      />
    );
  }

  return <div className="relative"><GameClient matchID={matchID} playerID={playerID} credentials={credentials} board={Board} forgetMatch={forgetMatch} /></div>;
}
