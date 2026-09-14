# Current migration status

This is the authoritative status as of commit `927f35d`.

## Production backend

`PolitikumEngine` delegates match commands to `JavaGameEngine`. Java owns lobby setup, card catalog and dealing, turn lifecycle, scoring and tokens, card actions and events, persona abilities, reaction windows, victory, bot decisions and scheduled automatic advancement. The production JAR is checked by CI for the absence of JavaScript runtime files and Graal libraries.

The Graal bridges, legacy JavaScript engine and scenario files under `src/test` are comparison fixtures. They are not a production fallback. They should be retained until parity fixtures are replaced or the migration is formally frozen.

## Remaining JavaScript

The React client still owns presentation and interaction: ActionBoard rendering, local selection state, card fan layout, placement gestures, modals, keyboard shortcuts, audio, animation timers and HTTP transport. `G.choices` supplies server-derived eligibility and target lists, but the client still maps those choices to controls and sends the selected move.

This client code is not a second authoritative game engine. Every submitted move is validated by Java. It is nevertheless the largest remaining cleanup area; ActionBoard should be split into hand, coalition, target-picker and discard-picker components, with browser tests for each interactive family.

## Follow-up cleanup

Historical migration documents contain statements such as “Graal remains required”; those statements describe intermediate commits and should not be used as the current status. Completed-game metadata now records `java-native` as the engine version. Remaining work is frontend decomposition, broader interactive E2E coverage, and a deliberate decision about replacing test-only legacy fixtures.
