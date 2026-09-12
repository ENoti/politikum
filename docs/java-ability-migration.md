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

## Sixth bounded increment: persona 33 faction choice

`JavaAbilityRules` now owns `persona_33_on_enter_choose_faction` and the player move
`persona33ChooseFaction`: pending creation, owner/card validation, the seven allowed
factions, setting `chosenFactionTag`, passive recalculation, logging and clearing the
choice. Both previous JS implementations have been replaced with transport calls.

The port preserves existing behavior: the responder need not be the current player;
an already pending choice is not rejected if the card becomes blocked; the first
persona 33 in the coalition is used even if `sourceCardId` names another copy.
The entry dispatcher still suppresses blocked abilities. No game-rule corrections
or changes to REST, persisted state, the frontend or database are included.

The fixture now contains 58 scenarios. The 24 added cases were captured from the
old JS implementation before replacing it; the first 34 outputs are unchanged.
Coverage includes entry/blocked entry, every faction, invalid and empty selections,
wrong actor or pending state, missing player/card, off-turn choice, replacement of
an existing faction, display-name fallbacks and duplicate cards. Complete results,
including logs and state versions, are compared; input snapshots remain unchanged.

The separate automatic faction-selection path for bots still lives in JS. Its
decision policy and different log wording are deferred with the other bot rules.

## Seventh bounded increment: persona 37 bribe and silence

`JavaAbilityRules` now owns `persona_37_on_enter_bribe_and_silence` and
`persona37BribeAndSilence`. Java searches opposing coalitions for entry targets,
creates the pending choice, validates the selected owner/card, awards two tokens
through the shared scoring rules, permanently blocks the target's abilities,
recalculates passives, logs the result and clears the pending choice.
The previous JS bodies are replaced by transport calls.

The port deliberately preserves legacy differences between entry and resolution:
entry excludes persona 31, but an already pending choice can select an unshielded
persona 31; inactive opponents are not excluded. Resolution does not require the
current turn or continued presence of persona 37. An already blocked target remains
eligible. Bot target selection and its separate resolution path are still in JS.

The 24 new pre-migration snapshots bring the fixture to 82 scenarios, with the
previous 58 unchanged. Cases cover empty, mixed, shielded, non-persona and inactive
targets, blocked entry, actor/owner validation, missing participants/cards, invalid
pending state, off-turn resolution, source-name fallbacks, existing negative tokens
and repeated blocking. Full state/log equivalence and input immutability are checked.

## Eighth bounded increment: persona 21/26/28 token abilities

`JavaTokenAbilityRules` is a separate rule family, called by the existing native
ability dispatcher. It owns entry effects and player choices for:

- Persona 21: creation of the target choice, inversion of net token balance and
  swapping positive/negative counters, including legacy counter fallbacks.
- Persona 26: entry target availability, target validation, discard, persona 44
  discard bonuses and inheritance of the target's positive **net balance**.
- Persona 28: entry availability, target validation and transferring up to three
  tokens, bounded by requested amount and the positive net balance.

All six old JS bodies are replaced by transport calls. The scoring bridge reuses
the already native `JavaScoringRules` for token transfers, mirroring, passives and
discard bonuses. Amount coercion is retained at the transport boundary; limits and
game decisions are Java-owned. Bot decision/resolution paths remain in JS.

Compatibility deliberately includes the existing asymmetries: persona 21 can
invert a shielded or own card; persona 26/28 choices require their source card but
not the current turn; entry excludes persona 31 while pending resolution does not
repeat that exclusion. Persona 28's entry check can offer a choice when only FBK
cards have positive balances, although that choice rejects FBK targets. Own-card
targets, fractional amounts and zero transfers retain their previous behavior.

`token-ability-legacy.json` captures 98 scenarios from the pre-migration JS code.
`NativeTokenAbilityTest` compares complete output states, logs and versions by
scenario, and checks input immutability through the scenario runner. Coverage
includes valid/invalid actors and targets, missing source/owner, blocked entry,
shielded targets, faction filters, counter fallbacks, negative/zero balances,
numeric inputs, capped/fractional requests, own-card transfers, discarding the
source itself and persona 44's discard bonus. The earlier 82 ability snapshots
remain unchanged and run alongside these tests.

Remaining work: other ability families, their choice handlers, card-play dispatch, reactions, special victories and bot decisions. Graal remains required. These are bounded migration increments, not completion of all card mechanics.
