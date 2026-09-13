
const INVALID_MOVE = "__INVALID_MOVE__";
const INVALID_MOVE2 = INVALID_MOVE;
function deepClone(v){ return v == null ? v : JSON.parse(JSON.stringify(v)); }
function makeEvents(state){
  const queue = state.__eventQueue || (state.__eventQueue = []);
  return {
    _queue: queue,
    endTurn(payload){ queue.push({ type:'endTurn', payload: payload || null }); },
    setPhase(phase){ queue.push({ type:'setPhase', payload: phase }); },
    endGame(payload){ state.ctx.gameover = payload || true; state.G.gameOver = payload || true; }
  };
}
function applyMove(state, playerID, moveName, args){
  if (!state || !state.G || !state.ctx) throw new Error('bad_state');
  if (state.ctx.gameover || state.G?.gameOver) return { ok:false, error:'gameover', state };
  const fn = PolitikumGame?.moves?.[moveName];
  if (typeof fn !== 'function') return { ok:false, error:'unknown_move', state };
  const working = deepClone(state);
  working.__eventQueue = [];
  const events = makeEvents(working);
  let result;
  try {
    result = fn({ G: working.G, ctx: working.ctx, playerID: String(playerID), events }, ...(Array.isArray(args) ? args : []));
  } catch (e) {
    return { ok:false, error:'move_exception', message: String((e && e.message) || e), state };
  }
  if (result === INVALID_MOVE || result === INVALID_MOVE2) {
    return { ok:false, error:'invalid_move', state };
  }
  flushEvents(working);
  working._stateID = Number(state._stateID || 0) + 1;
  delete working.__eventQueue;
  return { ok:true, state: working };
}
// Shared data loaded by Java from engine/cards.json. No JS card normalization.
var POLITIKUM_CARDS_LIST = JSON.parse(globalThis.__politikumCatalogJson);
delete globalThis.__politikumCatalogJson;
var POLITIKUM_CARDS = Object.fromEntries(
  POLITIKUM_CARDS_LIST.map((c) => [c.id, c])
);
function getPolitikumCardDef(id) {
  return POLITIKUM_CARDS[id] || null;
}

// src/politikum/abilities.ts
function baseId(instId) {
  return String(instId || "").split("#")[0];
}
// Temporary transport to native Java rules; preserve all live JS card references.
function scoringGame(G) {
  return { turnN: G.turnN, players: (G.players || []).map(p => ({ id: p.id, coalition: p.coalition || [] })) };
}
function nativeScoring(operation, request) {
  return JSON.parse(__politikumNativeScoring(operation, JSON.stringify(request)));
}
function applyScoringPlayers(G, result) {
  for (let p = 0; p < result.players.length; p++) {
    const coalition = G.players[p].coalition || [];
    for (let c = 0; c < result.players[p].length; c++) Object.assign(coalition[c], result.players[p][c]);
  }
}
function applyTokenDelta(card, delta) {
  Object.assign(card, nativeScoring("simpleTokens", { card, delta }).card);
}
function ruYou(name) {
  const n = String(name || "");
  if (n === "You") return "\u0412\u044B";
  return n;
}
function eventTitleByBaseId(bid) {
  switch (String(bid || "")) {
    case "event_1":
      return "\u042D\u041A\u041E\u041A\u0420\u0415\u0414\u0418\u0422\u042B";
    case "event_2":
      return "\u0421\u043B\u0430\u0434\u043A\u0438\u0439 \u041F\u043E\u0434\u0430\u0440\u043E\u043A";
    case "event_3":
      return "\u0413\u0440\u0430\u043D\u0442 \u0413\u043E\u0441\u0434\u0435\u043F\u0430";
    case "event_10":
      return "\u041F\u0435\u0440\u0435\u0432\u043E\u0434 \u0432 \u043A\u0440\u0438\u043F\u0442\u043E\u043A\u043E\u043B\u043E\u043D\u0438\u044E";
    case "event_12a":
      return "\u041D\u0430\u0431\u0435\u0433 \u0435\u0434\u0438\u043D\u043E\u0440\u043E\u0433\u043E\u0432";
    case "event_12b":
      return "\u0421\u0440\u0430\u0447 \u0432 \u0442\u0432\u0438\u0442\u0442\u0435\u0440\u0435: \u0421\u0435\u043A\u0441 \u0441\u043A\u0430\u043D\u0434\u0430\u043B";
    case "event_12c":
      return "\u0421\u0440\u0430\u0447 \u0432 \u0442\u0432\u0438\u0442\u0442\u0435\u0440\u0435 - \u0440\u0443\u0441\u0441\u043A\u0438\u0439 \u0444\u043B\u0430\u0433";
    case "event_16":
      return "\u041F\u043E\u043B\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 [\u0420\u041E\u0421\u041A\u041E\u041C\u041D\u0410\u0414\u0417\u041E\u0420]";
    default:
      return "";
  }
}
function eventTitle(card) {
  const bid = baseId(String(card?.id || ""));
  return String(card?.text || card?.name || eventTitleByBaseId(bid) || card?.id || "");
}
function drawNCards({ G, me, source, count }) {
  nativeAbility('eventDraw', G, me, null, { source: String(source || ''), count: Number(count || 0) });
}
var ABILITIES = {
  // Starter abilities
  draw_1: ({ G, me, card }) => {
    nativeAbility('draw_1', G, me, card);
  },
  // MVP placeholder: adjacency scoring handled at score-time later.
  adj_vp_plus1_if_neighbor_tag: ({ G, me, card }) => {
    G.log.push(`${ruYou(me.name)}: \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C TODO (\u0441\u043E\u0441\u0435\u0434\u0441\u0442\u0432\u043E): ${card.id}`);
  },
  // Passive guard: if a persona is marked blockedAbilities (action_7), skip its ability.
  // Callers (playPersona, events) may still invoke runAbility, but this hook ensures
  // blocked personas don't fire further effects in future extensions.
  steal_1_random_from_opponent: ({ G, me }) => {
    const opps = (G.players || []).filter((p) => p.id !== me.id);
    const target = opps.sort((a, b) => (b.hand?.length || 0) - (a.hand?.length || 0))[0];
    if (!target || !(target.hand || []).length) return;
    const idx = Math.floor(Math.random() * target.hand.length);
    const [stolen] = target.hand.splice(idx, 1);
    if (stolen) {
      me.hand.push(stolen);
      G.log.push(`${ruYou(me.name)} \u0443\u043A\u0440\u0430\u043B 1 \u043A\u0430\u0440\u0442\u0443 \u0443 ${target.name}.`);
    }
  },
  // Events
  place_tokens_plus_vp: ({ G, me, card }) => {
    nativeAbility('place_tokens_plus_vp', G, me, card);
  },
  // Personas
  on_enter_adjacent_bonus: ({ G, me, card }) => {
    nativeAbility("on_enter_adjacent_bonus", G, me, card);
  },
  persona_4_on_enter_twitter_penalty: ({ G, me, card }) => {
    nativeAbility("persona_4_on_enter_twitter_penalty", G, me, card);
  },
  persona_12_on_enter_adjacent_red_buff: ({ G, me, card }) => {
    nativeAbility("persona_12_on_enter_adjacent_red_buff", G, me, card);
  },
  persona_3_on_enter_choice: ({ G, me, card }) => {
    nativeAbility('persona_3_on_enter_choice', G, me, card);
  },
  persona_5_discard_liberal_steal_tokens: ({ G, me, card }) => {
    nativeAbility("persona_5_discard_liberal_steal_tokens", G, me, card);
  },
  persona_7_swap_two_in_coalition: ({ G, me, card }) => {
    nativeAbility("persona_7_swap_two_in_coalition", G, me, card);
  },
  persona_45_steal_from_opponent: ({ G, me, card }) => {
    nativeAbility("persona_45_steal_from_opponent", G, me, card);
  },
  // p35: no special abilities
  persona_35_no_ability: () => {
  },
  persona_21_on_enter_invert_tokens: ({ G, me, card }) => {
    nativeAbility('persona_21_on_enter_invert_tokens', G, me, card);
  },
  persona_22_global_enter_mods: () => {
  },
  persona_23_on_enter_self_inflict_draw: ({ G, me, card }) => {
    nativeAbility('persona_23_on_enter_self_inflict_draw', G, me, card);
  },
  persona_24_passive_dual_leftwing_scaler: () => {
  },
  persona_26_on_enter_purge_red_inherit_plus: ({ G, me, card }) => {
    nativeAbility('persona_26_on_enter_purge_red_inherit_plus', G, me, card);
  },
  persona_28_on_enter_steal_plus_tokens: ({ G, me, card }) => {
    nativeAbility('persona_28_on_enter_steal_plus_tokens', G, me, card);
  },
  persona_32_activate_bounce: ({ G, me, card }) => {
    nativeAbility('persona_32_activate_bounce', G, me, card);
  },
  persona_38_global_event_token_vacuum: () => {
  },
  persona_41_on_enter_buff_fbk: ({ G, me, card }) => {
    nativeAbility('persona_41_on_enter_buff_fbk', G, me, card);
  },
  persona_36_passive_ignore_action7: () => {
  },
  persona_37_on_enter_bribe_and_silence: ({ G, me, card }) => {
    nativeAbility('persona_37_on_enter_bribe_and_silence', G, me, card);
  },
  persona_16_on_enter_draw3_discard3: ({ G, me, card }) => {
    nativeAbility("persona_16_on_enter_draw3_discard3", G, me, card);
  },
  persona_33_on_enter_choose_faction: ({ G, me, card }) => {
    nativeAbility("persona_33_on_enter_choose_faction", G, me, card);
  },
  persona_34_on_enter_guess_topdeck: ({ G, me, card }) => {
    nativeAbility('persona_34_on_enter_guess_topdeck', G, me, card);
  },
  // persona_39 is activated via move during your turn (no on-enter pending)
  persona_43_on_enter_drain_rightwing: ({ G, me, card }) => {
    nativeAbility('persona_43_on_enter_drain_rightwing', G, me, card);
  },
  persona_6_on_action8_plus1: ({ G, me, card }) => {
    nativeAbility('persona_6_on_action8_plus1', G, me, card);
  },
  persona_30_on_enter_buff_liberals: ({ G, me, card }) => {
    nativeAbility('persona_30_on_enter_buff_liberals', G, me, card);
  },
  persona_17_on_enter_steal_persona: ({ G, me, card }) => {
    nativeAbility("persona_17_on_enter_steal_persona", G, me, card);
  },
  // persona_13 retaliation is implemented in politikum.ts (after action targeting is confirmed)
  persona_13_retaliate_on_targeted_action: () => {
  },
  persona_20_on_enter_take_from_discard: ({ G, me, card }) => {
    nativeAbility('persona_20_on_enter_take_from_discard', G, me, card);
  },
  event_draw_cards: ({ G, me, card }) => {
    nativeAbility('event_draw_cards', G, me, card);
  },
  event_faction_minus1_draw1: ({ G, me, card }) => {
    nativeAbility('event_faction_minus1_draw1', G, me, card);
  },
  event_12b_discard_others_hand: ({ G, me, card }) => {
    nativeAbility('event_12b_discard_others_hand', G, me, card);
  },
  event_shuffle_all_hands_redeal: ({ G, me, card }) => {
    nativeAbility('event_shuffle_all_hands_redeal', G, me, card);
  },
  event_16_discard_self_persona_then_draw1: ({ G, me, card }) => {
    nativeAbility('event_16_discard_self_persona_then_draw1', G, me, card);
  },
  discard_one_persona_from_any_coalition: ({ G, me, card }) => {
    nativeAbility('discard_one_persona_from_any_coalition', G, me, card);
  }
};
function runAbility(key, ctx) {
  if (!key) return;
  if (ctx.card?.blockedAbilities) {
    ctx.G.log.push(`${ruYou(ctx.me.name)}: \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u0430 (${key}, ${ctx.card.id}).`);
    return;
  }
  const fn = ABILITIES[key];
  if (!fn) {
    ctx.G.log.push(`${ruYou(ctx.me.name)}: \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C TODO (${key}, ${ctx.card.id})`);
    return;
  }
  fn(ctx);
}

// src/politikum.ts
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function baseId2(instId) {
  return String(instId || "").split("#")[0];
}
function scorePlayer(pp) {
  return nativeScoring("score", { player: { coalition: pp.coalition || [] } });
}
function recalcPassives(G) {
  applyScoringPlayers(G, nativeScoring("recalculate", { G: scoringGame(G) }));
}
function applyTokenDelta2(G, card, delta, _fromP15Mirror = false) {
  const result = nativeScoring("tokens", { G: scoringGame(G), card, delta, mirrored: _fromP15Mirror });
  applyScoringPlayers(G, result);
  Object.assign(card, result.card);
}
function persona44OnPersonaDiscarded(G) {
  applyScoringPlayers(G, nativeScoring("personaDiscarded", { G: scoringGame(G) }));
}
function ruYou2(name) {
  const n = String(name || "");
  if (n === "You") return "\u0412\u044B";
  return n;
}
function ruDrewVerb(name) {
  const who = ruYou2(name);
  if (who === "\u0412\u044B") return "\u0432\u044B\u0442\u044F\u043D\u0443\u043B";
  const n = String(name || "");
  if (/[ая]$/u.test(n)) return "\u0432\u044B\u0442\u044F\u043D\u0443\u043B\u0430";
  return "\u0432\u044B\u0442\u044F\u043D\u0443\u043B";
}
function eventTitleByBaseId2(bid) {
  switch (String(bid || "")) {
    case "event_1":
      return "\u042D\u043A\u043E\u043A\u0440\u0435\u0434\u0438\u0442\u044B";
    case "event_2":
      return "\u0421\u043B\u0430\u0434\u043A\u0438\u0439 \u041F\u043E\u0434\u0430\u0440\u043E\u043A";
    case "event_3":
      return "\u0413\u0440\u0430\u043D\u0442 \u0413\u043E\u0441\u0434\u0435\u043F\u0430";
    case "event_10":
      return "\u041F\u0435\u0440\u0435\u0432\u043E\u0434 \u0432 \u041A\u0440\u0438\u043F\u0442\u043E\u043A\u043E\u043B\u043E\u043D\u0438\u044E";
    case "event_11":
      return "\u0422\u0430\u0439\u043D\u044B\u0439 \u0423\u0434\u0432\u043E\u0438\u0442\u0435\u043B\u044C";
    case "event_12a":
      return "\u041D\u0430\u0431\u0435\u0433 \u0435\u0434\u0438\u043D\u043E\u0440\u043E\u0433\u043E\u0432";
    case "event_12b":
      return "\u0421\u0440\u0430\u0447 \u0432 \u0442\u0432\u0438\u0442\u0442\u0435\u0440\u0435: \u0421\u0435\u043A\u0441 \u0441\u043A\u0430\u043D\u0434\u0430\u043B";
    case "event_12c":
      return "\u0421\u0440\u0430\u0447 \u0432 \u0442\u0432\u0438\u0442\u0442\u0435\u0440\u0435 - \u0440\u0443\u0441\u0441\u043A\u0438\u0439 \u0444\u043B\u0430\u0433";
    case "event_16":
      return "\u041F\u043E\u043B\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 [\u0420\u041E\u0421\u041A\u041E\u041C\u041D\u0410\u0414\u0417\u041E\u0420]";
    default:
      return "";
  }
}
function actionTitleByBaseId(bid) {
  switch (String(bid || "")) {
    case "action_4":
      return "\u0423\u043C\u0440\u0438 \u0442\u044B \u0441\u0435\u0433\u043E\u0434\u043D\u044F \u0430 \u044F \u0437\u0430\u0432\u0442\u0440\u0430";
    case "action_5":
      return "\u043A\u0443\u043B\u044C\u0442\u0443\u0440\u0430 \u043F\u043E\u043B\u0438\u0442\u0438\u043A\u0438 \u0432 \u0432\u043E\u0441\u0442\u043E\u0447\u043D\u043E\u0439 \u0435\u0432\u0440\u043E\u043F\u0435";
    case "action_9":
      return "\u0412\u044B\u0432\u043E\u0434 \u0432\u043E \u0432\u043D\u0435\u0448\u043D\u0438\u0439 \u043A\u043E\u043D\u0442\u0443\u0440";
    case "action_14":
      return "\u0412\u043E\u043B\u043E\u043D\u0442\u0451\u0440\u0441\u0442\u0432\u043E";
    case "action_8":
      return "\u0420\u0430\u0431\u043E\u0442\u0430 \u043D\u0430 \u041A\u0440\u0435\u043C\u043B\u044C";
    case "action_17":
      return "\u0410\u0441\u044F \u041D\u0435\u0441\u043E\u0435\u0432\u0430\u044F";
    default:
      return "";
  }
}
function personaTitleByBaseId(bid) {
  try {
    const c = POLITIKUM_CARDS?.[String(bid || "")];
    return String(c?.name || c?.text || bid || "");
  } catch {
    return String(bid || "");
  }
}
function eventTitle2(card) {
  const bid = baseId2(String(card?.id || ""));
  const raw = String(card?.text || card?.name || "").trim();
  if (!raw || /^event_\d+/u.test(raw) || raw === bid) return String(eventTitleByBaseId2(bid) || raw || card?.id || "");
  return raw || String(eventTitleByBaseId2(bid) || card?.id || "");
}
function actionTitle(card) {
  const bid = baseId2(String(card?.id || ""));
  const mapped = actionTitleByBaseId(bid);
  const raw = String(card?.text || card?.name || "").trim();
  if (mapped && (!raw || /^action_\d+/u.test(raw) || raw === bid)) return mapped;
  return raw || mapped || String(card?.id || "");
}
function cardTitle(x) {
  const id = typeof x === "string" ? x : String(x?.id || "");
  const bid = baseId2(id);
  if (/^event_\d+/u.test(bid) || /^event_\d+[a-z]/u.test(bid)) return eventTitleByBaseId2(bid) || bid;
  if (/^action_\d+/u.test(bid)) return actionTitleByBaseId(bid) || bid;
  if (/^persona_\d+/u.test(bid)) return personaTitleByBaseId(bid) || bid;
  return bid || id || "";
}
function persona38OnEventPlayed(G, eventCard) {
  nativeAbility('vacuum38', G, null, eventCard);
}
var nowMs = () => Date.now();
var MAX_COALITION = 7;
function actorWithPersona(me, personaBase) {
  const p = (me?.coalition || []).find((c) => baseId2(String(c.id)) === String(personaBase));
  const pname = String(p?.name || p?.text || personaBase);
  return `${ruYou2(me?.name)} ${pname}`;
}
function nativeAbility(operation, G, me = null, card = null, ctx = null, actor = '', target = '') {
  return __politikumNativeAbility(operation, G, me, card, ctx, String(actor), String(target || ''));
}
function applyAdjacencyBonusesAround(G, owner, placedCard) {
  nativeAbility('around', G, owner, placedCard);
}
function tracePush(G, entry) {
  try {
    const arr = Array.isArray(G.trace) ? G.trace : [];
    arr.push(entry);
    const CAP = 300;
    if (arr.length > CAP) arr.splice(0, arr.length - CAP);
    G.trace = arr;
  } catch {
  }
}
function argSummary(args) {
  try {
    const s = JSON.stringify(args ?? []);
    if (s.length <= 180) return s;
    return s.slice(0, 180) + "\u2026";
  } catch {
    try {
      return String(args ?? "");
    } catch {
      return "";
    }
  }
}
function rejectMove(G, ctx, move, reason, extra) {
  try {
    G.debugLastMoveReject = {
      move: String(move || ''),
      reason: String(reason || 'invalid'),
      extra: extra == null ? null : String(extra),
      turn: Number(ctx?.turn || 0),
      phase: String(ctx?.phase || ''),
      currentPlayer: String(ctx?.currentPlayer || ''),
      pending: String(G?.pending?.kind || ''),
      response: String(G?.response?.kind || ''),
      at: Date.now()
    };
  } catch {
  }
  try {
    const suffix = extra == null || extra === '' ? '' : ` (${String(extra)})`;
    console.error(`ERROR: invalid move: ${String(move || 'move')} reason=${String(reason || 'invalid')}${suffix}`);
  } catch {
  }
  return INVALID_MOVE2;
}

function wrapMoves(moves) {
  const out = {};
  for (const [name, fn] of Object.entries(moves || {})) {
    if (typeof fn !== "function") {
      out[name] = fn;
      continue;
    }
    out[name] = (arg0, ...rest) => {
      const G = arg0?.G;
      const ctx = arg0?.ctx;
      const playerID = arg0?.playerID;
      const beforePend = String(G?.pending?.kind || "");
      const beforeResp = String(G?.response?.kind || "");
      let res;
      try {
        res = fn(arg0, ...rest);
        return res;
      } finally {
        try {
          tracePush(G, {
            ts: Date.now(),
            turn: Number(ctx?.turn ?? 0),
            phase: String(ctx?.phase ?? ""),
            currentPlayer: String(ctx?.currentPlayer ?? ""),
            playerID: String(playerID ?? ""),
            move: String(name),
            args: argSummary(rest),
            result: res === void 0 ? "ok" : String(res),
            pending: beforePend,
            response: beforeResp
          });
        } catch {
        }
      }
    };
  }
  return out;
}
var PolitikumGame = {
  name: "politikum",
  moves: wrapMoves({
    ...NATIVE_TURN_MOVES,
    applyPendingToken: ({ G, ctx, playerID }, ...args) => {
      return nativeAbility('applyPendingToken', G, null, args, ctx, playerID, args[0]) ? undefined : INVALID_MOVE2;
    },
    discardPersonaFromCoalition: ({ G, ctx, playerID }, ...args) => {
      return nativeAbility('discardPersonaFromCoalition', G, null, args, ctx, playerID, args[0]) ? undefined : INVALID_MOVE2;
    },
    persona3Skip: ({ G, ctx, playerID, events }, ...args) => {
      if (!nativeAbility('skip3', G, null, args, ctx, playerID)) return INVALID_MOVE2;
      maybeTriggerRoundEnd(G, ctx);
      if (maybeEndAfterRound(G, ctx, events)) return;
      events.endTurn?.();
    },
    persona3ChooseOption: ({ G, ctx, playerID, events }, ...args) => {
      if (!nativeAbility('choose3', G, null, args, ctx, playerID)) return INVALID_MOVE2;
      maybeTriggerRoundEnd(G, ctx);
      if (maybeEndAfterRound(G, ctx, events)) return;
      events.endTurn?.();
    },
    persona12ChooseAdjacentRed: ({ G, ctx, playerID }, targetCoalitionCardId) => {
      return nativeAbility('chooseRed', G, null, null, ctx, playerID, targetCoalitionCardId) ? undefined : INVALID_MOVE2;
    },
    persona5PickLiberal: ({ G, ctx, playerID, events }, ...args) => {
      if (!nativeAbility("pickLiberal", G, null, args, ctx, playerID)) return INVALID_MOVE2;
      maybeTriggerRoundEnd(G, ctx);
      if (maybeEndAfterRound(G, ctx, events)) return;
      events.endTurn?.();
    },
    discardFromHandForEvent12b: ({ G, playerID }, cardId) => {
      return nativeAbility('eventDiscardHand', G, null, null, null, playerID, cardId) ? undefined : INVALID_MOVE2;
    },
    discardPersonaFromOwnCoalitionForEvent16: ({ G, playerID }, cardId) => {
      return nativeAbility('eventDiscardCoalition', G, null, null, null, playerID, cardId) ? undefined : INVALID_MOVE2;
    },
    // Persona 7: on-enter, swap two personas within a chosen coalition.
    // Robustness: some clients accidentally send the wrong ownerId (mobile/old UI path).
    // If ownerId doesn't match, infer the owner by locating BOTH persona instance ids in the same coalition.
    persona7SwapTwoInCoalition: ({ G, ctx, playerID, events }, ...args) => {
      if (!nativeAbility("swapCoalition", G, null, args, ctx, playerID)) return INVALID_MOVE2;
    },
    // Persona 8: swap Lazerson (p8) with the just-played persona (during cancel_persona response window)
    persona8SwapWithPlayedPersona: ({ G, playerID }) => {
      return nativeAbility("swapResponse", G, null, null, null, playerID) ? undefined : INVALID_MOVE2;
    },
    // Persona 10 (Naki): discard persona_10 from YOUR COALITION to cancel an effect targeting your coalition
    persona10CancelFromHand: ({ G, playerID }) => {
      return nativeAbility("cancel10", G, null, null, null, playerID) ? undefined : INVALID_MOVE2;
    },
    persona10CancelFromCoalition: ({ G, playerID }) => {
      return nativeAbility("cancel10", G, null, null, null, playerID) ? undefined : INVALID_MOVE2;
    },
    // Persona 45: on-enter, choose opponent then steal 1 facedown card from their hand.
    persona21InvertTokens: ({ G, playerID }, ownerId, coalitionCardId) => {
      return nativeAbility('invertTokens', G, null, null, { ownerId: String(ownerId) }, playerID, coalitionCardId) ? undefined : INVALID_MOVE2;
    },
    persona23ChooseSelfInflict: ({ G, ctx, playerID, events }, ...args) => {
      if (!nativeAbility('choose23', G, null, args, { amount: Number(args[0] || 0) }, playerID)) return INVALID_MOVE2;
    },
    persona26PurgeRedNationalist: ({ G, playerID }, ownerId, coalitionCardId) => {
      return nativeAbility('purgeRed', G, null, null, { ownerId: String(ownerId) }, playerID, coalitionCardId) ? undefined : INVALID_MOVE2;
    },
    persona28StealPlusTokens: ({ G, playerID }, ownerId, coalitionCardId, n) => {
      return nativeAbility('stealPlus', G, null, null, { ownerId: String(ownerId), amount: Number(n ?? 3) }, playerID, coalitionCardId) ? undefined : INVALID_MOVE2;
    },
    // Persona 11 (Solovei): optional at start of turn
    persona11Skip: ({ G, ctx, playerID, events }, ...args) => {
      if (!nativeAbility("skipSolovei", G, null, args, ctx, playerID)) return INVALID_MOVE2;
    },
    persona11Use: ({ G, ctx, playerID, events }, ...args) => {
      if (!nativeAbility("useSolovei", G, null, args, ctx, playerID)) return INVALID_MOVE2;
    },
    persona11DiscardOpponentPersona: ({ G, ctx, playerID, events }, ...args) => {
      if (!nativeAbility("discardSolovei", G, null, args, ctx, playerID)) return INVALID_MOVE2;
    },
    // Persona 17 (Arno): choose opponent, reveal hand, steal a persona into your hand.
    persona17PickOpponent: ({ G, ctx, playerID, events }, ...args) => {
      return nativeAbility("pick17", G, events?._queue || [], args, ctx, playerID) ? undefined : INVALID_MOVE2;
    },
    persona17StealPersonaFromHand: ({ G, ctx, playerID, events }, ...args) => {
      return nativeAbility("steal17", G, events?._queue || [], args, ctx, playerID) ? undefined : INVALID_MOVE2;
    },
    // Persona 32: return a chosen persona from your coalition to your hand.
    persona32BounceToHand: ({ G, playerID }, coalitionCardId) => {
      return nativeAbility('bounceToHand', G, null, null, null, playerID, coalitionCardId) ? undefined : INVALID_MOVE2;
    },
    // Generic cancel for selected pendings (stability)
    cancelPending: ({ G, ctx, playerID }) => {
      return nativeAbility('cancelPending', G, null, null, ctx, playerID) ? undefined : INVALID_MOVE2;
    },
    // Persona 32: cancel (do nothing)
    persona32CancelBounce: ({ G, playerID }) => {
      return nativeAbility('cancelBounce', G, null, null, null, playerID) ? undefined : INVALID_MOVE2;
    },
    persona37BribeAndSilence: ({ G, playerID }, ownerId, coalitionCardId) => {
      return nativeAbility('bribeAndSilence', G, null, null, { ownerId: String(ownerId) }, playerID, coalitionCardId) ? undefined : INVALID_MOVE2;
    },
    persona33ChooseFaction: ({ G, playerID }, factionTag) => {
      return nativeAbility('chooseFaction', G, null, null, null, playerID, factionTag) ? undefined : INVALID_MOVE2;
    },
    persona34GuessTopdeck: ({ G, ctx, playerID }, guessBaseId) => {
      return nativeAbility('guessTopdeck', G, null, null, ctx, playerID, guessBaseId) ? undefined : INVALID_MOVE2;
    },
    persona39ActivateRecycle: ({ G, ctx, playerID, events }, ...args) => {
      if (!nativeAbility('recycle39', G, null, args, ctx, playerID)) return INVALID_MOVE2;
    },
    persona45StealFromOpponent: ({ G, ctx, playerID, events }, ...args) => {
      return nativeAbility("steal45", G, events?._queue || [], args, ctx, playerID) ? undefined : INVALID_MOVE2;
    },
    // Action 7: pick any persona (any coalition); its abilities are blocked and all vpDelta tokens are cleared.
    blockPersonaForAction7: ({ G, playerID, ctx, events }, ownerId, coalitionCardId) => {
      return nativeAbility('action7', G, events?._queue || [], [String(ownerId)], ctx, playerID, coalitionCardId) ? undefined : INVALID_MOVE2;
    },
    // Action 13: shield one of YOUR personas – cannot be targeted; +1 gains reduced by 1.
    shieldPersonaForAction13: ({ G, playerID, ctx, events }, coalitionCardId) => {
      return nativeAbility('action13', G, events?._queue || [], [], ctx, playerID, coalitionCardId) ? undefined : INVALID_MOVE2;
    },
    // Action 17: attacker chooses an opponent persona to receive -1 tokens (normally 2, or 4 for special ids).
    applyAction17ToPersona: ({ G, playerID, ctx, events }, targetPersonaId) => {
      return nativeAbility('action17', G, events?._queue || [], [], ctx, playerID, targetPersonaId) ? undefined : INVALID_MOVE2;
    },
    // Action 18: return a persona from discard to your hand.
    pickPersonaFromDiscardForAction18: ({ G, playerID, ctx, events }, cardId) => {
      return nativeAbility('action18', G, events?._queue || [], [], ctx, playerID, cardId) ? undefined : INVALID_MOVE2;
    },
    discardBeforeDrawForHandLimit: ({ G, ctx, playerID }, cardId) => {
      const pend = G.pending;
      if (!pend) return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      if (String(ctx.currentPlayer) !== String(playerID)) return INVALID_MOVE2;

      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;

      const idx = (me.hand || []).findIndex((c) => String(c.id) === String(cardId));
      if (idx < 0) return INVALID_MOVE2;

      const [drop] = me.hand.splice(idx, 1);
      if (drop) {
        G.discard.push(drop);
        if (drop.type === "persona") persona44OnPersonaDiscarded(G);
      }

      if (pend.kind === "discard_down_to_7") {
        G.log.push(`${ruYou2(me.name)} сбросил ${drop?.name || drop?.id || "карту"}, чтобы в руке осталось не больше 7.`);
        if (Number((me.hand || []).length) <= 7) G.pending = null;
        recalcPassives(G);
        return;
      }

      if (pend.kind !== "hand_limit_discard_before_draw") return INVALID_MOVE2;

      pend.remaining = Number(pend.remaining || 0) - 1;
      G.log.push(`${ruYou2(me.name)} сбросил ${drop?.name || drop?.id || "карту"} перед добором.`);

      if (Number(pend.remaining || 0) > 0) {
        recalcPassives(G);
        return;
      }

      G.pending = null;

      const c = G.deck.shift();
      if (c) {
        if (c.type === "event") {
          nativeAbility('legacyDrawnEvent', G, me, c);
        } else {
          me.hand.push(c);
          G.log.push(`${me.name} берет карту`);
        }
      }

      G.hasDrawn = true;
      recalcPassives(G);
    },
    persona16Discard3FromHand: ({ G, ctx, playerID, events }, ...args) => {
      return nativeAbility("discard16", G, events?._queue || [], args, ctx, playerID) ? undefined : INVALID_MOVE2;
    },
    // Persona 20: picker from discard (any card type)
    persona20PickFromDiscard: ({ G, playerID }, cardId) => {
      return nativeAbility('recoverDiscard', G, null, null, null, playerID, cardId) ? undefined : INVALID_MOVE2;
    },
    tickBot: ({ G, ctx, events }) => {
      try {
        if (String(ctx.phase || "") !== "action") return INVALID_MOVE2;
        expireResponseAndResolveDeferred(G);
        const rr = G.response;
        if (rr && Number(G.botPauseUntilMs || 0) > Number(rr.expiresAtMs || 0)) {
          G.botPauseUntilMs = Number(rr.expiresAtMs || 0);
        }
        if (rr) {
          const haveHumanResponders = (G.players || []).some((pp) => {
            if (!pp?.active) return false;
            if (String(pp.id) === String(rr.playedBy)) return false;
            const isBot2 = !!pp?.isBot || String(pp?.name || "").startsWith("[B]");
            return !isBot2;
          });
          if (responseExpired(G)) {
            G.response = null;
            G.botPauseUntilMs = 0;
          } else if (!haveHumanResponders) {
            G.response = null;
            G.botPauseUntilMs = 0;
            if (String(G.pending?.kind || "") === "resolve_persona_after_response") {
              try { expireResponseAndResolveDeferred(G); } catch {}
            }
          }
        }
        const p = (G.players || []).find((pp) => String(pp.id) === String(ctx.currentPlayer));
        const isBot = !!p?.isBot || String(p?.name || "").startsWith("[B]");
        if (!p || !isBot) return INVALID_MOVE2;
        try {
          const started = Number(G.turnStartedAtMs || 0);
          if (started && nowMs() - started > 2e4) {
            try {
              G.pending = null;
            } catch {
            }
            try {
              G.response = null;
            } catch {
            }
            try {
              G.botPauseUntilMs = 0;
            } catch {
            }
            try {
              G.hasDrawn = true;
            } catch {
            }
            try {
              G.hasPlayed = true;
            } catch {
            }
            try {
              G.log.push(`${ruYou2(p.name)} turn auto-skipped (20s hard cap).`);
            } catch {
            }
            if (maybeEndAfterRound(G, ctx, events)) return;
            events.endTurn?.();
            return;
          }
        } catch {
        }
        const pause = Number(G.botPauseUntilMs || 0);
        if (pause && nowMs() < pause) return;
        const t = Number(G.botNextActAtMs || 0);
        if (t && nowMs() < t) return;
        if (G.response && !responseExpired(G)) {
          G.botNextActAtMs = nowMs() + 250;
          return;
        }
        if (nativeAbility("botEarlyChoice", G, p, events?._queue || [], ctx, String(p.id))) return;
        const pend0 = G.pending;



        if (pend0 && pend0.kind === "hand_limit_discard_before_draw" && String(pend0.playerId) === String(p.id)) {
          const hand = Array.isArray(p.hand) ? p.hand : [];
          const toDiscard = Math.max(0, Number(pend0.remaining || 0));
          for (let i = 0; i < toDiscard; i++) {
            const card = hand.shift();
            if (card) {
              G.discard.push(card);
              if (card.type === "persona") persona44OnPersonaDiscarded(G);
            }
          }
          G.log.push(`${ruYou2(p.name)} сбрасывает ${toDiscard} карт перед добором, чтобы после взятия в руке было не больше 7.`);
          G.pending = null;
          const c = G.deck.shift();
          if (c) {
            if (c.type === "event") {
              nativeAbility('legacyDrawnEvent', G, p, c);
            } else {
              p.hand.push(c);
              G.log.push(`${p.name} берет карту`);
            }
          }
          G.hasDrawn = true;
          recalcPassives(G);
          G.botNextActAtMs = nowMs() + 600;
          return;
        }
        if (pend0 && pend0.kind === "place_tokens_plus_vp" && String(pend0.playerId) === String(p.id)) {
          const coal = (p.coalition || []).filter((x) => x && x.type === "persona");
          if (!coal.length) {
            try {
              const src = String(pend0.sourceCardId || "");
              const title = eventTitle2({ id: src });
              G.log.push(`${ruYou2(p.name)} \u0421\u043E\u0431\u044B\u0442\u0438\u0435 - ${title}: \u043D\u0435\u043A\u0443\u0434\u0430 \u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0436\u0435\u0442\u043E\u043D\u044B (\u043F\u0440\u043E\u043F\u0443\u0441\u043A).`);
            } catch {
              G.log.push(`${ruYou2(p.name)}: \u043D\u0435\u043A\u0443\u0434\u0430 \u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0436\u0435\u0442\u043E\u043D\u044B (\u0430\u0432\u0442\u043E\u0441\u043A\u0438\u043F).`);
            }
            G.pending = null;
            recalcPassives(G);
            return;
          }
          while (Number(pend0.remaining || 0) > 0) {
            const target = coal[0];
            let dv = Number(pend0.delta || 1);
            if (target.shielded && dv > 0) dv = Math.max(0, dv - 1);
            if (dv) applyTokenDelta2(G, target, dv);
            pend0.remaining = Number(pend0.remaining || 0) - 1;
          }
          G.pending = null;
          recalcPassives(G);
          G.botNextActAtMs = nowMs() + 900;
          return;
        }
        if (maybeResolveDeferredPersona(G)) {
          G.botNextActAtMs = nowMs() + 600;
          return;
        }
        if (!G.hasDrawn) {
          const currentHandCount = Array.isArray(p?.hand) ? p.hand.length : 0;
          const needPreDrawDiscard = Math.max(0, currentHandCount - 6);
          if (needPreDrawDiscard > 0) {
            G.pending = {
              kind: "hand_limit_discard_before_draw",
              playerId: String(p.id),
              remaining: needPreDrawDiscard,
            };
            G.botNextActAtMs = nowMs() + 250;
            return;
          }
          const c = G.deck.shift();
          if (c) {
            if (c.type === "event") {
              nativeAbility('legacyDrawnEvent', G, p, c);
            } else {
              p.hand.push(c);
              G.log.push(`${p.name} \u0431\u0435\u0440\u0435\u0442 \u043A\u0430\u0440\u0442\u0443`);
            }
          }
          G.hasDrawn = true;
        }
        const pend = G.pending;
        if (G.response && !responseExpired(G)) {
          const ownerId = String(pend?.playerId ?? pend?.attackerId ?? "");
          if (ownerId !== String(p.id)) return;
        }
        if (nativeAbility("botMigratedChoice", G, p, events?._queue || [], ctx, String(p.id))) return;
        if (nativeAbility("botRemainingPersona", G, p, null, ctx, String(p.id))) return;
        if (pend) {
          if (pend.kind === "place_tokens_plus_vp" && String(pend.playerId) === String(p.id)) {
            const myCoal = (p.coalition || []).filter((c) => c && c.type === "persona");
            const scoreTarget = (c) => {
              const tags = Array.isArray(c?.tags) ? c.tags : [];
              const immovable = tags.includes("persona:immovable");
              const shielded = !!c?.shielded;
              const tok = Number(c?.vpDelta || 0);
              const nonNegative = tok >= 0;
              return [shielded ? 1 : 0, immovable ? 1 : 0, nonNegative ? 1 : 0, tok];
            };
            const target = myCoal.sort((a, b) => {
              const as = scoreTarget(a);
              const bs = scoreTarget(b);
              for (let i = 0; i < as.length; i++) if (as[i] !== bs[i]) return bs[i] - as[i];
              return 0;
            })[0];
            if (target) {
              let delta = Number(pend.delta || 1);
              if (target.shielded && delta > 0) delta = Math.max(0, delta - 1);
              if (delta) {
                applyTokenDelta2(G, target, delta);
                recalcPassives(G);
              }
              const srcBid = String(pend.sourceCardId || "").split("#")[0];
              if (Number(pend.remaining || 0) === 4 && srcBid === "event_10") {
                G.log.push(`${ruYou2(p.name)} \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u043B \u0447\u0435\u0442\u044B\u0440\u0435 +1 \u0442\u043E\u043A\u0435\u043D\u0430 \u043D\u0430 ${target.name || target.id}.`);
              }
              pend.remaining = Number(pend.remaining || 0) - 1;
              if (Number(pend.remaining || 0) <= 0) G.pending = null;
            } else {
              G.pending = null;
            }
            G.botNextActAtMs = nowMs() + 600;
            return;
          }


          if (pend.kind === "persona_20_pick_from_discard" && String(pend.playerId) === String(p.id)) {
            try {
              const idx = (G.discard || []).findIndex((c) => c && c.type === "action");
              if (idx >= 0) {
                const [c] = G.discard.splice(idx, 1);
                if (c) {
                  p.hand.push(c);
                  const actionName = actionTitle(c);
                  G.log.push(`${p.name} \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u044F \u0411\u044B\u043A\u043E\u0432\u0430 \u0432\u0437\u044F\u043B ${actionName} \u0438\u0437 \u0441\u0431\u0440\u043E\u0441\u0430.`);
                }
              }
            } catch {
            }
            G.pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 400;
            return;
          }
          if (pend.kind === "persona_21_pick_target_invert" && String(pend.playerId) === String(p.id)) {
            try {
              let owner = null;
              let card = null;
              for (const pp of G.players || []) {
                for (const cc of pp.coalition || []) {
                  if (!cc || cc.type !== "persona") continue;
                  if (baseId2(String(cc.id)) === "persona_31") continue;
                  if (cc.shielded) continue;
                  owner = pp;
                  card = cc;
                  break;
                }
                if (card) break;
              }
              if (owner && card) {
                const before = Number(card.vpDelta || 0);
                const prevPlus = Number(card.plusTokens ?? Math.max(0, before));
                const prevMinus = Number(card.minusTokens ?? Math.max(0, -before));
                card.plusTokens = prevMinus;
                card.minusTokens = prevPlus;
                card.vpDelta = -before;
                recalcPassives(G);
                G.log.push(`${ruYou2(p.name)} (${pend.sourceCardId}) \u043F\u0435\u0440\u0435\u0432\u0435\u0440\u043D\u0443\u043B \u0436\u0435\u0442\u043E\u043D\u044B \u043D\u0430 ${card.name || card.id} (${before} \u2192 ${card.vpDelta}).`);
              }
            } catch {
            }
            G.pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 400;
            return;
          }

          if (pend.kind === "persona_28_pick_non_fbk" && String(pend.playerId) === String(p.id)) {
            try {
              const self = (p.coalition || []).find((c) => baseId2(String(c.id)) === "persona_28");
              if (self) {
                let target = null;
                for (const owner of G.players || []) {
                  for (const cc of owner.coalition || []) {
                    if (!cc || cc.type !== "persona") continue;
                    if (baseId2(String(cc.id)) === "persona_31") continue;
                    if (cc.shielded) continue;
                    if (Array.isArray(cc.tags) && cc.tags.includes("faction:fbk")) continue;
                    target = cc;
                    break;
                  }
                  if (target) break;
                }
                if (target) {
                  const want = 3;
                  const avail = Math.max(0, Number(target.vpDelta || 0));
                  const take = Math.min(want, avail);
                  if (take) {
                    applyTokenDelta2(G, target, -take);
                    applyTokenDelta2(G, self, take);
                  }
                  recalcPassives(G);
                  G.log.push(`${actorWithPersona(p, "persona_28")} \u0443\u043A\u0440\u0430\u043B ${take} \xD7 +1 \u0443 ${target.name || target.id}.`);
                }
              }
            } catch {
            }
            G.pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 400;
            return;
          }
          if (pend.kind === "persona_33_choose_faction" && String(pend.playerId) === String(p.id)) {
            try {
              const KNOWN = ["faction:liberal", "faction:rightwing", "faction:leftwing", "faction:fbk", "faction:red_nationalist", "faction:system", "faction:neutral"];
              const counts = {};
              for (const cc of p.coalition || []) {
                if (!cc || cc.type !== "persona") continue;
                const tags = Array.isArray(cc.tags) ? cc.tags : [];
                const ft = tags.find((t2) => typeof t2 === "string" && t2.startsWith("faction:"));
                if (ft && KNOWN.includes(ft)) counts[ft] = (counts[ft] || 0) + 1;
              }
              let tag = "faction:liberal";
              let best = -1;
              for (const k of Object.keys(counts)) {
                const v = counts[k] || 0;
                if (v > best) {
                  best = v;
                  tag = k;
                }
              }
              const self = (p.coalition || []).find((c) => baseId2(String(c.id)) === "persona_33");
              if (self) {
                self.chosenFactionTag = tag;
                G.log.push(`${actorWithPersona(p, "persona_33")} \u0432\u044B\u0431\u0440\u0430\u043B \u0444\u0440\u0430\u043A\u0446\u0438\u044E ${tag}.`);
              }
            } catch {
            }
            G.pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 250;
            return;
          }
          if (pend.kind === "persona_34_guess_topdeck" && String(pend.playerId) === String(p.id)) {
            G.pending = null;
            G.botNextActAtMs = nowMs() + 250;
            return;
          }
          if (pend.kind === "persona_13_pick_target" && String(pend.playerId) === String(p.id)) {
            try {
              const attacker = (G.players || []).find((pp) => String(pp.id) === String(pend.attackerId));
              const target = (attacker?.coalition || []).find((c) => c && c.type === "persona" && baseId2(String(c.id)) !== "persona_31" && !c.shielded);
              if (target) {
                applyTokenDelta2(G, target, -1);
                recalcPassives(G);
                G.log.push(`${ruYou2(p.name)} (\u0412\u0435\u043D\u0435\u0434\u0438\u0442\u043A\u043E\u0432): \u0434\u0430\u043B -1 \u043D\u0430 ${target.name || target.id}.`);
              }
            } catch {
            }
            G.pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 250;
            return;
          }
          if (nativeAbility('botActionChoice', G, p)) return;
          if (pend.kind === "persona_26_pick_red_nationalist" && String(pend.playerId) === String(p.id)) {
            try {
              const self = (p.coalition || []).find((c) => baseId2(String(c.id)) === "persona_26");
              let picked = false;
              for (const owner of G.players || []) {
                const j = (owner.coalition || []).findIndex((c) => c.type === "persona" && baseId2(String(c.id)) !== "persona_31" && !c.shielded && Array.isArray(c.tags) && c.tags.includes("faction:red_nationalist"));
                if (j < 0) continue;
                const target = owner.coalition[j];
                const plus = Math.max(0, Number(target?.vpDelta || 0));
                owner.coalition.splice(j, 1);
                G.discard.push(target);
                if (target.type === "persona") persona44OnPersonaDiscarded(G);
                if (plus && self) applyTokenDelta2(G, self, plus);
                G.log.push(`${actorWithPersona(p, "persona_26")} \u0441\u0431\u0440\u043E\u0441\u0438\u043B ${target?.name || target?.id} \u0438 \u0443\u043D\u0430\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043B ${plus} \xD7 +1.`);
                picked = true;
                break;
              }
              if (!picked) {
                G.log.push(`${ruYou2(p.name)} (${pend.sourceCardId}): \u043D\u0435\u0442 \u043A\u0440\u0430\u0441\u043D.\u043D\u0430\u0446. \u0434\u043B\u044F \u0441\u0431\u0440\u043E\u0441\u0430.`);
              }
            } catch {
            }
            G.pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 400;
            return;
          }

          if (pend.kind === "persona_37_pick_opponent_persona" && String(pend.playerId) === String(p.id)) {
            try {
              const PASSIVE = /* @__PURE__ */ new Set([
                "persona_2",
                "persona_4",
                "persona_6",
                "persona_15",
                "persona_18",
                "persona_22",
                "persona_24",
                "persona_25",
                "persona_27",
                "persona_29",
                "persona_38",
                "persona_43",
                "persona_44"
              ]);
              let best = null;
              let bestOwner = null;
              let bestScore = -1;
              for (const owner of G.players || []) {
                if (String(owner.id) === String(p.id)) continue;
                for (const c of owner.coalition || []) {
                  if (!c || c.type !== "persona") continue;
                  if (baseId2(String(c.id)) === "persona_31") continue;
                  if (c.shielded) continue;
                  const bid = baseId2(String(c.id));
                  const hasAbility = !!c.abilityKey;
                  const isPassive = PASSIVE.has(bid);
                  const sc = (hasAbility ? 3 : 0) + (isPassive ? 2 : 0) + Math.min(3, Math.max(0, Number(c.baseVp ?? 0)) / 2);
                  if (sc > bestScore) {
                    bestScore = sc;
                    best = c;
                    bestOwner = owner;
                  }
                }
              }
              if (best && bestOwner) {
                applyTokenDelta2(G, best, 2);
                best.blockedAbilities = true;
                recalcPassives(G);
                const self37 = (p.coalition || []).find((c) => baseId2(String(c.id)) === "persona_37");
                const selfName = String(self37?.name || self37?.text || "persona_37");
                G.log.push(`${ruYou2(p.name)} ${selfName} \u043F\u043E\u0434\u043A\u0443\u043F\u0438\u043B ${best.name || best.id} (+2) \u0438 \u043D\u0430\u0432\u0441\u0435\u0433\u0434\u0430 \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043B \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u0438.`);
              } else {
                G.log.push(`${actorWithPersona(p, "persona_37")}: \u043D\u0435\u0442 \u0446\u0435\u043B\u0438 \u0434\u043B\u044F \u043F\u043E\u0434\u043A\u0443\u043F\u0430.`);
              }
            } catch {
            }
            G.pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 400;
            return;
          }

          if (nativeAbility('botEventChoice', G, p)) return;
          if (String(pend.playerId || pend.attackerId || "") === String(p.id)) {
            G.pending = null;
            recalcPassives(G);
          }
        }
        if (!G.hasPlayed) {
          const TRIO = /* @__PURE__ */ new Set(["persona_1", "persona_19", "persona_42"]);
          const haveOnBoard = new Set((p.coalition || []).filter((x) => x?.type === "persona").map((x) => baseId2(String(x.id))));
          const idxP0 = (p.hand || []).findIndex((cc) => cc.type === "persona" && TRIO.has(baseId2(String(cc.id))) && (haveOnBoard.has("persona_1") || haveOnBoard.has("persona_19") || haveOnBoard.has("persona_42")));
          const idxP = idxP0 >= 0 ? idxP0 : (p.hand || []).findIndex((cc) => cc.type === "persona");
          if (idxP >= 0) {
            if (Number((p.coalition || []).length) >= MAX_COALITION) {
              const extra = drawTopCardForPlayer2(G, p);
              if (extra) G.drawsThisTurn = Number(G.drawsThisTurn || 0) + 1;
              G.hasPlayed = true;
              G.botNextActAtMs = nowMs() + 600;
              if (maybeEndAfterRound(G, ctx, events)) return;
              events.endTurn?.();
              return;
            }
            const plays = Number(G.playsThisTurn || 0);
            const maxPlays = Number(G.maxPlaysThisTurn || 1);
            if (plays >= maxPlays) {
              G.hasPlayed = true;
              return;
            }
            const c = p.hand[idxP];
            p.hand.splice(idxP, 1);
            p.coalition.push(c);
            const dv = Number(G.playVpDelta || 0);
            if (dv && !c._turnPlayVpDeltaApplied) {
              c._turnPlayVpDeltaApplied = true;
              applyTokenDelta2(G, c, dv);
            }
            G.playsThisTurn = plays + 1;
            G.hasPlayed = plays + 1 >= maxPlays;
            try {
              const cardName = String(c.name || c.text || c.id);
              const ruAcc = (s) => {
                if (/ин$/u.test(s)) return s + "\u0430";
                if (/ов$/u.test(s)) return s + "\u0430";
                if (/ев$/u.test(s)) return s + "\u0430";
                if (/ский$/u.test(s)) return s.replace(/ский$/u, "\u0441\u043A\u043E\u0433\u043E");
                return s;
              };
              if (c.type === "persona") {
                try {
                  if (baseId2(String(c.id)) === "persona_9") {
                    const target = (G.players || []).find((pp) => String(pp.id) !== String(p.id) && pp.active && Number((pp.coalition || []).length) < MAX_COALITION);
                    if (target) {
                      p.coalition.pop();
                      target.coalition.push(c);
                      G.log.push(`${p.name} \u0434\u043E\u0431\u0430\u0432\u0438\u043B ${ruAcc(cardName)} \u0432 \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u044E ${target.name}`);
                      return;
                    }
                  }
                } catch {
                }
                G.log.push(`${p.name} \u0434\u043E\u0431\u0430\u0432\u0438\u043B ${ruAcc(cardName)} \u0432 \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u044E`);
              } else {
                G.log.push(`${p.name} played ${c.name || c.id} to Coalition.`);
              }
            } catch {
              G.log.push(`${p.name} played ${c.name || c.id} to Coalition.`);
            }
            runAbility(c.abilityKey, { G, me: p, card: c });
            recalcPassives(G);
            nativeAbility('botPersonaResponse', G, p, c, ctx, String(p.id));
            G.botNextActAtMs = nowMs() + (G.pending ? 600 : 1100);
            if (G.pending) return;
            if (!G.hasPlayed) {
              G.botNextActAtMs = nowMs() + 650;
              return;
            }
            if (maybeEndAfterRound(G, ctx, events)) return;
            events.endTurn?.();
            return;
          } else {
            const idxA = (p.hand || []).findIndex((cc) => cc.type === "action");
            if (idxA >= 0) {
              const c = p.hand[idxA];
              p.hand.splice(idxA, 1);
              G.discard.push(c);
              G.lastAction = c;
              G.hasPlayed = true;
              nativeAbility('botActionPlay', G, p, c);
            } else {
              const extra = drawTopCardForPlayer2(G, p);
              if (extra) G.drawsThisTurn = Number(G.drawsThisTurn || 0) + 1;
              G.hasPlayed = true;
            }
          }
        }
        if (G.hasDrawn && G.hasPlayed) {
          if (!G.response && !G.pending) {
            if (maybeEndAfterRound(G, ctx, events)) return;
            events.endTurn?.();
            return;
          }
          if (maybeEndAfterRound(G, ctx, events)) return;
          events.endTurn?.();
        }
      } catch {
      }
    },
    playPersona: ({ G, playerID, ctx, events }, cardId, placeAfterId, side, targetPlayerId) => {
      expireResponseAndResolveDeferred(G);
      if (String(playerID) !== String(ctx.currentPlayer)) return rejectMove(G, ctx, "playPersona", "not_current_player", `${String(playerID)}!=${String(ctx.currentPlayer)}`);
      if (G.pending) return rejectMove(G, ctx, "playPersona", "pending_active", String(G.pending?.kind || ""));
      if (G.response && !responseExpired(G)) return rejectMove(G, ctx, "playPersona", "response_active", String(G.response?.kind || ""));
      if (!G.hasDrawn) return rejectMove(G, ctx, "playPersona", "need_draw_first");
      const plays = Number(G.playsThisTurn || 0);
      const maxPlays = Number(G.maxPlaysThisTurn || 1);
      if (plays >= maxPlays) return rejectMove(G, ctx, "playPersona", "no_plays_left", `${plays}/${maxPlays}`);
      const p = G.players.find((pp) => String(pp.id) === String(playerID));
      if (!p) return rejectMove(G, ctx, "playPersona", "player_not_found", String(playerID));
      const idx = (p.hand || []).findIndex((c2) => c2.id === cardId);
      if (idx === -1) return rejectMove(G, ctx, "playPersona", "card_not_in_hand", String(cardId));
      const c = p.hand[idx];
      if (c.type !== "persona") return rejectMove(G, ctx, "playPersona", "card_not_persona", `${String(cardId)}:${String(c?.type || "")}`);
      const base = baseId2(String(c.id));
      const mustTargetOpponentCoalition = base === "persona_9";
      let owner = p;
      if (mustTargetOpponentCoalition) {
        const tid = String(targetPlayerId || "");
        const target = (G.players || []).find((pp) => String(pp.id) === tid);
        if (!target || String(target.id) === String(playerID)) return rejectMove(G, ctx, "playPersona", "invalid_opponent_target", String(targetPlayerId || ""));
        owner = target;
      }
      if (Number((owner.coalition || []).length) >= MAX_COALITION) return rejectMove(G, ctx, "playPersona", "coalition_full", `${String(owner?.id || "")}:${Number((owner.coalition || []).length)}`);
      p.hand.splice(idx, 1);
      const dv = Number(G.playVpDelta || 0);
      if (dv && !c._turnPlayVpDeltaApplied) {
        c._turnPlayVpDeltaApplied = true;
        applyTokenDelta2(G, c, dv);
      }
      if (base === "persona_15") {
        c._p15ArmedTurn = Number(G.turnN || ctx?.turn || 0) + 1;
      }
      if (placeAfterId) {
        const j = (owner.coalition || []).findIndex((cc) => String(cc.id) === String(placeAfterId));
        if (j >= 0) {
          const insertAt = side === "left" ? j : j + 1;
          owner.coalition.splice(insertAt, 0, c);
        } else {
          owner.coalition.push(c);
        }
      } else {
        owner.coalition.push(c);
      }
      nativeAbility('globalEnter22', G, null, c);
      recalcPassives(G);
      G.playsThisTurn = plays + 1;
      G.hasPlayed = plays + 1 >= maxPlays;
      try {
        const isBot = !!p?.isBot || String(p?.name || "").startsWith("[B]");
        const cardName = String(c.name || c.text || c.id);
        const ruAcc = (s) => {
          if (/ин$/u.test(s)) return s + "\u0430";
          if (/ов$/u.test(s)) return s + "\u0430";
          if (/ев$/u.test(s)) return s + "\u0430";
          if (/ский$/u.test(s)) return s.replace(/ский$/u, "\u0441\u043A\u043E\u0433\u043E");
          return s;
        };
        if (c.type === "persona") {
          const who = ruAcc(cardName);
          const where = owner === p ? "\u0432 \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u044E" : `\u0432 \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u044E ${owner.name}`;
          const actorName = isBot ? p.name : ruYou2(p.name);
          G.log.push(`${actorName} \u0434\u043E\u0431\u0430\u0432\u0438\u043B ${who} ${where}`);
        } else {
          G.log.push(`${p.name} played ${c.name || c.id} to ${owner === p ? "their" : `${owner.name}'s`} Coalition.`);
        }
      } catch {
        G.log.push(`${p.name} played ${c.name || c.id} to ${owner === p ? "their" : `${owner.name}'s`} Coalition.`);
      }
      nativeAbility('playedPersonaResponse', G, owner, c, ctx, playerID);
      maybeTriggerRoundEnd(G, ctx);
      if (maybeEndAfterRound(G, ctx, events)) return;
      if (!G.hasPlayed) return;
      if (G.pending) return;
      events.endTurn?.();
    },
    playAction: ({ G, playerID, ctx, events }, cardId, targetId) => {
      return nativeAbility('playAction', G, events?._queue || [], [cardId, targetId ?? ''], ctx, playerID) ? undefined : INVALID_MOVE2;
    },
    discardFromCoalition: ({ G, playerID, ctx, events }, cardId) => {
      return nativeAbility('actionDiscard', G, events?._queue || [], null, ctx, playerID, cardId) ? undefined : INVALID_MOVE2;
    },
    // Persona 13: pick attacker persona to receive -1
    persona13PickTarget: ({ G, playerID }, ownerId, coalitionCardId) => {
      return nativeAbility('retaliate', G, null, null, { ownerId: String(ownerId) }, playerID, coalitionCardId) ? undefined : INVALID_MOVE2;
    },
    persona13Skip: ({ G, playerID }) => {
      return nativeAbility('skipRetaliation', G, null, null, null, playerID) ? undefined : INVALID_MOVE2;
    }
  })
};

globalThis.PolitikumBridge = {
  applyMoveJson(stateJson, playerID, moveName, argsJson){
    const state = JSON.parse(stateJson);
    const args = argsJson ? JSON.parse(argsJson) : [];
    return JSON.stringify(applyMove(state, playerID, moveName, args));
  }
};
