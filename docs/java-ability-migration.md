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

Remaining work: other ability families, their choice handlers, card-play dispatch, reactions, special victories and bot decisions. Graal remains required. This is a bounded migration increment, not completion of all card mechanics.
