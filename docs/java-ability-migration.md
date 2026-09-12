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

## Ninth bounded increment: persona 20/32 card recovery

`JavaRecoveryAbilityRules` owns persona 20's entry effect and discard picker, and
persona 32's entry effect, coalition-to-hand move and cancellation. The five JS
rule bodies are now transport calls. Java preserves card references, hand order,
pending ownership, log order and the existing passive recalculation points.
Action-card display names still use the shared JS `actionTitle` formatter through
a callback; it makes no game decisions. Bot paths and generic `cancelPending`
remain in JS.

Legacy behavior is retained deliberately: persona 20's single-action automatic
pickup adds the live card to the hand without removing it from `G.discard`, because
the old code removed it only from a filtered array. This is a known duplication
bug, captured explicitly and deferred to a separate fix. Entry considers only
actions, while an already pending picker accepts any non-event card. Persona 32
can return itself, shielded or blocked cards, preserving their token fields; it
does not trigger persona 44's discard bonus. Choices are not restricted to the
current turn, and cancel only checks pending kind and owner.

`recovery-ability-legacy.json` contains 51 snapshots captured before replacing the
JS bodies. `NativeRecoveryAbilityTest` compares complete states/logs/versions and
the runner checks input immutability and the single-card entry alias. Cases cover
empty/mixed discards, automatic/manual pickup, wrong actors and pending states,
missing cards/players/source, action title fallbacks, duplicate IDs, card order,
shielded/blocked recovery, returning the source itself and cancellation. Earlier
ability and token fixtures remain unchanged.

## Tenth bounded increment: persona 34 topdeck guess

`JavaTopdeckAbilityRules` owns the entry effect and `persona34GuessTopdeck`.
Java validates the pending owner, handles skipping, finds the first persona while
counting intervening non-persona cards, compares base IDs and resolves instant
victory. It preserves the deck and writes both `G.gameOver` and `ctx.gameover`,
plus `G.winnerId`, matching the existing `makeEvents.endGame()` behavior without
running normal round-end scoring. The two JS rule bodies are now transport only.

Display-only action/persona title callbacks are grouped under `JavaAbilityRules.Titles`;
the shared JS catalog-name formatter remains for now. No card lookup for gameplay,
winner decision or deck inspection is delegated to that formatter.

Legacy behavior is retained: an existing pending choice can resolve off-turn or
after the source has disappeared or become blocked. Null deck entries are ignored
without increasing the skipped count. A guess containing an instance suffix does
not match the card's base ID. Entry still respects the generic blocked-ability guard.

`topdeck-ability-legacy.json` contains 29 pre-migration snapshots. Tests compare
complete states, logs and versions and assert input/deck immutability. They cover
correct/incorrect/unknown guesses, skip and empty inputs, invalid owners/pending,
missing source/player/deck, mixed decks, title fallbacks and terminal states.
Follow-up moves after instant victory must fail with `gameover`. All earlier
ability, token and recovery fixtures remain unchanged.

Remaining work: other ability families, their choice handlers, card-play dispatch, reactions, special victories and bot decisions. Graal remains required. These are bounded migration increments, not completion of all card mechanics.

## Coalition choices: personas 5, 7 and 11

`JavaCoalitionAbilityRules` owns entry selection for 5/7, coalition swaps,
liberal discard/token transfer, and Solovei's optional offer and discard.
The persona 5 wrapper only forwards the existing Java lifecycle calls.
Legacy snapshots cover ownership, turn guards, missing sources, shielded targets,
owner inference for older clients, token transfer and persona 44 discard bonuses.
The migration preserves the existing differences between entry target filtering
and final target validation. Clock-fixed comparisons include complete resulting
state and logs and verify that rejected moves do not mutate the input.

## Hand abilities: personas 16, 17 and 45

`JavaHandAbilityRules` owns drawing three cards, queued-event entry, discard
selection and duplicate signatures, opponent selection, revealed persona theft,
and random hand theft. `AbilityEffects` forwards event execution to the remaining
ability dispatcher and lifecycle work to the existing Java turn engine. Randomness
and presentation helpers remain adapter inputs. The old hand-limit and missing-id
selection semantics are preserved for a separate rules review.

The one intentional fix is persona 45 against an empty hand: reject the choice
without state mutation instead of throwing `toDiscard is not defined`.
The legacy fixture retains the original exception; the test explicitly checks
this controlled difference. Other scenarios compare the full legacy state.

## Reactions and response orchestration

`JavaResponseRules` owns persona 8's swap, both persona 10 cancel aliases,
reaction cards 6/8/14, creation of action/persona response windows, human/bot
responder selection, automatic bot cancellation, and generic pending cancellation.
Existing `JavaTurnRules` continues to own expiry, skipping, deferred resolution
and turn completion. The JS move layer forwards the corresponding operations.
The duplicate action 8 cancellation body and JS response-duration constants were
removed. The 15-second windows, 900ms expiry tolerance and the existing action 8
grace check are preserved, including the expiry call before action dispatch.

`JavaMigratedBotAbilities` also migrates the remaining bot execution branches for
5/7/11/17/45. Bot choices that occur before drawing remain before drawing; the
other abilities execute after drawing, as in the legacy scheduler. Tests compare
these complete tick results, including draw logs and subsequent turn scheduling.
The generic bot scheduler and unmigrated action/event effects still use JS.

Legacy quirks intentionally retained: persona 5's bot path does not reset the
removed card's tokens; persona 8 window eligibility checks the played-card owner
for human activity; persona 8 swapping preserves the deferred pending record.
These are not silently changed as part of migration. Fixtures cover response
expiry boundaries, targeting/ownership, discard bonuses, protected persona 33,
window creation, bot cancellation and cancellation of pending choices.

This batch adds 220 deterministic legacy comparisons: 51 coalition, 57 hand and
112 response/bot/cancellation scenarios. The persona 45 empty-hand correction is
the explicitly asserted exception to legacy equality.

Validation for this batch: `mvn -o clean verify` (34 JUnit tests),
`node --test scripts/check-http.test.mjs` (8 tests), frontend `npm run check`,
and both Playwright scenarios passed locally with the packaged Java backend.
The browser scenarios create/join/start/restore a game and verify that a failed
create request keeps the welcome page usable. These are local results, not a
claim about a production deployment or a GitHub Actions run.
