# Java migration — fourth bounded increment: first ability group

`JavaAbilityRules` now owns three ability implementations and the associated adjacency/choice orchestration:

- `on_enter_adjacent_bonus`: matching neighboring base IDs, configured bonus amount, one-time flags and affected-card logging.
- `persona_4_on_enter_twitter_penalty`: counting Twitter events in the discard pile and applying the entry penalty.
- `persona_12_on_enter_adjacent_red_buff`: eligible neighbors, shields, automatic single-target buffs and creation of a two-target choice.
- `persona12ChooseAdjacentRed`: current-player and pending-owner checks, candidate revalidation, automatic selection when one candidate remains, and completion when no candidates remain.
- `applyAdjacencyBonusesAround`: triggering neighboring adjacency abilities, including the existing blocked-ability behavior.

The previous JS rule bodies were removed. Small transport functions call the fixed dispatcher exposed by `GraalAbilityBridge`. Live guest card references are preserved through `RuleNode`. Scoring callbacks use the existing JS transport to `JavaScoringRules`; token arithmetic is not reimplemented.

The existing distinction between simple entry-effect tokens and counter-aware choice-effect tokens is preserved. The pending candidate IDs remain authoritative as before; this increment does not change the rules for intervening coalition rearrangements. The generic JS ability dispatcher still guards blocked cards for direct ability calls.

`ability-legacy.json` was captured before replacement from 23 scenarios defined in `ability-scenarios.js`. The regression test compares complete output states and logs. Cases cover both/no neighbors, already awarded bonuses, blocked abilities, non-persona neighbors, Twitter penalties, shields, valid/invalid choices, wrong seats/current players/pending owners and disappearing eligible candidates. The scenario runner also checks live references and input immutability.

Validation: `mvn clean verify` in `politikum-main-backend`. Earlier privacy, lobby, scoring and lifecycle tests remain enabled. No REST, database or frontend contract changes are required.

## Fifth bounded increment: persona 13 response

`JavaAbilityRules` now also handles `persona13PickTarget` and `persona13Skip`. It validates the pending-choice owner, attacker, target type and shield before applying the penalty or clearing the choice. The response deliberately does not require the responder to be the current player. Token mirroring and recalculation still use the shared native scoring rules.

The corresponding JS handlers contain transport only. Creation of this response during card-play resolution and automatic bot retaliation remain in JS for a later increment.

Eleven additional legacy scenarios bring the ability fixture to 34 cases: off-turn response, wrong actor/owner/target, shielded or non-persona targets, missing attacker, invalid pending state, and allowed/rejected skips. The first 23 captured outputs remain unchanged. The existing scoring integration test also exercises persona 13 with token mirroring.

Remaining work: other ability families, their choice handlers, card-play dispatch, reactions, special victories and bot decisions. Graal remains required. These are bounded migration increments, not completion of all card mechanics.
