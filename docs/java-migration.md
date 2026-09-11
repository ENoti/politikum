# Java migration — stage 1 of 3

This is the first bounded stage, not a claim that one third of all card mechanics has been rewritten. The React UI remains the client; this migration concerns authoritative game rules.

## Now native Java

- `GameEngine` separates the match service from the implementation language.
- `GameState` provides a working-copy model while retaining unknown JSON fields from persisted matches. It is intentionally not yet a full set of typed card-effect DTOs.
- `CardCatalog` loads typed card definitions from `engine/cards.json`, validates IDs/types/counts and materializes all 83 physical cards. Java owns initial deck construction and shuffling. The remaining JS reads the same catalog data without re-normalizing it.
- `JavaLobbyEngine` creates matches and handles `setPlayerIdentity`, `setPlayerName`, `addBot`, `removePlayer`, `submitChat`, and `startGame`: seat ordering, host restrictions, chat limit, five-card initial hands without events, final deck assembly, initial turn and history.
- `PolitikumEngine` routes those commands to Java. Graal is initialized lazily only for the remaining rules and closed on shutdown.
- The corresponding JS setup, materialization, lobby/chat/start handlers were removed, so there is one implementation for migrated behavior.

## Compatibility

The REST and SQLite JSON contracts stay the same: `G`, `ctx`, `_stateID`, string seat/card IDs, pending choices and responses. Rejected moves return the original state, successful moves increment the version, and input snapshots are not mutated. Existing persisted normal lobbies and games use the same fields; no database migration is needed.

Initial scoring history deliberately preserves the legacy duplicate turn-zero snapshot. Random shuffles use the same Fisher–Yates algorithm; production does not promise identical randomness across deployments. Tests inject a fixed clock and random source. Match creation now explicitly rejects seat counts outside 2–5 (the public service already clamps to this range).

## Still in JavaScript

Card play/draw effects, persona and event abilities, passives and token arithmetic, reactions and deferred choices, bot turns, general turn advancement and victory resolution remain behind `GraalPolitikumEngine`. Graal dependencies must remain until those paths are ported. The native initial-turn setup is only for a normal lobby start, not a replacement for later card-dependent turn hooks.

## Evidence and tests

`lobby-legacy.json` was captured from the pre-migration engine with `Math.random = () => 0.25` and `Date.now = () => 1234567890`. Checkpoints compare the complete state except diagnostic trace and card bodies (cards are reduced to IDs). `catalog-legacy.sha256` independently captures every materialized card body from that engine, with recursive key sorting, UTF-8 JSON and definition order.

Tests cover legacy equivalence, all 2–5 seat deals, host/phase restrictions, chat retention, state immutability/extensions, and Java → remaining JS → Java execution. The seven privacy tests also run against the new routing engine.

Run `mvn clean verify` from `politikum-main-backend`. The frontend contract is unchanged in this stage.

## Next bounded stages

2. Shared scoring/token functions are now native; see [the second increment](java-scoring-migration.md). Turn/response lifecycle and ordinary draw/play actions are still pending. Add controlled Java callbacks only where a still-JS ability is needed. Keep one owner for version increments and turn transitions. Extend the privacy projection deliberately when adding fields.
3. Port abilities and bot decisions in tested groups, remove JS dispatch and Graal, then replace remaining map-based state with typed effect/player/card models without changing stored JSON accidentally.

Do not combine migration with speculative rule changes. Existing card and tournament bugs from the initial review need separate regression cases; translating them is not automatically fixing them. Production secret rotation from the previous security patch remains a separate rollout requirement.
