# Match privacy and cleanup

## Client contract

- Public match metadata contains only public seat fields and stable profile IDs. Seat credentials and email addresses are never included, including seats in historical tournament results.
- `GET /games/politikum/{matchId}/state` without player headers returns a spectator view. All hands and the deck contain only `{ "hidden": true }` placeholders, preserving their lengths. Pre-deal decks and diagnostic traces are omitted.
- For a private view, send `X-Player-ID` and `X-Player-Credentials` headers. Invalid or incomplete credentials return HTTP 401. The response has `Cache-Control: no-store`. Credentials must not be put in the URL.
- Only the authenticated seat's hand is exposed. Arno's active `persona_17_pick_persona_from_hand` choice additionally reveals the selected opponent's hand to the actor, until that choice ends.
- Successful move and surrender responses use the same projection. Rejected moves cannot return raw pending/response payloads. Tick credentials are bound to the supplied player ID as well.
- `setPlayerIdentity` is server-only: identity comes from the session checked by the join endpoint.
- `MatchClientView` allowlists public state fields. New game features that need additional public fields must update this projection and its tests. Projection does not modify persisted engine state.

## Admin secret and rollout

`politikum.admin-token` now reads `POLITIKUM_ADMIN_TOKEN` from the server environment. There is no committed or controller fallback secret. The existing startup validation requires at least 16 characters. Configure a newly generated random token in the service environment before restarting; do not put it into Git or frontend Vite variables.

This change does not rotate production configuration or erase Git history. Treat the previously published administrative token as compromised. Replacing the source line is not a substitute for rotating it on the server.

Previously exposed match credentials also remain compromised: before reopening production, retire affected live matches or arrange credential replacement and verified player reconnection. This patch does not silently delete live matches or invalidate guest seats, and does not claim that previously leaked credentials become safe by filtering future responses.

Deploy backend and frontend together: older clients do not send player headers when polling and would see spectator views. Backend tests now run in both CI and the deployment build.

## Removed legacy files

The unused Citadels JavaScript block was removed from the server bundle; the active Politikum rules and bridge remain. Removed the old frontend GameContext, botLogic, Board, DraftSeats, unused ErrorBoundary/App.css, royal-decree text and DEV_RUN.sh (which referenced a missing Node server). Removed misplaced card-overlay JSX from match-lobby chat, where it referenced nonexistent variables.

The tracked development SQLite database is removed from Git and runtime data is ignored. Preserve local data outside the checkout before applying that deletion. Production uses its configured external database path; no production data is migrated by this change.

## Verification

Run `mvn clean verify` in `politikum-main-backend` and `npm ci && npm run build` in `politikum-main-frontend`.

`MatchPrivacyTest` uses the real Graal engine, a temporary SQLite database and MockMvc. It covers spectator/private views, credential mismatch and missing headers, move/tick/surrender responses, error payloads, Arno visibility, nonmutation of authoritative state, and historical tournament metadata.
