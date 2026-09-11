# Java migration — third bounded increment: turn lifecycle

## Native rules

`JavaTurnRules` owns mandatory and extra draws, hand-limit enforcement, response expiry (including the existing 900 ms tolerance), deferred-choice orchestration, event-queue flushing, player rotation, turn initialization, final-round triggering and ordinary score-based game completion.

Seven move handlers now delegate to Java: `beginTurnDraw`, `drawCard`, `endTurn`, `discardFromHandDownTo7`, `tick`, `skipResponseWindow`, and `forceSkipTurn`. Their former JS implementations and turn hooks were removed.

The native core uses `RuleNode` and an injected `Clock`. `GraalRuleNode` adapts live guest values without replacing existing card, player or array references. `GraalTurnBridge` exposes a fixed operation dispatcher; general host access is not enabled. The small `turn-effects.js` adapter retains card-specific effect calls for drawn events, deferred personas and queued events until those abilities are migrated.

## Deliberate fixes

Ending a turn with more than seven cards now successfully stores the discard choice. Previously the move returned INVALID_MOVE and rolled that choice back. Automatic draw/play completion also stops for this choice when no other choice or response is active. Once the hand is reduced to seven, the player can end the turn.

A hand-limit action cannot overwrite or clear an unrelated pending choice. Other legacy behavior, including round cutoff timing, winner selection and bot discard policy, is preserved by this migration.

## Compatibility and remaining work

REST, persisted JSON and privacy projection fields are unchanged. The JS move wrapper still owns snapshot rollback and version increments for these moves. Native lobby routing remains separate. No database migration is needed.

Card-play dispatch, individual abilities and their choice handlers, reactions, special card victories and bot decisions still use JS. Graal remains required. Moving lifecycle orchestration does not imply that every effect executed during a turn is native.

## Verification

`turn-legacy.json` captures 27 complete input/output scenarios from the previous engine with a fixed clock and random source. Tests compare the new implementation against them, excluding diagnostic trace. Coverage includes draw restrictions, actor checks, bot turn start, skipped mandatory draws, response expiry boundaries, deferred personas, event queues and ordinary game completion.

Additional tests cover accepted hand-limit choices and versioning, wrong-seat rejection, protection of unrelated choices, automatic draw limits, final-round blocking on choices and live card-reference identity. Earlier lobby, scoring and privacy suites remain enabled.

Run `mvn clean verify` in `politikum-main-backend`.
