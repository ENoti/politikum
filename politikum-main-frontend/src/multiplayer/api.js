
export const SERVER = (import.meta.env.VITE_SERVER || window.localStorage.getItem('politikum.server') || window.location.origin);

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const token = String(window.localStorage.getItem('politikum.authToken') || '').trim();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {}
  return headers;
}

async function parseJson(res) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.error || json?.message || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return json;
}

export async function createMatchApi({ numPlayers = 5, setupData = {} } = {}) {
  const res = await fetch(`${SERVER}/games/politikum/create`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ numPlayers, setupData }),
  });
  return parseJson(res);
}

export async function getMatchApi(matchID) {
  const res = await fetch(`${SERVER}/games/politikum/${encodeURIComponent(String(matchID))}`, { cache: 'no-store' });
  return parseJson(res);
}

export async function joinMatchApi(matchID, { playerID, playerName } = {}) {
  const res = await fetch(`${SERVER}/games/politikum/${encodeURIComponent(String(matchID))}/join`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ playerID, playerName }),
  });
  return parseJson(res);
}

export async function getGameStateApi(matchID) {
  const res = await fetch(`${SERVER}/games/politikum/${encodeURIComponent(String(matchID))}/state`, { cache: 'no-store' });
  return parseJson(res);
}

export async function sendMoveApi(matchID, { playerID, credentials, moveName, args = [] } = {}) {
  const res = await fetch(`${SERVER}/games/politikum/${encodeURIComponent(String(matchID))}/move/${encodeURIComponent(String(moveName))}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ playerID, credentials, args }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    return { ok: false, ...(json || {}), httpStatus: res.status };
  }
  return json;
}


export async function renameMatchOwnerApi(matchID, { lobbyTitle } = {}) {
  const res = await fetch(`${SERVER}/match/${encodeURIComponent(String(matchID))}/rename_owner`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ lobbyTitle }),
  });
  return parseJson(res);
}

export async function deleteMatchOwnerApi(matchID) {
  const res = await fetch(`${SERVER}/match/${encodeURIComponent(String(matchID))}/delete_owner`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return parseJson(res);
}

export async function getMyMatchesApi({ limit = 20 } = {}) {
  const res = await fetch(`${SERVER}/public/my_matches?limit=${encodeURIComponent(String(limit))}`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  return parseJson(res);
}


export async function surrenderMatchApi(matchID, { playerID, credentials } = {}) {
  const res = await fetch(`${SERVER}/games/politikum/${encodeURIComponent(String(matchID))}/surrender`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ playerID, credentials }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    return { ok: false, ...(json || {}), httpStatus: res.status };
  }
  return json;
}
