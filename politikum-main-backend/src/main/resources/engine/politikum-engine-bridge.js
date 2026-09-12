
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
function drawOneFromDeck({ G, me, source }) {
  const c = G.deck.shift();
  if (!c) return;
  if (c.type === "event") {
    G.lastEvent = c;
    const src2 = String(source || "");
    const srcBid2 = src2.split("#")[0];
    if (srcBid2 === "event_15") {
      G.log.push(`\u0412\u0430\u043C \u0432\u044B\u043F\u0430\u043B \u0427\u0415\u0420\u041D\u042B\u0419 \u041B\u0415\u0411\u0415\u0414\u042C`);
    } else if (srcBid2 === "event_10") {
      G.log.push(`${me.name} \u043F\u043E\u043F\u0430\u043B\u0441\u044F "\u041F\u0435\u0440\u0435\u0432\u043E\u0434 \u0432 \u043A\u0440\u0438\u043F\u0442\u043E\u043A\u043E\u043B\u043E\u043D\u0438\u044E"`);
    } else if (!logEvent11Draw(G, me, "event", src2)) {
      const bid = baseId(String(c.id));
      const title = eventTitle(c);
      const isBot = String(me.name || "").startsWith("[B]");
      if (!(isBot && (bid === "event_1" || bid === "event_2" || bid === "event_3" || bid === "event_10"))) {
        G.log.push(`${ruYou(me.name)} \u0432\u044B\u0442\u044F\u043D\u0443\u043B ${title}`);
      }
    }
    runAbility(c.abilityKey, { G, me, card: c });
    G.discard.push(c);
    return;
  }
  me.hand.push(c);
  const src = String(source || "");
  const srcBid = src.split("#")[0];
  if (srcBid === "event_12a") {
    G.log.push(`\u0412\u044B \u0432\u0437\u044F\u043B\u0438 \u043E\u0434\u043D\u0443 \u043A\u0430\u0440\u0442\u0443 \u043F\u043E\u0441\u043B\u0435 \u043D\u0430\u0431\u0435\u0433\u0430 \u0435\u0434\u0438\u043D\u043E\u0440\u043E\u0433\u043E\u0432`);
  } else if (srcBid === "event_12c") {
    G.log.push(`${ruYou(me.name)} \u0432\u0437\u044F\u043B \u043A\u0430\u0440\u0442\u0443 \u0438\u0437-\u0437\u0430 \u0441\u0440\u0430\u0447\u0430 \u0432 \u0442\u0432\u0438\u0442\u0442\u0435\u0440\u0435.`);
  } else if (!logEvent11Draw(G, me, "card", src)) {
    G.log.push(`${ruYou(me.name)} \u0432\u0437\u044F\u043B \u043A\u0430\u0440\u0442\u0443 \u0438\u0437 ${source || "ability"}.`);
  }
}
function drawNCards({ G, me, source, count }) {
  const n = Math.max(0, Number(count || 0));
  for (let i = 0; i < n; i++) drawOneFromDeck({ G, me, source });
}
function logEvent11Draw(G, me, what, eventId) {
  if (String(eventId).split("#")[0] !== "event_11") return false;
  if (what === "event") {
    G.log.push(`${me.name} \u043F\u043E\u043F\u0430\u043B\u0441\u044F \u0442\u0430\u0439\u043D\u044B\u0439 \u0443\u0434\u0432\u043E\u0438\u0442\u0435\u043B\u044C!`);
  } else {
    G.log.push(`${me.name} \u0431\u0435\u0440\u0451\u0442 \u043A\u0430\u0440\u0442\u0443 \u0432 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0435 \u0442\u0430\u0439\u043D\u043E\u0433\u043E \u0443\u0434\u0432\u043E\u0438\u0442\u0435\u043B\u044F`);
  }
  return true;
}
var ABILITIES = {
  // Starter abilities
  draw_1: ({ G, me, card }) => {
    drawNCards({ G, me, source: card?.id || "draw_1", count: 1 });
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
    const tokens = Number(card?.params?.tokens ?? 1);
    const delta = Number(card?.params?.delta ?? 1);
    const myCoal = (me.coalition || []).filter((c) => c.type === "persona");
    if (!myCoal.length) {
      const bid2 = baseId(String(card?.id || ""));
      if (bid2 === "event_1") {
        G.log.push(`${ruYou(me.name)} \u043A\u0430\u043A \u0436\u0430\u043B\u044C \u0447\u0442\u043E \u042D\u041A\u041E\u041A\u0420\u0415\u0414\u0418\u0422\u042B \u043D\u0435\u043A\u0443\u0434\u0430 \u0441\u0442\u0430\u0432\u0438\u0442\u044C!`);
      } else if (bid2 === "event_3") {
        G.log.push(`${me.name} \u043D\u0435 \u043A\u043E\u043C\u0443 \u0431\u044B\u043B\u043E \u043E\u0442\u0434\u0430\u0442\u044C \u0433\u043E\u0441\u0434\u0435\u043F\u043E\u0432\u0441\u043A\u0438\u0435 \u0433\u0440\u0430\u043D\u0442\u044B!`);
      } else {
        const title = eventTitle(card);
        G.log.push(`${ruYou(me.name)} \u0421\u043E\u0431\u044B\u0442\u0438\u0435 - ${title}: \u043D\u0435\u043A\u0443\u0434\u0430 \u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0436\u0435\u0442\u043E\u043D\u044B (\u043F\u0440\u043E\u043F\u0443\u0441\u043A).`);
      }
      return;
    }
    G.pending = { kind: "place_tokens_plus_vp", playerId: String(me.id), remaining: tokens, delta, sourceCardId: String(card.id) };
    const bid = baseId(String(card?.id || ""));
    if (bid === "event_1" && tokens === 3 && delta === 1) {
      G.log.push(`"\u042D\u043A\u043E\u043A\u0440\u0435\u0434\u0438\u0442\u044B": \u043F\u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 3 \u0436\u0435\u0442\u043E\u043D(\u043E\u0432) (+1) \u043D\u0430 \u0441\u0432\u043E\u044E \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u044E.`);
    } else if (bid === "event_2" && tokens === 2 && delta === 1) {
      G.log.push(`${me.name} \u043F\u043E\u043F\u0430\u043B\u0441\u044F \u0421\u043B\u0430\u0434\u043A\u0438\u0439 \u041F\u043E\u0434\u0430\u0440\u043E\u043A: \u043F\u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 2 \u0436\u0435\u0442\u043E\u043D\u0430 (+1) \u043D\u0430 \u0441\u0432\u043E\u044E \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u044E.`);
    } else if (bid === "event_3" && tokens === 5 && delta === 1) {
      G.log.push(`${me.name} \u0413\u0440\u0430\u043D\u0442 \u0413\u043E\u0441\u0434\u0435\u043F\u0430: \u043F\u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 5 \u0436\u0435\u0442\u043E\u043D(\u043E\u0432) (+1) \u043D\u0430 \u0441\u0432\u043E\u044E \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u044E.`);
    } else if (bid === "event_10" && tokens === 4 && delta === 1) {
      G.log.push(`${me.name} \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0438\u043B\u0438\u043B \u0447\u0435\u0442\u044B\u0440\u0435 +1 \u0442\u043E\u043A\u0435\u043D\u0430`);
    } else {
      const bid2 = baseId(String(card?.id || ""));
      if (bid2 === "persona_40" && tokens === 3 && delta === 1) {
        G.log.push(`${ruYou(me.name)} \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043B\u0430 \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C \u0414\u0443\u043D\u0446\u043E\u0432\u043E\u0439: \u043F\u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 ${tokens} \u0436\u0435\u0442\u043E\u043D(\u043E\u0432) (${delta > 0 ? "+" : ""}${delta}) \u043D\u0430 \u0441\u0432\u043E\u044E \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u044E.`);
      } else {
        const title = eventTitle(card);
        G.log.push(`${ruYou(me.name)} ${title}: \u043F\u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 ${tokens} \u0436\u0435\u0442\u043E\u043D(\u043E\u0432) (${delta > 0 ? "+" : ""}${delta}) \u043D\u0430 \u0441\u0432\u043E\u044E \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u044E.`);
      }
    }
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
    G.pending = { kind: "persona_3_choice", playerId: String(me.id), sourceCardId: String(card.id) };
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
    G.pending = { kind: "persona_23_choose_self_inflict_draw", playerId: String(me.id), sourceCardId: String(card.id), taken: 0 };
    G.log.push(`${actorWithPersona(me, "persona_23")}: выберите 0..3 жетона -1 для себя, затем доберите столько же карт.`);
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
    let affected = 0;
    for (const c of me.coalition || []) {
      if (c.type !== "persona") continue;
      if (!Array.isArray(c.tags) || !c.tags.includes("faction:fbk")) continue;
      applyTokenDelta(c, 1);
      affected++;
    }
    G.log.push(`${me.name} (${card.name || card.id}) buffed ${affected} FBK persona(s) in their coalition (+1).`);
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
    let took = 0;
    for (const pp of G.players || []) {
      for (const c of pp.coalition || []) {
        if (c.type !== "persona") continue;
        if (!Array.isArray(c.tags) || !c.tags.includes("faction:rightwing")) continue;
        const cur = Number(c.vpDelta || 0);
        if (cur > 0) {
          applyTokenDelta(c, -1);
          took++;
        }
      }
    }
    if (took) applyTokenDelta(card, took);
    G.log.push(`${ruYou(me.name)} (${card.name || card.id}) \u0432\u044B\u0441\u043E\u0441\u0430\u043B ${took} \xD7 +1 \u0443 \u043F\u0440\u0430\u0432\u044B\u0445.`);
  },
  persona_6_on_action8_plus1: ({ G, me, card }) => {
    G.log.push(`${ruYou(me.name)} (${card.name || card.id}) \u043F\u0430\u0441\u0441\u0438\u0432\u043A\u0430: \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442 +1 \u043A\u043E\u0433\u0434\u0430 \u043A\u043E\u0433\u043E-\u0442\u043E \u043E\u0431\u0432\u0438\u043D\u0438\u043B\u0438 \u0432 \u0440\u0430\u0431\u043E\u0442\u0435 \u043D\u0430 \u043A\u0440\u0435\u043C\u043B\u044C.`);
  },
  persona_30_on_enter_buff_liberals: ({ G, me, card }) => {
    let affected = 0;
    for (const c of me.coalition || []) {
      if (c.type !== "persona") continue;
      if (!Array.isArray(c.tags) || !c.tags.includes("faction:liberal")) continue;
      applyTokenDelta(c, 1);
      affected++;
    }
    G.log.push(`${ruYou(me.name)} (${card.name || card.id}) \u0443\u0441\u0438\u043B\u0438\u043B ${affected} \u043B\u0438\u0431\u0435\u0440\u0430\u043B(\u043E\u0432) \u0432 \u0441\u0432\u043E\u0435\u0439 \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u0438 (+1).`);
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
    const count = Number(card?.params?.count ?? 1);
    drawNCards({ G, me, source: card?.id || "event_draw_cards", count });
  },
  event_faction_minus1_draw1: ({ G, me, card }) => {
    const factionTag = String(card?.params?.factionTag || "");
    if (!factionTag) return;
    let affected = 0;
    for (const p of G.players || []) {
      for (const c of p.coalition || []) {
        if (c.type !== "persona") continue;
        const tags = c.tags || [];
        if (!Array.isArray(tags)) continue;
        if (!tags.includes(factionTag)) continue;
        applyTokenDelta(c, -1);
        affected++;
      }
    }
    const bid = baseId(String(card?.id || ""));
    const title = bid === "event_12a" ? "\u041D\u0430\u0431\u0435\u0433 \u0435\u0434\u0438\u043D\u043E\u0440\u043E\u0433\u043E\u0432" : bid === "event_12c" ? "\u0421\u0440\u0430\u0447 \u0432 \u0442\u0432\u0438\u0442\u0442\u0435\u0440\u0435 - \u0440\u0443\u0441\u0441\u043A\u0438\u0439 \u0444\u043B\u0430\u0433" : `EVENT ${card.id}`;
    const factionWord = factionTag === "faction:liberal" ? "\u043B\u0438\u0431\u0435\u0440\u0430\u043B\u0430" : factionTag === "faction:fbk" ? "\u0424\u0411\u041A" : factionTag;
    if (affected > 0) {
      G.log.push(`${title}: ${affected} \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436(\u0435\u0439) ${factionWord} \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442 -1, \u0437\u0430\u0442\u0435\u043C \u0432\u044B \u0431\u0435\u0440\u0451\u0442\u0435 \u043A\u0430\u0440\u0442\u0443.`);
    } else {
      if (bid === "event_12a") {
        G.log.push(`\u0412\u0430\u043C \u0432\u044B\u043F\u0430\u043B \u043D\u0430\u0431\u0435\u0433 \u0435\u0434\u0438\u043D\u043E\u0440\u043E\u0433\u043E\u0432, \u043D\u043E \u0432 \u0438\u0433\u0440\u0435 \u043D\u0435\u0442 \u043D\u0438\u043A\u043E\u0433\u043E \u0438\u0437 \u0424\u0411\u041A, \u0442\u0435\u043C \u043D\u0438 \u043C\u0435\u043D\u0435\u0435 1 \u043A\u0430\u0440\u0442\u0430 \u0432\u0430\u0448\u0430.`);
      } else {
        G.log.push(`${title}: \u043D\u0435\u0442 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0435\u0439 ${factionWord}, \u043D\u043E \u043A\u0430\u0440\u0442\u0443 \u0432\u0441\u0451 \u0440\u0430\u0432\u043D\u043E \u0431\u0435\u0440\u0451\u0442\u0435.`);
      }
    }
    drawNCards({ G, me, source: card?.id || "event_faction_minus1_draw1", count: 1 });
  },
  event_12b_discard_others_hand: ({ G, me, card }) => {
    const bid = baseId(String(card?.id || ""));
    const title = bid === "event_12b" ? "\u0421\u0440\u0430\u0447 \u0432 \u0442\u0432\u0438\u0442\u0442\u0435\u0440\u0435:\u0421\u0435\u043A\u0441 \u0441\u043A\u0430\u043D\u0434\u0430\u043B" : eventTitle(card);
    const short = bid === "event_12b" ? "\u0421\u0435\u043A\u0441 \u0441\u043A\u0430\u043D\u0434\u0430\u043B" : title;
    const others = (G.players || []).filter((p) => String(p.id) !== String(me.id)).filter((p) => !!p?.active);
    const humanTargets = [];
    for (const p of others) {
      const hand = p.hand || [];
      if (!hand.length) continue;
      const isBot = String(p.name || "").startsWith("[B]");
      if (isBot) {
        hand.splice(0, 1);
        G.log.push(`${short}: ${p.name} \u0441\u0431\u0440\u043E\u0441\u0438\u043B 1 \u043A\u0430\u0440\u0442\u0443 \u0441 \u0440\u0443\u043A\u0438.`);
      } else {
        humanTargets.push(String(p.id));
      }
    }
    if (humanTargets.length) {
      G.pending = {
        kind: "event_12b_discard_from_hand",
        playerId: String(me.id),
        sourceCardId: String(card.id),
        targetIds: humanTargets
      };
      G.log.push(`${short}: \u043E\u0441\u0442\u0430\u043B\u044C\u043D\u044B\u0435 \u0438\u0433\u0440\u043E\u043A\u0438 \u0434\u043E\u043B\u0436\u043D\u044B \u0441\u0431\u0440\u043E\u0441\u0438\u0442\u044C 1 \u043A\u0430\u0440\u0442\u0443.`);
    }
  },
  event_shuffle_all_hands_redeal: ({ G, me, card }) => {
    const pool = [];
    const counts = {};
    for (const p of G.players || []) {
      const hand = p.hand || [];
      counts[String(p.id)] = hand.length;
      while (hand.length) {
        pool.push(hand.shift());
      }
    }
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (const p of G.players || []) {
      const need = counts[String(p.id)] || 0;
      p.hand = [];
      for (let i = 0; i < need && pool.length; i++) {
        const c = pool.shift();
        if (c) p.hand.push(c);
      }
    }
    if (String(card?.id || "").split("#")[0] === "event_15") {
      G.log.push(`${ruYou(me.name)} \u0432\u044B\u0442\u044F\u043D\u0443\u043B \u0427\u0435\u0440\u043D\u044B\u0439 \u043B\u0435\u0431\u0435\u0434\u044C, \u0432\u0441\u0435 \u043A\u0430\u0440\u0442\u044B \u0438\u0437 \u0440\u0443\u043A \u043F\u0435\u0440\u0435\u043C\u0435\u0448\u0430\u043B\u0438\u0441\u044C \u0438 \u0440\u0430\u0437\u0434\u0430\u043B\u0438\u0441\u044C \u043E\u0431\u0440\u0430\u0442\u043D\u043E`);
    } else {
      G.log.push(`${ruYou(me.name)} EVENT ${card.id}: \u0432\u0441\u0435 \u0440\u0443\u043A\u0438 \u043F\u0435\u0440\u0435\u043C\u0435\u0448\u0430\u043B\u0438\u0441\u044C \u0438 \u0440\u0430\u0437\u0434\u0430\u043B\u0438 \u0437\u0430\u043D\u043E\u0432\u043E.`);
    }
  },
  event_16_discard_self_persona_then_draw1: ({ G, me, card }) => {
    const canDiscard = (me.coalition || []).some(
      (c) => c?.type === "persona" && String(c?.id || "").split("#")[0] !== "persona_31" && !c?.shielded
    );
    const evName = String(card?.text || card?.name || card.id);
    if (!canDiscard) {
      const bid = String(card?.id || "").split("#")[0];
      if (bid === "event_16") {
        G.log.push(`\u041F\u043E\u043B\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 [\u0420\u041E\u0421\u041A\u041E\u041C\u041D\u0410\u0414\u0417\u041E\u0420] \u0443\u0448\u0435\u043B \u0432 \u043E\u0442\u0431\u043E\u0439 \u043D\u0438\u043A\u043E\u0433\u043E \u043D\u0435 \u0441\u0431\u0440\u043E\u0441\u0438\u0432.`);
      } else {
        G.log.push(`${ruYou(me.name)} ${evName}: \u043D\u0435\u0447\u0435\u0433\u043E \u0441\u0431\u0440\u0430\u0441\u044B\u0432\u0430\u0442\u044C (\u0432\u0441\u0435 \u043F\u0435\u0440\u0441\u043E\u043D\u044B \u0437\u0430\u0449\u0438\u0449\u0435\u043D\u044B/\u043D\u0435\u043F\u043E\u0434\u0432\u0438\u0436\u043D\u044B).`);
      }
      return;
    }
    G.pending = {
      kind: "event_16_discard_self_persona_then_draw1",
      playerId: String(me.id),
      sourceCardId: String(card.id)
    };
    if (String(card?.id || "").split("#")[0] === "event_16") {
    } else {
      G.log.push(`${ruYou(me.name)} EVENT ${evName}: \u0441\u0431\u0440\u043E\u0441\u044C\u0442\u0435 1 \u043F\u0435\u0440\u0441\u043E\u043D\u0443 \u0438\u0437 \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u0438, \u0437\u0430\u0442\u0435\u043C \u0432\u043E\u0437\u044C\u043C\u0438\u0442\u0435 1 \u043A\u0430\u0440\u0442\u0443.`);
    }
  },
  discard_one_persona_from_any_coalition: ({ G, me, card }) => {
    G.pending = { kind: "discard_one_persona_from_any_coalition", playerId: String(me.id), sourceCardId: String(card.id) };
    G.log.push(`${ruYou(me.name)} (${card.name || card.id}): \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u0435\u0440\u0441\u043E\u043D\u0443 \u0432 \u043B\u044E\u0431\u043E\u0439 \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u0438 \u0434\u043B\u044F \u0441\u0431\u0440\u043E\u0441\u0430.`);
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
  try {
    const bid = baseId2(String(eventCard?.id || ""));
    if (!(bid === "event_1" || bid === "event_2" || bid === "event_3" || bid === "event_10")) return;
    const pend = G.pending;
    const pendingMatchesEvent = pend && pend.kind === "place_tokens_plus_vp" && String(pend.sourceCardId || "").split("#")[0] === bid;
    const vacuums = [];
    for (const pp of G.players || []) {
      for (const cc of pp.coalition || []) {
        if (baseId2(String(cc.id)) === "persona_38") vacuums.push({ ownerName: String(pp.name || pp.id), card: cc });
      }
    }
    if (!vacuums.length) return;
    const canSteal = pendingMatchesEvent ? Math.max(0, Number(pend.remaining || 0)) : 0;
    const want = vacuums.length;
    const take = pendingMatchesEvent ? Math.min(want, canSteal) : 0;
    for (let i = 0; i < take; i++) {
      const v = vacuums[i];
      applyTokenDelta2(G, v.card, 1);
    }
    if (pendingMatchesEvent && take > 0) {
      pend.remaining = Math.max(0, Number(pend.remaining || 0) - take);
      if (Number(pend.remaining || 0) <= 0) G.pending = null;
      try {
        const who = take === 1 ? "VotVot" : `${take}\xD7 VotVot`;
        const evTitle = eventTitleByBaseId2(bid) || bid;
        G.log.push(`${who} \u0437\u0430\u0431\u0440\u0430\u043B ${take} \u0436\u0435\u0442\u043E\u043D(\u043E\u0432) \u0438\u0437 \u0441\u043E\u0431\u044B\u0442\u0438\u044F ${evTitle}. (\u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C: ${Math.max(0, Number(pend.remaining || 0))})`);
      } catch {
      }
    }
  } catch {
  }
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
    applyPendingToken: ({ G, ctx, playerID }, coalitionCardId) => {
      expireResponseAndResolveDeferred(G);
      const pend = G.pending;
      if (!pend || pend.kind !== "place_tokens_plus_vp") return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      const idx = (me.coalition || []).findIndex((c2) => String(c2.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE2;
      const c = me.coalition[idx];
      const burst = Math.max(1, Number(pend.remaining || 1));
      let delta = Number(pend.delta || 1) * burst;
      if (c.shielded && delta > 0) {
        if (!pend.shieldTaxApplied) {
          delta = Math.max(0, delta - 1);
          pend.shieldTaxApplied = true;
        }
      }
      if (!delta) {
        G.log.push(`${ruYou2(me.name)} \u0432\u044B\u0431\u0440\u0430\u043B \u0437\u0430\u0449\u0438\u0449\u0451\u043D\u043D\u043E\u0433\u043E \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430 (${c.name || c.id}); +1 \u043D\u0435 \u0441\u0440\u0430\u0431\u043E\u0442\u0430\u043B.`);
      } else {
        applyTokenDelta2(G, c, delta);
      }
      pend.remaining = Math.max(0, Number(pend.remaining || 0) - burst);
      const left = Math.max(0, Number(pend.remaining || 0));
      G.log.push(`${ruYou2(me.name)} \u043F\u043E\u0441\u0442\u0430\u0432\u0438\u043B +${delta} \u043D\u0430 ${c.name || c.id}. (\u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C: ${left})`);
      if (left <= 0) {
        G.pending = null;
        try {
          expireResponseAndResolveDeferred(G);
        } catch {
        }
      }
      recalcPassives(G);
    },
    discardPersonaFromCoalition: ({ G, ctx, playerID }, ownerId, coalitionCardId) => {
      if (G.response && responseExpired(G)) G.response = null;
      const pend = G.pending;
      if (!pend || pend.kind !== "discard_one_persona_from_any_coalition") return INVALID_MOVE2;
      if (String(playerID) !== String(ctx.currentPlayer)) return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      const owner = (G.players || []).find((pp) => String(pp.id) === String(ownerId));
      if (!owner) return INVALID_MOVE2;
      const idx = (owner.coalition || []).findIndex((c2) => String(c2.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE2;
      const target = owner.coalition[idx];
      if (!target || target.type !== "persona") return INVALID_MOVE2;
      if (target?.shielded) return INVALID_MOVE2;
      const [c] = owner.coalition.splice(idx, 1);
      if (c) {
        G.discard.push(c);
        if (c.type === "persona") persona44OnPersonaDiscarded(G);
      }
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      const src = String(pend?.sourceCardId || "");
      const srcName = src ? cardTitle({ id: src }) : "";
      if (srcName) {
        G.log.push(`${ruYou2(me?.name || playerID)} \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043B \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C ${srcName}: \u0441\u0431\u0440\u043E\u0441\u0438\u043B ${c?.name || c?.id} \u0438\u0437 \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u0438 ${owner.name}.`);
      } else {
        G.log.push(`${ruYou2(me?.name || playerID)} \u0441\u0431\u0440\u043E\u0441\u0438\u043B ${c?.name || c?.id} \u0438\u0437 \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u0438 ${owner.name}.`);
      }
      G.pending = null;
      recalcPassives(G);
    },
    persona3Skip: ({ G, ctx, playerID, events }) => {
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_3_choice") return INVALID_MOVE2;
      if (String(playerID) !== String(ctx.currentPlayer)) return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      G.log.push(`${ruYou2(me.name)} сбросил ${toDiscard.length} карт(ы) после добора 3.`);
      G.pending = null;
      recalcPassives(G);
      maybeTriggerRoundEnd(G, ctx);
      if (maybeEndAfterRound(G, ctx, events)) return;
      events.endTurn?.();
    },
    persona3ChooseOption: ({ G, ctx, playerID, events }, option, targetId, coalitionCardId) => {
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_3_choice") return INVALID_MOVE2;
      if (String(playerID) !== String(ctx.currentPlayer)) return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      let didSomething = false;
      if (option === "a") {
        const tid = String(targetId || "");
        const owner = (G.players || []).find((pp) => String(pp.id) === tid);
        if (!owner) return INVALID_MOVE2;
        let j = -1;
        if (coalitionCardId) {
          j = (owner.coalition || []).findIndex((c) => String(c.id) === String(coalitionCardId));
        }
        if (j < 0) {
          j = (owner.coalition || []).findIndex((c) => c.type === "persona" && Array.isArray(c.tags) && c.tags.includes("faction:leftwing"));
        }
        if (j < 0) return INVALID_MOVE2;
        const target = owner.coalition[j];
        if (!target || target.type !== "persona") return INVALID_MOVE2;
        if (!Array.isArray(target.tags) || !target.tags.includes("faction:leftwing")) return INVALID_MOVE2;
        if (target?.shielded) return INVALID_MOVE2;
        const [drop] = owner.coalition.splice(j, 1);
        if (drop) {
          didSomething = true;
          G.discard.push(drop);
          if (drop.type === "persona") persona44OnPersonaDiscarded(G);
        }
        G.log.push(`${ruYou2(me.name)} сбросил ${toDiscard.length} карт(ы) после добора 3.`);
      } else {
        let removed = 0;
        for (const p of G.players || []) {
          if (String(p.id) === String(playerID)) continue;
          for (const c of p.coalition || []) {
            if (c.type !== "persona") continue;
            if (!Array.isArray(c.tags) || !c.tags.includes("faction:leftwing")) continue;
            const cur = Number(c.vpDelta || 0);
            const take = Math.min(2, Math.max(0, cur));
            if (take > 0) {
              applyTokenDelta2(G, c, -take);
              removed += take;
            }
          }
        }
        if (removed > 0) didSomething = true;
        G.log.push(`${ruYou2(me.name)} сбросил ${toDiscard.length} карт(ы) после добора 3.`);
      }
      if (didSomething) {
        try {
          const self = (me.coalition || []).find((c) => baseId2(String(c.id)) === "persona_3");
          if (self) applyTokenDelta2(G, self, -1);
        } catch {
        }
      }
      G.pending = null;
      recalcPassives(G);
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
      const pend = G.pending;
      if (!pend || pend.kind !== "event_12b_discard_from_hand") return INVALID_MOVE2;
      const targets = Array.isArray(pend.targetIds) ? pend.targetIds.map(String) : [];
      if (!targets.includes(String(playerID))) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      const idx = (me.hand || []).findIndex((c) => String(c.id) === String(cardId));
      if (idx < 0) return INVALID_MOVE2;
      const [drop] = me.hand.splice(idx, 1);
      if (drop) {
        G.discard.push(drop);
        if (drop.type === "persona") persona44OnPersonaDiscarded(G);
        const bid = baseId2(String(pend.sourceCardId || ""));
        const ev = eventTitle2({ id: pend.sourceCardId });
        const subtitle = String(ev).split(":").slice(-1)[0].trim();
        const prefix = bid === "event_12b" ? "\u0421\u0435\u043A\u0441 \u0441\u043A\u0430\u043D\u0434\u0430\u043B" : subtitle || ev || pend.sourceCardId;
        G.log.push(`${prefix}:: ${ruYou2(me.name)} \u0441\u0431\u0440\u043E\u0441\u0438\u043B 1 \u043A\u0430\u0440\u0442\u0443 \u0441 \u0440\u0443\u043A\u0438.`);
      }
      pend.targetIds = targets.filter((id) => id !== String(playerID));
      if (!pend.targetIds.length) {
        G.pending = null;
        try {
          expireResponseAndResolveDeferred(G);
        } catch {
        }
      }
    },
    discardPersonaFromOwnCoalitionForEvent16: ({ G, playerID }, coalitionCardId) => {
      const pend = G.pending;
      if (!pend || pend.kind !== "event_16_discard_self_persona_then_draw1") return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      const idx = (me.coalition || []).findIndex((c2) => String(c2.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE2;
      const c = me.coalition[idx];
      if (!c || c.type !== "persona") return INVALID_MOVE2;
      if (baseId2(String(c.id)) === "persona_31") return INVALID_MOVE2;
      if (c.shielded) return INVALID_MOVE2;
      me.coalition.splice(idx, 1);
      G.discard.push(c);
      if (c.type === "persona") persona44OnPersonaDiscarded(G);
      const srcBid = baseId2(String(pend.sourceCardId || ""));
      if (srcBid === "event_16") {
        G.log.push(`${ruYou2(me.name)} \u0441\u0431\u0440\u043E\u0441\u0438\u043B ${c.name || c.id} \u0438\u0437 \u0441\u0432\u043E\u0435\u0439 \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u0438 \u0438\u0437-\u0437\u0430 \u0441\u043E\u0431\u044B\u0442\u0438\u044F \u043F\u043E\u043B\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 [\u0420\u041E\u0421\u041A\u041E\u041C\u041D\u0410\u0414\u0417\u041E\u0420].`);
      } else {
        G.log.push(`${ruYou2(me.name)} \u0441\u0431\u0440\u043E\u0441\u0438\u043B ${c.name || c.id} \u0438\u0437 \u0441\u0432\u043E\u0435\u0439 \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u0438 \u0438\u0437-\u0437\u0430 "${cardTitle(pend.sourceCardId)}".`);
      }
      const draw = () => {
        const next = G.deck.shift();
        if (!next) return;
        if (next.type === "event") {
          G.lastEvent = next;
          const evName = eventTitle2(next);
          const srcBid2 = baseId2(String(pend.sourceCardId || ""));
          const nextBid = baseId2(String(next.id || ""));
          if (srcBid2 === "event_16" && nextBid === "event_10") {
            G.log.push(`${ruYou2(me.name)} ${ruDrewVerb(me.name)} ${evName}, \u043F\u043E\u0441\u043B\u0435 \u043F\u043E\u043B\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 [\u0420\u041E\u0421\u041A\u041E\u041C\u041D\u0410\u0414\u0417\u041E\u0420].`);
          } else {
            G.log.push(`${ruYou2(me.name)} ${ruDrewVerb(me.name)} ${evName} (\u0438\u0437 "${cardTitle(pend.sourceCardId)}")`);
          }
          runAbility(next.abilityKey, { G, me, card: next });
          persona38OnEventPlayed(G, next);
          G.discard.push(next);
        } else {
          me.hand.push(next);
          const srcBid2 = baseId2(String(pend.sourceCardId || ""));
          if (srcBid2 === "event_16") G.log.push(`\u0417\u0430\u0442\u043E \u0432\u0437\u044F\u043B\u0438 \u043A\u0430\u0440\u0442\u0443.`);
          else G.log.push(`${ruYou2(me.name)} \u0432\u0437\u044F\u043B \u043A\u0430\u0440\u0442\u0443 \u0438\u0437 "${cardTitle(pend.sourceCardId)}".`);
        }
      };
      draw();
      G.pending = null;
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
    persona23ChooseSelfInflict: ({ G, playerID }, n) => {
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_23_choose_self_inflict_draw") return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      const self = (me.coalition || []).find((c) => baseId2(String(c.id)) === "persona_23");
      if (!self) return INVALID_MOVE2;
      const already = Math.max(0, Math.min(3, Number(pend.taken || 0)));
      const want = Number(n || 0);
      if (want === 0) {
        G.pending = null;
        recalcPassives(G);
        return;
      }
      const remaining = Math.max(0, 3 - already);
      const k = Math.max(0, Math.min(remaining, want));
      if (!k) return INVALID_MOVE2;
      applyTokenDelta2(G, self, -k);
      for (let i = 0; i < k; i++) {
        const next = G.deck.shift();
        if (!next) break;
        if (next.type === "event") {
          G.lastEvent = next;
          const evName = eventTitle2(next);
          G.log.push(`${ruYou2(me.name)} ${ruDrewVerb(me.name)} ${evName} \u0438\u0437-\u0437\u0430 \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u0438 \u0412\u043E\u043B\u043A\u043E\u0432\u0430.`);
          runAbility(next.abilityKey, { G, me, card: next });
          persona38OnEventPlayed(G, next);
          if (G.pending) break;
          G.discard.push(next);
        } else {
          me.hand.push(next);
          G.log.push(`${ruYou2(me.name)} \u0432\u0437\u044F\u043B \u043A\u0430\u0440\u0442\u0443 \u0438\u0437-\u0437\u0430 \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u0438 \u0412\u043E\u043B\u043A\u043E\u0432\u0430.`);
        }
      }
      pend.taken = already + k;
      G.log.push(`${actorWithPersona(me, "persona_23")} \u0432\u0437\u044F\u043B ${k} \xD7 -1 \u0438 \u0432\u044B\u0442\u044F\u043D\u0443\u043B ${k} \u043A\u0430\u0440\u0442. (total ${pend.taken}/3)`);
      if (G.pending && G.pending.kind !== "persona_23_choose_self_inflict_draw") {
        recalcPassives(G);
        return;
      }
      if (Number(pend.taken || 0) >= 3) G.pending = null;
      recalcPassives(G);
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
    persona39ActivateRecycle: ({ G, ctx, playerID }) => {
      if (String(ctx.phase || "") !== "action") return INVALID_MOVE2;
      if (String(playerID) !== String(ctx.currentPlayer)) return INVALID_MOVE2;
      if (G.pending) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      const idx = (me.coalition || []).findIndex((c) => baseId2(String(c.id)) === "persona_39");
      if (idx < 0) return INVALID_MOVE2;
      const [self] = me.coalition.splice(idx, 1);
      if (self) {
        (G.deck || []).push(self);
        G.deck = shuffle(G.deck);
      }
      let buffed = 0;
      for (const c of me.coalition || []) {
        if (c.type !== "persona") continue;
        if (Array.isArray(c.tags) && c.tags.includes("faction:red_nationalist")) {
          applyTokenDelta2(G, c, 2);
          buffed++;
        }
      }
      recalcPassives(G);
      G.log.push(`${actorWithPersona(me, "persona_39")} \u0432\u0435\u0440\u043D\u0443\u043B \u0441\u0435\u0431\u044F \u0432 \u043A\u043E\u043B\u043E\u0434\u0443 \u0438 \u0443\u0441\u0438\u043B\u0438\u043B ${buffed} \u043A\u0440\u0430\u0441\u043D.\u043D\u0430\u0446. \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436(\u0435\u0439) (+2).`);
    },
    persona45StealFromOpponent: ({ G, ctx, playerID, events }, ...args) => {
      return nativeAbility("steal45", G, events?._queue || [], args, ctx, playerID) ? undefined : INVALID_MOVE2;
    },
    // Action 7: pick any persona (any coalition); its abilities are blocked and all vpDelta tokens are cleared.
    blockPersonaForAction7: ({ G, playerID, ctx, events }, ownerId, coalitionCardId) => {
      if (G.response && responseExpired(G)) G.response = null;
      const pend = G.pending;
      if (!pend || pend.kind !== "action_7_block_persona") return INVALID_MOVE2;
      if (String(pend.attackerId) !== String(playerID)) return INVALID_MOVE2;
      const owner = (G.players || []).find((pp) => String(pp.id) === String(ownerId));
      if (!owner) return INVALID_MOVE2;
      const idx = (owner.coalition || []).findIndex((c) => String(c.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE2;
      const target = owner.coalition[idx];
      if (!target || target.type !== "persona") return INVALID_MOVE2;
      if (baseId2(String(target.id)) === "persona_36") {
        applyTokenDelta2(G, target, 4);
        recalcPassives(G);
        const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
        G.log.push(`${ruYou2(me?.name || playerID)} \u0432\u044B\u0434\u0430\u043B ${target.name || target.id} \u0441\u0442\u0430\u0442\u0443\u0441 \u0418\u041D\u041E\u0410\u0413\u0415\u041D\u0422\u0410, \u043D\u043E \u0442\u043E\u0442 \u043F\u0440\u043E\u0438\u0433\u043D\u043E\u0440\u0438\u0440\u043E\u0432\u0430\u043B \u0438 \u043F\u043E\u043B\u0443\u0447\u0438\u043B +4.`);
      } else {
        target.vpDelta = 0;
        target.plusTokens = 0;
        target.minusTokens = 0;
        target.passiveVpDelta = 0;
        target.vp = Number(target.baseVp ?? 0);
        recalcPassives(G);
        target.blockedAbilities = true;
        target.blockedBy = "action_7";
        const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
        G.log.push(`${ruYou2(me?.name || playerID)} \u0432\u044B\u0434\u0430\u043B ${target.name || target.id} \u0441\u0442\u0430\u0442\u0443\u0441 \u0418\u041D\u041E\u0410\u0413\u0415\u041D\u0422\u0410: \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u0438 \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u044B, \u0436\u0435\u0442\u043E\u043D\u044B \u0441\u0431\u0440\u043E\u0448\u0435\u043D\u044B.`);
      }
      G.pending = null;
      maybeTriggerRoundEnd(G, ctx);
      if (maybeEndAfterRound(G, ctx, events)) return;
      events.endTurn?.();
    },
    // Action 13: shield one of YOUR personas – cannot be targeted; +1 gains reduced by 1.
    shieldPersonaForAction13: ({ G, playerID, ctx, events }, coalitionCardId) => {
      if (G.response && responseExpired(G)) G.response = null;
      const pend = G.pending;
      if (!pend || pend.kind !== "action_13_shield_persona") return INVALID_MOVE2;
      if (String(pend.attackerId) !== String(playerID)) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      const idx = (me.coalition || []).findIndex((c) => String(c.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE2;
      const target = me.coalition[idx];
      if (!target || target.type !== "persona") return INVALID_MOVE2;
      target.shielded = true;
      target.shieldedBy = "action_13";
      G.log.push(`${ruYou2(me.name)} \u0440\u0430\u0437\u044B\u0433\u0440\u0430\u043B \u0411\u0435\u043B\u043E\u0435 \u043F\u0430\u043B\u044C\u0442\u043E \u043D\u0430 ${target.name || target.id}`);
      G.pending = null;
      maybeTriggerRoundEnd(G, ctx);
      if (maybeEndAfterRound(G, ctx, events)) return;
      events.endTurn?.();
    },
    // Action 17: attacker chooses an opponent persona to receive -1 tokens (normally 2, or 4 for special ids).
    applyAction17ToPersona: ({ G, playerID, ctx, events }, targetPersonaId) => {
      if (G.response && responseExpired(G)) G.response = null;
      const pend = G.pending;
      if (!pend || pend.kind !== "action_17_choose_opponent_persona") return INVALID_MOVE2;
      if (String(pend.attackerId) !== String(playerID)) return INVALID_MOVE2;
      const owner = (G.players || []).find((pp) => String(pp.id) !== String(playerID) && (pp.coalition || []).some((c) => String(c.id) === String(targetPersonaId)));
      if (!owner) return INVALID_MOVE2;
      const idx = (owner.coalition || []).findIndex((c) => String(c.id) === String(targetPersonaId));
      if (idx < 0) return INVALID_MOVE2;
      const target = owner.coalition[idx];
      if (!target || target.type !== "persona") return INVALID_MOVE2;
      if (target.shielded) return INVALID_MOVE2;
      const base = baseId2(String(target.id));
      const special = base === "persona_3" || base === "persona_38" || base === "persona_41" || base === "persona_43";
      const tokens = special ? 4 : 2;
      applyTokenDelta2(G, target, -tokens);
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      const an = actionTitle(G.lastAction) || "ACTION 17";
      G.log.push(`${ruYou2(me?.name || playerID)} \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043B ${an} \u043D\u0430 ${target.name || target.id}: ${special ? "4" : "2"} \xD7 -1.`);
      G.pending = null;
      recalcPassives(G);
      maybeTriggerRoundEnd(G, ctx);
      if (maybeEndAfterRound(G, ctx, events)) return;
      events.endTurn?.();
    },
    // Action 18: return a persona from discard to your hand.
    pickPersonaFromDiscardForAction18: ({ G, playerID, ctx, events }, cardId) => {
      if (G.response && responseExpired(G)) G.response = null;
      const pend = G.pending;
      if (!pend || pend.kind !== "action_18_pick_persona_from_discard") return INVALID_MOVE2;
      if (String(pend.attackerId) !== String(playerID)) return INVALID_MOVE2;
      const idx = (G.discard || []).findIndex((c2) => String(c2.id) === String(cardId));
      if (idx < 0) return INVALID_MOVE2;
      const c = G.discard[idx];
      if (!c || c.type !== "persona") return INVALID_MOVE2;
      if (baseId2(String(c.id)) === "persona_31") return INVALID_MOVE2;
      G.discard.splice(idx, 1);
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      me.hand.push(c);
      G.log.push(`${ruYou2(me.name)} \u0432\u0435\u0440\u043D\u0443\u043B ${c.name || c.id} \u0438\u0437 \u0441\u0431\u0440\u043E\u0441\u0430 \u0432 \u0440\u0443\u043A\u0443 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u044F "\u0432\u043E\u0441\u043A\u0440\u0435\u0441\u0438\u0442\u044C \u043F\u043E\u043B\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0442\u0440\u0443\u043F".`);
      G.pending = null;
      maybeTriggerRoundEnd(G, ctx);
      if (maybeEndAfterRound(G, ctx, events)) return;
      events.endTurn?.();
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
          G.lastEvent = c;
          const bid = baseId2(String(c.id));
          if (bid === "event_10") {
            G.log.push(`${me.name} попался "Перевод в криптоколонию"`);
          } else if (bid === "event_11") {
            G.log.push(`${me.name} попался тайный удвоитель!`);
          } else if (bid === "event_15") {
            G.log.push(`${ruYou2(me.name)}: вам выпал ЧЕРНЫЙ ЛЕБЕДЬ`);
          } else {
            const evName = eventTitle2(c);
            G.log.push(`${ruYou2(me.name)} ${ruDrewVerb(me.name)} ${evName}`);
          }
          try {
            if (Array.isArray(c.tags) && c.tags.includes("event_type:twitter_squabble")) {
              for (const pp of G.players || []) {
                for (const cc of pp.coalition || []) {
                  if (baseId2(String(cc.id)) === "persona_4") applyTokenDelta2(G, cc, -2);
                }
              }
            }
          } catch {
          }
          runAbility(c.abilityKey, { G, me, card: c });
          persona38OnEventPlayed(G, c);
          recalcPassives(G);
          G.discard.push(c);
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
              G.lastEvent = c;
              const bid = baseId2(String(c.id));
              if (bid === "event_10") {
                G.log.push(`${p.name} попался "Перевод в криптоколонию"`);
              } else if (bid === "event_11") {
                G.log.push(`${p.name} попался тайный удвоитель!`);
              } else if (bid === "event_15") {
                G.log.push(`${ruYou2(p.name)}: вам выпал ЧЕРНЫЙ ЛЕБЕДЬ`);
              } else {
                const evName = eventTitle2(c);
                G.log.push(`${ruYou2(p.name)} ${ruDrewVerb(p.name)} ${evName}`);
              }
              try {
                if (Array.isArray(c.tags) && c.tags.includes("event_type:twitter_squabble")) {
                  for (const pp of G.players || []) {
                    for (const cc of pp.coalition || []) {
                      if (baseId2(String(cc.id)) === "persona_4") applyTokenDelta2(G, cc, -2);
                    }
                  }
                }
              } catch {
              }
              runAbility(c.abilityKey, { G, me: p, card: c });
              persona38OnEventPlayed(G, c);
              recalcPassives(G);
              G.discard.push(c);
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
              G.lastEvent = c;
              const bid = baseId2(String(c.id));
              if (bid === "event_10") {
                G.log.push(`${p.name} \u043F\u043E\u043F\u0430\u043B\u0441\u044F "\u041F\u0435\u0440\u0435\u0432\u043E\u0434 \u0432 \u043A\u0440\u0438\u043F\u0442\u043E\u043A\u043E\u043B\u043E\u043D\u0438\u044E"`);
              } else if (bid === "event_11") {
                G.log.push(`${p.name} \u043F\u043E\u043F\u0430\u043B\u0441\u044F \u0442\u0430\u0439\u043D\u044B\u0439 \u0443\u0434\u0432\u043E\u0438\u0442\u0435\u043B\u044C!`);
              } else if (bid === "event_15") {
                G.log.push(`${ruYou2(p.name)}: \u0432\u0430\u043C \u0432\u044B\u043F\u0430\u043B \u0427\u0415\u0420\u041D\u042B\u0419 \u041B\u0415\u0411\u0415\u0414\u042C`);
              } else {
                const evName = eventTitle2(c);
                G.log.push(`${ruYou2(p.name)} ${ruDrewVerb(p.name)} ${evName}`);
              }
              try {
                if (Array.isArray(c.tags) && c.tags.includes("event_type:twitter_squabble")) {
                  for (const pp of G.players || []) {
                    for (const cc of pp.coalition || []) {
                      if (baseId2(String(cc.id)) === "persona_4") applyTokenDelta2(G, cc, -2);
                    }
                  }
                }
              } catch {
              }
              runAbility(c.abilityKey, { G, me: p, card: c });
              persona38OnEventPlayed(G, c);
              recalcPassives(G);
              G.discard.push(c);
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
          if (pend.kind === "persona_3_choice" && String(pend.playerId) === String(p.id)) {
            try {
              const owners = (G.players || []).filter((pp) => (pp.coalition || []).some((c) => c.type === "persona" && Array.isArray(c.tags) && c.tags.includes("faction:leftwing") && !c.shielded));
              const owner = owners[0];
              if (owner) {
                const j = (owner.coalition || []).findIndex((c) => c.type === "persona" && Array.isArray(c.tags) && c.tags.includes("faction:leftwing") && !c.shielded);
                if (j >= 0) {
                  const [drop] = owner.coalition.splice(j, 1);
                  if (drop) G.discard.push(drop);
                  G.log.push(`${ruYou2(p.name)} (${pend.sourceCardId}): \u0441\u0431\u0440\u043E\u0441\u0438\u043B ${drop?.name || drop?.id} (\u043B\u0435\u0432\u044B\u0435) \u0443 ${owner.name}.`);
                }
              } else {
                let removed = 0;
                for (const pp of G.players || []) {
                  if (String(pp.id) === String(p.id)) continue;
                  for (const c of pp.coalition || []) {
                    if (c.type !== "persona") continue;
                    if (!Array.isArray(c.tags) || !c.tags.includes("faction:leftwing")) continue;
                    const cur = Number(c.vpDelta || 0);
                    const take = Math.min(2, Math.max(0, cur));
                    if (take > 0) {
                      applyTokenDelta2(G, c, -take);
                      removed += take;
                    }
                  }
                }
                G.log.push(`${ruYou2(p.name)} (${pend.sourceCardId}): \u0441\u043D\u044F\u043B ${removed} \xD7 +1 \u0441 \u043B\u0435\u0432\u044B\u0445 \u0443 \u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A\u043E\u0432.`);
              }
            } catch {
            }
            G.pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 400;
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
          if (pend.kind === "persona_23_choose_self_inflict_draw" && String(pend.playerId) === String(p.id)) {
            try {
              const self = (p.coalition || []).find((c) => baseId2(String(c.id)) === "persona_23");
              const k = self ? 2 : 0;
              if (self && k) applyTokenDelta2(G, self, -k);
              for (let i = 0; i < k; i++) {
                const next = (G.deck || []).shift();
                if (!next) break;
                if (next.type === "event") {
                  G.lastEvent = next;
                  const evName = eventTitle2(next);
                  G.log.push(`${ruYou2(p.name)} ${ruDrewVerb(p.name)} ${evName} (\u0438\u0437 "${cardTitle(pend.sourceCardId)}")`);
                  runAbility(next.abilityKey, { G, me: p, card: next });
                  persona38OnEventPlayed(G, next);
                  G.discard.push(next);
                } else {
                  p.hand.push(next);
                  G.log.push(`${ruYou2(p.name)} \u0432\u0437\u044F\u043B \u043A\u0430\u0440\u0442\u0443 \u0438\u0437 ${pend.sourceCardId}.`);
                }
              }
              G.log.push(`${actorWithPersona(p, "persona_23")} \u0432\u0437\u044F\u043B ${k} \xD7 -1 \u0438 \u0432\u044B\u0442\u044F\u043D\u0443\u043B ${k} \u043A\u0430\u0440\u0442.`);
            } catch {
            }
            G.pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 600;
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
          if (pend.kind === "action_7_block_persona" && String(pend.attackerId) === String(p.id)) {
            try {
              let target = null;
              for (const owner of G.players || []) {
                for (const cc of owner.coalition || []) {
                  if (!cc || cc.type !== "persona") continue;
                  if (baseId2(String(cc.id)) === "persona_31") continue;
                  if (cc.shielded) continue;
                  target = cc;
                  break;
                }
                if (target) break;
              }
              if (target) {
                target.vpDelta = 0;
                target.plusTokens = 0;
                target.minusTokens = 0;
                target.passiveVpDelta = 0;
                target.vp = Number(target.baseVp ?? 0);
                target.blockedAbilities = true;
                recalcPassives(G);
                G.log.push(`${ruYou2(p.name)} (ACTION 7): \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043B ${target.name || target.id}.`);
              }
            } catch {
            }
            G.pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 400;
            return;
          }
          if (pend.kind === "action_13_shield_persona" && String(pend.attackerId) === String(p.id)) {
            try {
              const target = (p.coalition || []).find((c) => c && c.type === "persona");
              if (target) {
                target.shielded = true;
                G.log.push(`${ruYou2(p.name)} \u0437\u0430\u0449\u0438\u0442\u0438\u043B ${target.name || target.id} (ACTION 13).`);
              }
            } catch {
            }
            G.pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 250;
            return;
          }
          if (pend.kind === "action_17_choose_opponent_persona" && String(pend.attackerId) === String(p.id)) {
            try {
              const target = (G.players || []).filter((pp) => String(pp.id) !== String(p.id)).flatMap((pp) => pp.coalition || []).find((c) => c && c.type === "persona" && baseId2(String(c.id)) !== "persona_31" && !c.shielded);
              if (target) {
                const base = baseId2(String(target.id));
                const special = base === "persona_3" || base === "persona_38" || base === "persona_41" || base === "persona_43";
                const tokens = special ? 4 : 2;
                applyTokenDelta2(G, target, -tokens);
                recalcPassives(G);
                G.log.push(`${ruYou2(p.name)} \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043B ${actionTitleByBaseId("action_17")} \u043D\u0430 ${target.name || target.id}: ${special ? "4" : "2"} \xD7 -1.`);
              } else {
                G.log.push(`${ruYou2(p.name)} \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043B ${actionTitleByBaseId("action_17")}, \u043D\u043E \u043D\u0435 \u043D\u0430\u0448\u0451\u043B \u0446\u0435\u043B\u0438.`);
              }
            } catch {
            }
            G.pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 400;
            return;
          }
          if (pend.kind === "action_18_pick_persona_from_discard" && String(pend.attackerId) === String(p.id)) {
            try {
              const idx = (G.discard || []).findIndex((c) => c && c.type === "persona" && baseId2(String(c.id)) !== "persona_31");
              if (idx >= 0) {
                const [c] = G.discard.splice(idx, 1);
                if (c) p.hand.push(c);
                G.log.push(`${ruYou2(p.name)} \u0432\u0435\u0440\u043D\u0443\u043B ${c?.name || c?.id} \u0438\u0437 \u0441\u0431\u0440\u043E\u0441\u0430 \u0432 \u0440\u0443\u043A\u0443 (ACTION 18).`);
              }
            } catch {
            }
            G.pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 400;
            return;
          }
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

          if (pend.kind === "event_16_discard_self_persona_then_draw1" && String(pend.playerId) === String(p.id)) {
            const j = (p.coalition || []).findIndex((c) => c.type === "persona" && baseId2(String(c.id)) !== "persona_31" && !c.shielded);
            if (j >= 0) {
              const [drop] = p.coalition.splice(j, 1);
              if (drop) G.discard.push(drop);
            }
            const next = G.deck.shift();
            if (next) {
              if (next.type === "event") {
                G.lastEvent = next;
                const evName = eventTitle2(next);
                G.log.push(`${ruYou2(p.name)} ${ruDrewVerb(p.name)} ${evName} (\u0438\u0437 "${cardTitle(pend.sourceCardId)}")`);
                runAbility(next.abilityKey, { G, me: p, card: next });
                persona38OnEventPlayed(G, next);
                G.discard.push(next);
              } else {
                p.hand.push(next);
                const srcBid2 = baseId2(String(pend.sourceCardId || ""));
                if (srcBid2 === "event_16") G.log.push(`\u0417\u0430\u0442\u043E \u0432\u0437\u044F\u043B\u0438 \u043A\u0430\u0440\u0442\u0443.`);
                else G.log.push(`${ruYou2(p.name)} \u0432\u0437\u044F\u043B \u043A\u0430\u0440\u0442\u0443 \u0438\u0437 "${cardTitle(pend.sourceCardId)}".`);
              }
            }
            G.pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 600;
            return;
          }
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
              const bid = baseId2(String(c.id));
              if (bid === "action_13") {
                const j = (p.coalition || []).findIndex((cc) => cc.type === "persona" && !cc.shielded);
                if (j >= 0) {
                  const target = p.coalition[j];
                  target.shielded = true;
                  target.shieldedBy = "action_13";
                  G.log.push(`${p.name} \u0440\u0430\u0437\u044B\u0433\u0440\u0430\u043B \u0411\u0435\u043B\u043E\u0435 \u043F\u0430\u043B\u044C\u0442\u043E \u043D\u0430 ${target.name || target.id}`);
                } else {
                  G.log.push(`${p.name} \u0440\u0430\u0437\u044B\u0433\u0440\u0430\u043B \u0411\u0435\u043B\u043E\u0435 \u043F\u0430\u043B\u044C\u0442\u043E, \u043D\u043E \u0432 \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u0438 \u043D\u0435\u0442 \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0435\u0439 \u043F\u0435\u0440\u0441\u043E\u043D\u044B`);
                }
              } else if (bid === "action_5") {
                G.maxPlaysThisTurn = 2;
                G.playVpDelta = -1;
                G.hasPlayed = false;
                G.log.push(`${p.name} \u0440\u0430\u0437\u044B\u0433\u0440\u0430\u043B \u043A\u0443\u043B\u044C\u0442\u0443\u0440\u0443 \u043F\u043E\u043B\u0438\u0442\u0438\u043A\u0438 \u0432 \u0432\u043E\u0441\u0442\u043E\u0447\u043D\u043E\u0439 \u0435\u0432\u0440\u043E\u043F\u0435: \u0440\u0430\u0437\u044B\u0433\u0440\u0430\u0439\u0442\u0435 \u0434\u043E 2-\u0443\u0445 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0435\u0439, \u043D\u043E \u043A\u0430\u0436\u0434\u044B\u0439 \u0432\u044B\u0445\u043E\u0434\u0438\u0442 \u0441 -1`);
              } else {
                G.log.push(`${p.name} played ACTION ${c.name || c.id}.`);
              }
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
      const have22Before = (G.players || []).some((pp) => (pp.coalition || []).some((x) => baseId2(String(x.id)) === "persona_22"));
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
      try {
        if (have22Before && base !== "persona_22") {
          const isLiberal = Array.isArray(c.tags) && c.tags.includes("faction:liberal");
          const isRight = Array.isArray(c.tags) && c.tags.includes("faction:rightwing");
          const delta = isLiberal ? -1 : isRight ? 2 : 0;
          if (delta) {
            for (const pp of G.players || []) {
              for (const cc of pp.coalition || []) {
                if (baseId2(String(cc.id)) === "persona_22") applyTokenDelta2(G, cc, delta);
              }
            }
          }
        }
      } catch {
      }
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
      expireResponseAndResolveDeferred(G);
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      const idxResponse = (me.hand || []).findIndex((c3) => c3.id === cardId);
      const responseCard = idxResponse >= 0 ? me.hand[idxResponse] : null;
      if (nativeAbility('handlesResponse', G, me, responseCard, ctx, playerID)) {
        return nativeAbility('responseAction', G, me, responseCard, ctx, playerID) ? undefined : INVALID_MOVE2;
      }
      if (G.pending) return INVALID_MOVE2;
      if (!G.hasDrawn) return INVALID_MOVE2;
      if (G.hasPlayed) return INVALID_MOVE2;
      if (G.pending) return INVALID_MOVE2;
      if (G.response && !responseExpired(G)) return INVALID_MOVE2;
      const idx = (me.hand || []).findIndex((c2) => c2.id === cardId);
      if (idx === -1) return INVALID_MOVE2;
      const c = me.hand[idx];
      if (c.type !== "action") return INVALID_MOVE2;
      const base = baseId2(c.id);
      if (base === "action_6" || base === "action_8" || base === "action_14") return INVALID_MOVE2;
      if (base === "action_4") {
        const tid = String(targetId ?? "");
        const target = (G.players || []).find((pp) => String(pp.id) === tid);
        if (!target || tid === String(playerID)) return INVALID_MOVE2;
        me.hand.splice(idx, 1);
        nativeAbility('openActionResponse', G, target, c, ctx, playerID);
        G.lastAction = c;
        G.hasPlayed = true;
        G.pending = { kind: "action_4_discard", attackerId: String(playerID), targetId: tid, sourceCardId: String(c.id) };
        let an = actionTitle(c);
        try {
          if (/^action_\d+/u.test(String(an))) an = actionTitleByBaseId(baseId2(String(c.id))) || an;
        } catch {
        }
        const actorName = ruYou2(me.name);
        G.log.push(`${actorName} \u0440\u0430\u0437\u044B\u0433\u0440\u0430\u043B "${an}" \u043D\u0430 ${target.name}.`);
        if (String(target.name || "").startsWith("[B]")) {
          const drop = (target.coalition || [])[0];
          if (drop) {
            target.coalition.splice(0, 1);
            G.discard.push(drop);
            if (drop.type === "persona") persona44OnPersonaDiscarded(G);
            G.log.push(`${target.name} \u0441\u0431\u0440\u043E\u0441\u0438\u043B ${drop.name || drop.id} \u0438\u0437 \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u0438.`);
          } else {
            G.log.push(`${target.name} had no Coalition cards to discard.`);
          }
          G.pending = null;
          try {
            const haveP13 = (target.coalition || []).some((cc) => baseId2(String(cc.id)) === "persona_13");
            const attacker = (G.players || []).find((pp) => String(pp.id) === String(playerID));
            const attackerHasPersona = !!(attacker?.coalition || []).some((cc) => cc.type === "persona");
            if (haveP13 && attacker && attackerHasPersona) {
              const opts = (attacker.coalition || []).filter((cc) => cc && cc.type === "persona" && baseId2(String(cc.id)) !== "persona_31" && !cc.shielded);
              if (opts.length) {
                applyTokenDelta2(G, opts[0], -1);
                recalcPassives(G);
                G.log.push(`${target.name} (\u0412\u0435\u043D\u0435\u0434\u0438\u0442\u043A\u043E\u0432): \u0434\u0430\u043B -1 \u043D\u0430 ${opts[0].name || opts[0].id}.`);
              }
            }
          } catch {
          }
          maybeTriggerRoundEnd(G, ctx);
          if (maybeEndAfterRound(G, ctx, events)) return;
          events.endTurn?.();
        }
        return;
      }
      if (base === "action_9") {
        const tid = String(targetId ?? "");
        const target = (G.players || []).find((pp) => String(pp.id) === tid);
        if (!target || tid === String(playerID)) return INVALID_MOVE2;
        me.hand.splice(idx, 1);
        nativeAbility('openActionResponse', G, target, c, ctx, playerID);
        G.lastAction = c;
        G.hasPlayed = true;
        G.pending = { kind: "action_9_discard_persona", attackerId: String(playerID), targetId: tid, sourceCardId: String(c.id) };
        G.log.push(`${ruYou2(me.name)} \u0440\u0430\u0437\u044B\u0433\u0440\u0430\u043B \u0412\u044B\u0432\u043E\u0434 \u0432\u043E \u0432\u043D\u0435\u0448\u043D\u0438\u0439 \u043A\u043E\u043D\u0442\u0443\u0440 \u043D\u0430 ${target.name}.`);
        if (String(target.name || "").startsWith("[B]")) {
          const j = (target.coalition || []).findIndex((cc) => cc.type === "persona");
          if (j >= 0) {
            const [drop] = target.coalition.splice(j, 1);
            if (drop) {
              G.discard.push(drop);
              if (drop.type === "persona") persona44OnPersonaDiscarded(G);
              G.log.push(`${target.name} \u0441\u0431\u0440\u043E\u0441\u0438\u043B ${drop.name || drop.id} \u0438\u0437 \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u0438.`);
            }
          } else {
            G.log.push(`${target.name} had no persona to discard.`);
          }
          G.pending = null;
          try {
            const haveP13 = (target.coalition || []).some((cc) => baseId2(String(cc.id)) === "persona_13");
            const attacker = (G.players || []).find((pp) => String(pp.id) === String(playerID));
            const attackerHasPersona = !!(attacker?.coalition || []).some((cc) => cc.type === "persona");
            if (haveP13 && attacker && attackerHasPersona) {
              const opts = (attacker.coalition || []).filter((cc) => cc && cc.type === "persona" && baseId2(String(cc.id)) !== "persona_31" && !cc.shielded);
              if (opts.length) {
                applyTokenDelta2(G, opts[0], -1);
                recalcPassives(G);
                G.log.push(`${target.name} (\u0412\u0435\u043D\u0435\u0434\u0438\u0442\u043A\u043E\u0432): \u0434\u0430\u043B -1 \u043D\u0430 ${opts[0].name || opts[0].id}.`);
              }
            }
          } catch {
          }
          maybeTriggerRoundEnd(G, ctx);
          if (maybeEndAfterRound(G, ctx, events)) return;
          events.endTurn?.();
        }
        return;
      }
      if (base === "action_5") {
        me.hand.splice(idx, 1);
        G.discard.push(c);
        G.lastAction = c;
        G.log.push(`${ruYou2(me.name)} \u0440\u0430\u0437\u044B\u0433\u0440\u0430\u043B\u0438 \u043A\u0443\u043B\u044C\u0442\u0443\u0440\u0443 \u043F\u043E\u043B\u0438\u0442\u0438\u043A\u0438 \u0432 \u0432\u043E\u0441\u0442\u043E\u0447\u043D\u043E\u0439 \u0435\u0432\u0440\u043E\u043F\u0435: \u0440\u0430\u0437\u044B\u0433\u0440\u0430\u0439\u0442\u0435 \u0434\u043E 2-\u0443\u0445 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0435\u0439, \u043D\u043E \u043A\u0430\u0436\u0434\u044B\u0439 \u0432\u044B\u0445\u043E\u0434\u0438\u0442 \u0441 -1`);
        G.maxPlaysThisTurn = 2;
        G.playVpDelta = -1;
        return;
      }
      if (base === "action_7") {
        me.hand.splice(idx, 1);
        G.discard.push(c);
        G.lastAction = c;
        G.hasPlayed = true;
        G.pending = { kind: "action_7_block_persona", attackerId: String(playerID) };
        G.log.push(`${ruYou2(me.name)} \u0441\u044B\u0433\u0440\u0430\u043B \xAB\u0418\u041D\u041E\u0410\u0413\u0415\u041D\u0422\xBB: \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u0435\u0440\u0441\u043E\u043D\u0443 \u0432 \u043B\u044E\u0431\u043E\u0439 \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u0438.`);
        return;
      }
      if (base === "action_13") {
        me.hand.splice(idx, 1);
        G.discard.push(c);
        G.lastAction = c;
        G.hasPlayed = true;
        G.pending = { kind: "action_13_shield_persona", attackerId: String(playerID) };
        const an = actionTitle(c) || "\u0411\u0435\u043B\u043E\u0435 \u043F\u0430\u043B\u044C\u0442\u043E";
        G.log.push(`${ruYou2(me.name)} \u0440\u0430\u0437\u044B\u0433\u0440\u0430\u043B \xAB${an}\xBB: \u0437\u0430\u0449\u0438\u0449\u0430\u0435\u0442 \u043E\u0434\u043D\u043E\u0433\u043E \u0438\u0437 \u0432\u0430\u0448\u0438\u0445 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0435\u0439.`);
        return;
      }
      if (base === "action_17") {
        me.hand.splice(idx, 1);
        G.discard.push(c);
        G.lastAction = c;
        G.hasPlayed = true;
        G.pending = { kind: "action_17_choose_opponent_persona", attackerId: String(playerID) };
        nativeAbility('openUntargetedResponse', G, null, c, ctx, playerID);
        return;
      }
      if (base === "action_18") {
        me.hand.splice(idx, 1);
        G.discard.push(c);
        G.lastAction = c;
        G.hasPlayed = true;
        const hasValidPersonaInDiscard = (G.discard || []).some((x) => x && x.type === "persona" && baseId2(String(x.id)) !== "persona_31");
        if (!hasValidPersonaInDiscard) {
          G.pending = null;
          G.log.push(`${ruYou2(me.name)} разыграл ${actionTitleByBaseId("action_18") || c.name || c.id}, но в сбросе нет подходящих персонажей.`);
          maybeTriggerRoundEnd(G, ctx);
          if (maybeEndAfterRound(G, ctx, events)) return;
          events.endTurn?.();
          return;
        }
        G.pending = { kind: "action_18_pick_persona_from_discard", attackerId: String(playerID) };
        return;
      }
      me.hand.splice(idx, 1);
      G.discard.push(c);
      G.lastAction = c;
      G.hasPlayed = true;
      G.log.push(`${me.name} played ACTION ${c.name || c.id}.`);
      maybeTriggerRoundEnd(G, ctx);
      if (maybeEndAfterRound(G, ctx, events)) return;
      events.endTurn?.();
    },
    discardFromCoalition: ({ G, playerID, ctx, events }, cardId) => {
      if (G.response && responseExpired(G)) G.response = null;
      const pending = G.pending;
      if (!pending || pending.kind !== "action_4_discard" && pending.kind !== "action_9_discard_persona") return INVALID_MOVE2;
      if (String(playerID) !== String(pending.targetId)) return INVALID_MOVE2;
      const target = (G.players || []).find((pp) => String(pp.id) === String(pending.targetId));
      if (!target) return INVALID_MOVE2;
      const idx = (target.coalition || []).findIndex((c) => c.id === cardId);
      if (idx === -1) return INVALID_MOVE2;
      const drop = target.coalition[idx];
      if (pending.kind === "action_9_discard_persona" && drop?.type !== "persona") return INVALID_MOVE2;
      if (drop?.type === "persona" && baseId2(String(drop.id)) === "persona_31") return INVALID_MOVE2;
      if (drop?.shielded) return INVALID_MOVE2;
      target.coalition.splice(idx, 1);
      if (drop) {
        G.discard.push(drop);
        if (drop.type === "persona") persona44OnPersonaDiscarded(G);
        G.log.push(`${target.name} \u0441\u0431\u0440\u043E\u0441\u0438\u043B ${drop.name || drop.id} \u0438\u0437 \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u0438.`);
      }
      G.pending = null;
      try {
        const haveP13 = (target.coalition || []).some((c) => baseId2(String(c.id)) === "persona_13");
        const attacker = (G.players || []).find((pp) => String(pp.id) === String(pending.attackerId));
        const attackerHasPersona = !!(attacker?.coalition || []).some((c) => c.type === "persona");
        if (haveP13 && attacker && attackerHasPersona) {
          G.pending = { kind: "persona_13_pick_target", playerId: String(target.id), attackerId: String(attacker.id), sourceCardId: String(pending.sourceCardId || "") };
          return;
        }
      } catch {
      }
      maybeTriggerRoundEnd(G, ctx);
      if (maybeEndAfterRound(G, ctx, events)) return;
      events.endTurn?.();
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
