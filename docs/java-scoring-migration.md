# Java migration — second bounded increment: scoring

## Native rules

`JavaScoringRules` now owns coalition scoring, passive VP recalculation, both existing token arithmetic paths, persona 43's positive-token reduction, persona 22 → persona 15 mirroring with arming-turn checks, and persona 44's discard bonus.

Passive rules cover personas 2, 18, 24, 25, 27 and 33, including blocked abilities, coalition position, gender, faction counts, adjacency and chosen faction. Inactive players are treated exactly as in the existing implementation.

The simple ability-token path and the separate plus/minus-counter path intentionally remain distinct: merging them would change existing gameplay. Existing rules are being moved, not silently corrected.

## Temporary interoperability

The remaining JS abilities call Java through one explicitly registered Graal `ProxyExecutable`, `__politikumNativeScoring`. No general host reflection or filesystem access is enabled. `ScoringBridge` accepts a fixed set of operations and returns only calculated card fields.

The JS functions `scorePlayer`, `recalcPassives`, `applyTokenDelta`, `applyTokenDelta2` and `persona44OnPersonaDiscarded` now contain transport only. Their former rule implementations were removed. Requests contain coalition data and turn number rather than the complete match, hands or logs. Results are applied to existing card objects without replacing arrays, players or cards; this preserves references held by unfinished JS ability handlers. The explicit target can be outside a coalition, so its update is applied separately after coalition updates.

The JSON adapter adds serialization inside a move. It is a temporary migration cost; a later fully native move dispatcher should call `JavaScoringRules` directly. No production throughput claim is made by these tests.

## Verification

`scoring-legacy.json` contains 45 input/output cases captured from the pre-increment JS implementation. Tests compare every case against both direct native rules and the real Graal callback path. They cover positive/negative/zero token changes, stored counters, mirroring disabled/enabled and not-yet-armed mirrors, blocked passives, rotated coalitions, faction selection, discard bonuses and score fallback behavior.

An additional test drives `persona13PickTarget` through `PolitikumEngine`, checks that persona 22 and persona 15 receive their respective token changes, verifies pending-choice completion and preserves the original input snapshot. All earlier lobby and privacy tests remain enabled.

Validation command: `mvn clean verify` in `politikum-main-backend`.

## Remaining scope

This increment completes the scoring portion of the earlier proposed stage 2. A [subsequent increment](java-turn-migration.md) moves turn/response lifecycle, draws and ordinary game completion to Java. Card-play dispatch, individual abilities and their choice handlers, reactions, special victories and bot decisions remain in JS. Inline arithmetic in those unported handlers and frontend display calculations also remain. Graal cannot yet be removed.

No REST or SQLite schema changes are required, and the privacy projection is unchanged. Deployment and previously required production-secret rotation are not performed by this code change.
