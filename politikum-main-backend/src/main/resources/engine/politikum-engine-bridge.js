
const INVALID_MOVE = "__INVALID_MOVE__";
const INVALID_MOVE2 = INVALID_MOVE;
function deepClone(v){ return v == null ? v : JSON.parse(JSON.stringify(v)); }
function drawTopCardForPlayer2(G, p){
  const c = G?.deck?.shift?.();
  if (!c || !p) return null;
  if (c.type === "event") {
    G.lastEvent = c;
    const evName = eventTitle2(c);
    const bid = baseId2(String(c.id));
    if (!(bid === "event_1" || bid === "event_2" || bid === "event_3" || bid === "event_10" || bid === "event_15")) {
      if (bid === "event_12b") G.log.push(`${ruYou2(p.name)} ${ruDrewVerb(p.name)} \u0421\u0440\u0430\u0447 \u0432 \u0422\u0432\u0438\u0442\u0442\u0435\u0440\u0435: \u0421\u0435\u043A\u0441 \u0441\u043A\u0430\u043D\u0434\u0430\u043B!`);
      else if (bid === "event_12c") G.log.push(`${ruYou2(p.name)} ${ruDrewVerb(p.name)} "${evName}"`);
      else G.log.push(`${ruYou2(p.name)} ${ruDrewVerb(p.name)} ${evName}`);
    }
    try {
      if (Array.isArray(c.tags) && c.tags.includes("event_type:twitter_squabble")) {
        for (const pp of G.players || []) {
          for (const cc of pp.coalition || []) {
            if (baseId2(String(cc.id)) === "persona_4") applyTokenDelta2(G, cc, -2);
          }
        }
      }
    } catch {}
    runAbility(c.abilityKey, { G, me: p, card: c });
    persona38OnEventPlayed(G, c);
    recalcPassives(G);
    G.discard.push(c);
  } else {
    p.hand.push(c);
    G.log.push(`${p.name} \u0431\u0435\u0440\u0435\u0442 \u043A\u0430\u0440\u0442\u0443`);
  }
  return c;
}
function numPlayersOf(state){ return Number(state?.ctx?.numPlayers || state?.G?.players?.length || 5) || 5; }
function activeIds(state){
  const ids = (state?.G?.activePlayerIds || []).map(x => String(x));
  if (ids.length) return ids;
  const n = numPlayersOf(state);
  return Array.from({length:n}, (_,i)=>String(i));
}
function computeNextPlayer(state, current){
  const ids = activeIds(state);
  if (!ids.length) return String(current || '0');
  const cur = String(current ?? state?.ctx?.currentPlayer ?? ids[0]);
  const i = ids.indexOf(cur);
  return ids[(i >= 0 ? i + 1 : 0) % ids.length];
}
function syncPlayOrderPos(state){
  const ids = activeIds(state);
  const cur = String(state.ctx.currentPlayer || ids[0] || '0');
  const i = ids.indexOf(cur);
  state.ctx.playOrderPos = i >= 0 ? i : 0;
}
function runTurnOnBegin(state){
  const ph = PolitikumGame?.phases?.[state?.ctx?.phase || ''];
  const fn = ph?.turn?.onBegin;
  if (typeof fn === 'function') fn({ G: state.G, ctx: state.ctx, events: makeEvents(state) });
}
function runTurnOnEnd(state){
  const ph = PolitikumGame?.phases?.[state?.ctx?.phase || ''];
  const fn = ph?.turn?.onEnd;
  if (typeof fn === 'function') fn({ G: state.G, ctx: state.ctx, events: makeEvents(state) });
}
function applySetPhase(state, phase){
  state.ctx.phase = String(phase || state.ctx.phase || 'lobby');
}
function applyEndTurn(state, payload){
  try { runTurnOnEnd(state); } catch (e) {}
  const next = payload && payload.next != null ? String(payload.next) : computeNextPlayer(state);
  state.ctx.currentPlayer = String(next || '0');
  state.ctx.turn = Number(state.ctx.turn || 0) + 1;
  syncPlayOrderPos(state);
  try { runTurnOnBegin(state); } catch (e) {}
}
function makeEvents(state){
  const queue = state.__eventQueue || (state.__eventQueue = []);
  return {
    endTurn(payload){ queue.push({ type:'endTurn', payload: payload || null }); },
    setPhase(phase){ queue.push({ type:'setPhase', payload: phase }); },
    endGame(payload){ state.ctx.gameover = payload || true; state.G.gameOver = payload || true; }
  };
}
function flushEvents(state){
  const queue = state.__eventQueue || [];
  while (queue.length){
    const evt = queue.shift();
    if (!evt) continue;
    if (evt.type === 'setPhase') applySetPhase(state, evt.payload);
    else if (evt.type === 'endTurn') applyEndTurn(state, evt.payload || null);
  }
  state.__eventQueue = [];
}
function createMatchState(numPlayers){
  const ctx = { numPlayers: Number(numPlayers || 5) || 5, phase: 'lobby', currentPlayer: '0', playOrderPos: 0, turn: 0, gameover: null };
  const G = PolitikumGame.setup({ ctx: ctx });
  const state = { G, ctx, _stateID: 0 };
  syncPlayOrderPos(state);
  return state;
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
// src/lobby.ts
var CitadelChatLobby = {
  name: "citadel-lobby",
  setup: () => ({ chat: [] }),
  moves: {
    submitChat: ({ G }, payload) => {
      const msg = typeof payload === "string" ? { sender: "System", text: payload } : payload;
      const next = { ...msg, timestamp: Date.now() };
      G.chat.push(next);
      if (G.chat.length > 50) G.chat.shift();
    }
  }
};

// src/game.ts
var MEDIEVAL_NAMES = ["Aethelred", "Baldwin", "Cedric", "Dunstan", "Eadric", "Florian", "Godfrey", "Hildegard", "Isolde", "Jocelyn", "Kenric", "Leofric"];
var ROLES = [
  { id: 1, name: "Assassin", img: "/assets/characters/assassin.jpg" },
  { id: 2, name: "Thief", img: "/assets/characters/thief.jpg" },
  { id: 3, name: "Magician", img: "/assets/characters/magician.jpg" },
  { id: 4, name: "Queen", img: "/assets/characters/queen.jpg" },
  { id: 5, name: "Bishop", img: "/assets/characters/bishop.jpg" },
  { id: 6, name: "Merchant", img: "/assets/characters/merchant.jpg" },
  { id: 7, name: "Architect", img: "/assets/characters/architect.jpg" },
  { id: 8, name: "Warlord", img: "/assets/characters/warlord.jpg" }
];
var DISTRICTS = [
  // Noble
  { id: 101, name: "Manor", cost: 3, color: "noble", img: "/assets/buildings/manor2.jpg" },
  { id: 102, name: "Castle", cost: 4, color: "noble", img: "/assets/buildings/castle3.jpg" },
  { id: 103, name: "Palace", cost: 5, color: "noble", img: "/assets/buildings/palace2.jpg" },
  // Trade
  { id: 201, name: "Tavern", cost: 1, color: "trade", img: "/assets/buildings/tavern.jpg" },
  { id: 202, name: "Market", cost: 2, color: "trade", img: "/assets/buildings/market.jpg" },
  { id: 206, name: "Trading Post", cost: 2, color: "trade", img: "/assets/buildings/trading%20post.jpg" },
  { id: 203, name: "Docks", cost: 3, color: "trade", img: "/assets/buildings/Docks.jpg" },
  { id: 204, name: "Harbor", cost: 4, color: "trade", img: "/assets/buildings/harbor.jpg" },
  { id: 205, name: "Town Hall", cost: 5, color: "trade", img: "/assets/buildings/town%20hall.jpg" },
  // Religious
  { id: 301, name: "Temple", cost: 1, color: "religious", img: "/assets/buildings/chapel2.jpg" },
  { id: 302, name: "Church", cost: 2, color: "religious", img: "/assets/buildings/church2.jpg" },
  { id: 303, name: "Monastery", cost: 3, color: "religious", img: "/assets/buildings/monastery2.jpg" },
  { id: 304, name: "Cathedral", cost: 5, color: "religious", img: "/assets/buildings/cathedral4.jpg" },
  // Military
  { id: 401, name: "Watchtower", cost: 1, color: "military", img: "/assets/buildings/watchtower2.jpg" },
  { id: 402, name: "Prison", cost: 2, color: "military", img: "/assets/buildings/prison3.jpg" },
  { id: 403, name: "Barracks", cost: 3, color: "military", img: "/assets/buildings/barracks2.jpg" },
  { id: 404, name: "Fortress", cost: 5, color: "military", img: "/assets/buildings/Fortress2.jpg" },
  // Unique (purple)
  { id: 501, name: "Library", cost: 6, color: "unique", img: "/assets/buildings/library.jpg" },
  { id: 502, name: "Smithy", cost: 5, color: "unique", img: "/assets/buildings/smithy2.jpg" },
  { id: 503, name: "Observatory", cost: 4, color: "unique", img: "/assets/buildings/observatory.jpg" },
  { id: 504, name: "Graveyard", cost: 5, color: "unique", img: "/assets/buildings/graveyard.jpg" },
  { id: 505, name: "Laboratory", cost: 5, color: "unique", img: "/assets/buildings/Laboratory2.jpg" },
  { id: 506, name: "Keep", cost: 3, color: "unique", img: "/assets/buildings/keep.jpg" },
  { id: 507, name: "Haunted Quarter", cost: 2, color: "unique", img: "/assets/buildings/haunted%20quarter.jpg" },
  { id: 508, name: "Great Wall", cost: 6, color: "unique", img: "/assets/buildings/great%20wall.jpg" },
  { id: 509, name: "Magic School", cost: 6, color: "unique", img: "/assets/buildings/magic%20school.jpg" },
  { id: 510, name: "Imperial Treasury", cost: 5, color: "unique", img: "/assets/buildings/imperial%20treasury.jpg" },
  { id: 511, name: "Map Room", cost: 5, color: "unique", img: "/assets/buildings/map%20room.jpg" },
  { id: 512, name: "University", cost: 6, color: "unique", img: "/assets/buildings/University.jpg" },
  { id: 513, name: "Dragon Gate", cost: 6, color: "unique", img: "/assets/buildings/dragon%20gate.jpg" }
];
function setupCharacterDeck(G) {
  const rolesPool = [...ROLES];
  for (let i = rolesPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rolesPool[i], rolesPool[j]] = [rolesPool[j], rolesPool[i]];
  }
  G.removedFaceDownRole = rolesPool.splice(0, 1)[0];
  let faceUpCount = 0;
  if (G.players.length === 4) faceUpCount = 2;
  else if (G.players.length === 5) faceUpCount = 1;
  G.removedFaceUpRoles = [];
  for (let i = 0; i < faceUpCount; i++) {
    let idx = rolesPool.findIndex((r) => r.id !== 4);
    if (idx !== -1) {
      G.removedFaceUpRoles.push(rolesPool.splice(idx, 1)[0]);
    }
  }
  G.availableRoles = rolesPool.sort((a, b) => a.id - b.id);
}
function advanceRole(G, events) {
  let nextRole = G.activeRoleId + 1;
  let found = false;
  while (nextRole <= 8 && !found) {
    const nextP = G.players.find((pl) => pl.role?.id === nextRole);
    if (nextP) {
      found = true;
      G.activeRoleId = nextRole;
      G.log.push(`The ${nextP.role.name} steps forward.`);
      if (nextRole === G.killedRoleId) {
        nextP.isKilled = true;
        G.log.push(`The ${nextP.role.name} was found dead!`);
        nextP.hasTakenIncomeThisTurn = false;
        nextP.hasTakenAction = false;
        nextP.builtThisTurn = 0;
        nextP.abilityUsed = false;
        nextRole++;
        found = false;
        continue;
      }
      if (nextRole === G.robbedRoleId) {
        const robber = G.players[G.robberPlayerId];
        if (robber && !robber.isKilled) {
          const loot = nextP.gold;
          nextP.gold = 0;
          robber.gold += loot;
          G.log.push(`The ${nextP.role.name} was robbed of ${loot} gold!`);
        }
        G.robbedRoleId = null;
      }
      nextP.roleRevealed = true;
      nextP.hasTakenIncomeThisTurn = false;
      nextP.hasTakenAction = false;
      nextP.builtThisTurn = 0;
      nextP.abilityUsed = false;
      nextP.usedUniqueThisTurn = {};
      nextP.interaction = null;
      nextP.buildLimit = nextRole === 7 ? 3 : 1;
      if (nextRole === 7) {
        const bonus = G.deck.splice(0, 2);
        nextP.hand.push(...bonus);
        G.log.push(`${nextP.name} (Architect) drew ${bonus.length} extra cards.`);
      }
      events.endTurn({ next: nextP.id });
    } else {
      nextRole++;
    }
  }
  if (!found) {
    if (G.firstToFinishId !== null) {
      G.players.forEach((p) => {
        p.score = p.city.reduce((acc, c) => acc + c.cost, 0);
        if (p.id === G.firstToFinishId) p.score += 4;
      });
      events.setPhase("results");
    } else {
      G.players.forEach((pl) => {
        pl.role = null;
        pl.roleRevealed = false;
        pl.isKilled = false;
      });
      G.activeRoleId = 0;
      G.killedRoleId = null;
      G.robbedRoleId = null;
      events.setPhase("draft");
      events.endTurn({ next: G.kingId });
    }
  }
}
var canPlayerBuildAny = (p) => {
  if (p.builtThisTurn >= p.buildLimit) return false;
  return p.hand.some((card) => p.gold >= card.cost && !p.city.some((c) => c.name === card.name));
};
var canPlayerUseAbility = (p) => {
  if (p.abilityUsed) return false;
  return [1, 2, 3, 8].includes(p.role?.id);
};
var canPlayerUseUnique = (p) => {
  const used = p.usedUniqueThisTurn || {};
  const handN = (p.hand || []).length;
  if (hasUnique(p, "Smithy") && !used.smithy && (p.gold || 0) >= 2) return true;
  if (hasUnique(p, "Laboratory") && !used.lab && handN > 0) return true;
  return false;
};
var hasUnique = (p, name) => (p.city || []).some((c) => c.name === name);
var checkAutoEnd = (G, playerID, events) => {
  const p = G.players[playerID];
  const hasUsedUnique = !!(p.usedUniqueThisTurn && Object.values(p.usedUniqueThisTurn).some(Boolean));
  const started = !!p.hasTakenIncomeThisTurn || p.builtThisTurn > 0 || !!p.abilityUsed || hasUsedUnique;
  if (!started) return;
  if (canPlayerBuildAny(p)) return;
  if (canPlayerUseAbility(p)) return;
  if (canPlayerUseUnique(p)) return;
  G.log.push(`(Auto-ending ${p.name}'s turn - no actions left)`);
  p.hasTakenIncomeThisTurn = false;
  p.hasTakenAction = false;
  p.builtThisTurn = 0;
  p.abilityUsed = false;
  p.interaction = null;
  advanceRole(G, events);
};
var CitadelGame = {
  name: "citadel",
  setup: ({ ctx }) => ({
    players: Array(ctx.numPlayers).fill(null).map((_, id) => ({
      id: String(id),
      name: id === 0 ? `Player 0` : `[B] ${MEDIEVAL_NAMES[Math.floor(Math.random() * MEDIEVAL_NAMES.length)]}`,
      gold: 2,
      hand: [],
      city: [],
      role: null,
      roleRevealed: false,
      tempChoices: [],
      hasTakenIncomeThisTurn: false,
      hasTakenAction: false,
      builtThisTurn: 0,
      buildLimit: 1,
      isKilled: false,
      isRobbed: false,
      abilityUsed: false,
      usedUniqueThisTurn: {},
      score: 0,
      isBot: id === 0 ? false : true
    })),
    deck: DISTRICTS,
    availableRoles: [],
    removedFaceUpRoles: [],
    removedFaceDownRole: null,
    districtDiscard: [],
    kingId: "0",
    activeRoleId: 0,
    killedRoleId: null,
    robbedRoleId: null,
    robberPlayerId: null,
    isGameOver: false,
    firstToFinishId: null,
    log: ["Multiplayer Citadel Initialized"],
    chat: [],
    sfx: null
  }),
  moves: {
    updatePlayerName: ({ G, playerID }, name) => {
      if (G.players[playerID]) {
        G.players[playerID].name = name;
        G.players[playerID].isBot = false;
      }
    },
    clearSfx: ({ G }) => {
      G.sfx = null;
    },
    // DEV CHEATS (temporary): grant/build uniques without RNG for testing.
    devGiveDistrict: ({ G, playerID }, name) => {
      if (playerID !== "0") return INVALID_MOVE;
      const p = G.players[playerID];
      const card = (G.deck || []).find((c) => c.name === name) || (DISTRICTS || []).find((c) => c.name === name);
      if (!card) return INVALID_MOVE;
      p.hand.push({ ...card });
      G.log.push(`[DEV] Gave ${p.name} district: ${name}`);
    },
    devBuildFree: ({ G, playerID }, name) => {
      if (playerID !== "0") return INVALID_MOVE;
      const p = G.players[playerID];
      const idx = p.hand.findIndex((c) => c.name === name);
      if (idx === -1) return INVALID_MOVE;
      const card = p.hand.splice(idx, 1)[0];
      p.city.push(card);
      G.log.push(`[DEV] Built for free: ${name}`);
    },
    devSetGold: ({ G, playerID }, amount) => {
      if (playerID !== "0") return INVALID_MOVE;
      const p = G.players[playerID];
      p.gold = Number(amount) || 0;
      G.log.push(`[DEV] Set gold=${p.gold}`);
    },
    addBot: ({ G, playerID }) => {
      if (playerID !== "0") return INVALID_MOVE;
      const freeSeat = G.players.find((p) => !p.isBot && !p.name.startsWith("[H] "));
      if (freeSeat) {
        freeSeat.isBot = true;
        freeSeat.name = `[B] ${MEDIEVAL_NAMES[Math.floor(Math.random() * MEDIEVAL_NAMES.length)]}`;
        G.log.push(`${freeSeat.name} has joined the hall.`);
      }
    },
    removePlayer: ({ G, playerID }, targetId) => {
      if (playerID !== "0" || targetId === "0") return INVALID_MOVE;
      const p = G.players.find((pl) => pl.id === targetId);
      if (p) {
        G.log.push(`${p.name} has been dismissed from the hall.`);
        p.isBot = false;
        p.name = `[H] ${MEDIEVAL_NAMES[Math.floor(Math.random() * MEDIEVAL_NAMES.length)]}`;
      }
    },
    submitChat: ({ G, playerID }, text) => {
      if (!text || text.trim() === "") return;
      const name = G.players[playerID]?.name || `Player ${playerID}`;
      G.chat.push({ sender: name, text: text.trim(), timestamp: Date.now() });
      if (G.chat.length > 50) G.chat.shift();
    },
    submitBotAction: ({ G, ctx, events, playerID }, actionType, payload) => {
      if (playerID !== "0") return INVALID_MOVE;
      const botId = ctx.currentPlayer;
      const bot = G.players[botId];
      if (!bot || !bot.isBot) return INVALID_MOVE;
      switch (actionType) {
        case "PICK_ROLE": {
          const roleId = payload?.roleId;
          if (bot.role !== null) return INVALID_MOVE;
          const role = G.availableRoles.find((r) => r.id === roleId);
          if (!role) return INVALID_MOVE;
          bot.role = role;
          G.availableRoles = G.availableRoles.filter((r) => r.id !== roleId);
          G.log.push(`A role has been claimed in secret.`);
          events.endTurn();
          break;
        }
        case "TAKE_GOLD": {
          if (bot.hasTakenIncomeThisTurn || bot.isKilled) return INVALID_MOVE;
          bot.gold += 2;
          bot.hasTakenIncomeThisTurn = true;
          bot.hasTakenAction = true;
          G.log.push(`${bot.name} took 2 gold.`);
          checkAutoEnd(G, botId, events);
          break;
        }
        case "KEEP_CARD": {
          const cardId = payload?.cardId;
          const card = bot.tempChoices.find((c) => c.id === cardId);
          const discarded = bot.tempChoices.find((c) => c.id !== cardId);
          if (!card) return INVALID_MOVE;
          bot.hand.push(card);
          if (discarded) G.deck.push(discarded);
          bot.tempChoices = [];
          G.log.push(`${bot.name} added a plan.`);
          checkAutoEnd(G, botId, events);
          break;
        }
        case "BUILD_DISTRICT": {
          const cardId = payload?.cardId;
          if (bot.isKilled) return INVALID_MOVE;
          const cardIndex = bot.hand.findIndex((c) => c.id === cardId);
          if (cardIndex === -1 || bot.gold < bot.hand[cardIndex].cost || bot.builtThisTurn >= bot.buildLimit) return INVALID_MOVE;
          if (bot.city.some((c) => c.name === bot.hand[cardIndex].name)) return INVALID_MOVE;
          bot.gold -= bot.hand[cardIndex].cost;
          const built = bot.hand.splice(cardIndex, 1)[0];
          bot.city.push(built);
          bot.builtThisTurn += 1;
          G.log.push(`${bot.name} constructed ${built.name}.`);
          if (bot.city.length >= 8 && !G.firstToFinishId) {
            G.firstToFinishId = botId;
            G.log.push(`${bot.name} has completed their city!`);
          }
          checkAutoEnd(G, botId, events);
          break;
        }
        case "RESOLVE_INTERACTION": {
          const p = bot;
          if (payload.type === "ASSASSINATE") {
            G.killedRoleId = payload.target;
            p.abilityUsed = true;
            const targetName = ROLES.find((r) => r.id === payload.target).name;
            G.log.push(`${p.name} has marked the ${targetName} for death.`);
          } else if (payload.type === "STEAL") {
            G.robbedRoleId = payload.target;
            G.robberPlayerId = botId;
            p.abilityUsed = true;
            const targetName = ROLES.find((r) => r.id === payload.target).name;
            G.log.push(`${p.name} plans to rob the ${targetName}.`);
          } else if (payload.type === "DESTROY") {
            const targetP = G.players.find((pl) => pl.id === payload.playerId);
            const cardIdx = targetP?.city.findIndex((c) => c.id === payload.cardId);
            if (cardIdx !== -1) {
              const card = targetP.city.splice(cardIdx, 1)[0];
              const cost = Math.max(0, card.cost - 1);
              p.gold -= cost;
              G.log.push(`${p.name} razed ${card.name} from ${targetP.name}'s city.`);
            }
          }
          p.interaction = null;
          checkAutoEnd(G, botId, events);
          break;
        }
        case "END_TURN": {
          G.log.push(`${bot.name} finishes turn.`);
          bot.hasTakenIncomeThisTurn = false;
          bot.hasTakenAction = false;
          bot.builtThisTurn = 0;
          bot.abilityUsed = false;
          bot.interaction = null;
          advanceRole(G, events);
          break;
        }
        default:
          return INVALID_MOVE;
      }
    },
    startGame: ({ G, ctx, events }) => {
      G.log.push("Queen: Shuffling Deck and Blueprints...");
      G.deck = [...G.deck].sort(() => Math.random() - 0.5);
      G.players.forEach((p) => {
        p.hand = G.deck.splice(0, 4);
      });
      events.setPhase("draft");
    },
    pickRole: ({ G, playerID, events, ctx }, roleId) => {
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
      if (G.players[playerID].role !== null) return INVALID_MOVE;
      const role = G.availableRoles.find((r) => r.id === roleId);
      if (!role) return INVALID_MOVE;
      G.players[playerID].role = role;
      G.players[playerID].roleRevealed = false;
      G.availableRoles = G.availableRoles.filter((r) => r.id !== roleId);
      G.log.push(`A role has been claimed in secret.`);
      events.endTurn();
    },
    takeGold: ({ G, playerID, ctx, events }) => {
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
      if (ctx.phase !== "action") return INVALID_MOVE;
      const p = G.players[playerID];
      if (p.hasTakenIncomeThisTurn || p.isKilled) return INVALID_MOVE;
      p.gold += 2;
      p.hasTakenIncomeThisTurn = true;
      p.hasTakenAction = true;
      G.log.push(`${p.name} took 2 gold.`);
      G.sfx = { name: "coin", at: Date.now() };
      checkAutoEnd(G, playerID, events);
    },
    drawCards: ({ G, playerID, ctx }) => {
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
      if (ctx.phase !== "action") return INVALID_MOVE;
      const p = G.players[playerID];
      if (p.hasTakenIncomeThisTurn || p.isKilled) return INVALID_MOVE;
      const drawN = hasUnique(p, "Observatory") ? 3 : 2;
      const drawn = G.deck.splice(0, drawN);
      p.hasTakenIncomeThisTurn = true;
      p.hasTakenAction = true;
      if (hasUnique(p, "Library")) {
        p.hand.push(...drawn);
        p.tempChoices = [];
        G.log.push(`${p.name} drew ${drawn.length} cards (Library).`);
        return;
      }
      p.tempChoices = drawn;
      G.log.push(`${p.name} is studying blueprints...`);
    },
    keepCard: ({ G, playerID, ctx, events }, cardId) => {
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
      const p = G.players[playerID];
      const card = p.tempChoices.find((c) => c.id === cardId);
      const discarded = p.tempChoices.find((c) => c.id !== cardId);
      if (!card) return INVALID_MOVE;
      p.hand.push(card);
      if (discarded) G.deck.push(discarded);
      p.tempChoices = [];
      G.log.push(`${p.name} added a plan.`);
      checkAutoEnd(G, playerID, events);
    },
    buildDistrict: ({ G, playerID, ctx, events }, cardId) => {
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
      if (ctx.phase !== "action") return INVALID_MOVE;
      const p = G.players[playerID];
      if (p.isKilled) return INVALID_MOVE;
      const cardIndex = p.hand.findIndex((c) => c.id === cardId);
      if (cardIndex === -1 || p.gold < p.hand[cardIndex].cost || p.builtThisTurn >= p.buildLimit) return INVALID_MOVE;
      if (p.city.some((c) => c.name === p.hand[cardIndex].name)) return INVALID_MOVE;
      p.gold -= p.hand[cardIndex].cost;
      const built = p.hand.splice(cardIndex, 1)[0];
      p.city.push(built);
      p.builtThisTurn += 1;
      G.log.push(`${p.name} constructed ${built.name}.`);
      G.sfx = { name: "drop_002", at: Date.now() };
      if (p.city.length >= 8 && !G.firstToFinishId) {
        G.firstToFinishId = playerID;
        G.log.push(`${p.name} has completed their city!`);
      }
      checkAutoEnd(G, playerID, events);
    },
    resolveInteraction: ({ G, playerID, ctx, events }, payload) => {
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
      const p = G.players[playerID];
      if (payload.type === "CANCEL") {
        G.players[playerID].interaction = null;
        return;
      }
      if (payload.type === "ASSASSINATE") {
        G.killedRoleId = payload.target;
        p.abilityUsed = true;
        const targetName = ROLES.find((r) => r.id === payload.target).name;
        G.log.push(`${p.name} has marked the ${targetName} for death.`);
        G.sfx = { name: "assassin", at: Date.now() };
      } else if (payload.type === "STEAL") {
        G.robbedRoleId = payload.target;
        G.robberPlayerId = playerID;
        p.abilityUsed = true;
        const targetName = ROLES.find((r) => r.id === payload.target).name;
        G.log.push(`${p.name} plans to rob the ${targetName}.`);
      } else if (payload.type === "MAGIC") {
        if (payload.target === "SWAP_PLAYER") {
          const options = G.players.filter((pl) => pl.id !== playerID).map((pl) => pl.id);
          p.interaction = { type: "MAGIC_SWAP_PLAYER", options };
          return;
        }
        if (payload.target === "SWAP_DECK") {
          const options = (p.hand || []).map((c) => c.id);
          p.interaction = { type: "MAGIC_SWAP_DECK", options };
          return;
        }
      } else if (payload.type === "MAGIC_SWAP_PLAYER") {
        const otherId = payload.target;
        const other = G.players.find((pl) => pl.id === otherId);
        if (other && other.id !== playerID) {
          const tmp = p.hand;
          p.hand = other.hand;
          other.hand = tmp;
          p.abilityUsed = true;
          G.log.push(`${p.name} swapped hands with ${other.name} (Magician).`);
        }
      } else if (payload.type === "MAGIC_SWAP_DECK") {
        const selectedIds = Array.isArray(payload.selectedIds) ? payload.selectedIds : (p.hand || []).map((c) => c.id);
        const selected = (p.hand || []).filter((c) => selectedIds.includes(c.id));
        const keep = (p.hand || []).filter((c) => !selectedIds.includes(c.id));
        const count = selected.length;
        if (count > 0) {
          const drawn = G.deck.splice(0, count);
          p.hand = [...keep, ...drawn];
          G.districtDiscard = G.districtDiscard || [];
          G.districtDiscard.push(...selected);
          p.abilityUsed = true;
          G.log.push(`${p.name} exchanged ${count} card(s) with the deck (Magician).`);
        } else {
          G.log.push(`${p.name} chose not to exchange any cards (Magician).`);
          p.abilityUsed = true;
        }
      } else if (payload.type === "DESTROY") {
        const targetP = G.players.find((pl) => pl.id === payload.playerId);
        const cardIdx = targetP?.city.findIndex((c) => c.id === payload.cardId);
        if (cardIdx !== -1) {
          const card = targetP.city.splice(cardIdx, 1)[0];
          const cost = Math.max(0, card.cost - 1);
          p.gold -= cost;
          p.abilityUsed = true;
          G.log.push(`${p.name} razed ${card.name} from ${targetP.name}'s city.`);
          G.sfx = { name: "warlord", at: Date.now() };
        }
      }
      G.players[playerID].interaction = null;
      checkAutoEnd(G, playerID, events);
    },
    activateAbility: ({ G, playerID, ctx }) => {
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
      const p = G.players[playerID];
      if (p.abilityUsed) return INVALID_MOVE;
      if (p.role.id === 1) {
        const removed = new Set((G.removedFaceUpRoles || []).map((r) => r.id));
        p.interaction = {
          type: "ASSASSINATE",
          options: [2, 3, 4, 5, 6, 7, 8].filter((id) => id !== G.killedRoleId && !removed.has(id))
        };
      } else if (p.role.id === 2) {
        const removed = new Set((G.removedFaceUpRoles || []).map((r) => r.id));
        p.interaction = {
          type: "STEAL",
          options: [3, 4, 5, 6, 7, 8].filter((id) => id !== G.killedRoleId && !removed.has(id))
        };
      } else if (p.role.id === 3) {
        p.interaction = { type: "MAGIC", options: ["SWAP_PLAYER", "SWAP_DECK"] };
      } else if (p.role.id === 8) {
        const options = [];
        G.players.forEach((pl) => {
          if (pl.id !== playerID && pl.city.length < 8 && pl.role?.id !== 5) {
            pl.city.forEach((c) => options.push({ playerId: pl.id, cardId: c.id }));
          }
        });
        p.interaction = { type: "DESTROY", options };
      }
    },
    // Purple unique moves
    useSmithy: ({ G, playerID, ctx }) => {
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
      const p = G.players[playerID];
      if (p.isKilled) return INVALID_MOVE;
      if (!p.hasTakenAction) return INVALID_MOVE;
      if (!hasUnique(p, "Smithy")) return INVALID_MOVE;
      if ((p.usedUniqueThisTurn || {}).smithy) return INVALID_MOVE;
      if (p.gold < 2) return INVALID_MOVE;
      p.gold -= 2;
      const drawn = G.deck.splice(0, 3);
      p.hand.push(...drawn);
      p.usedUniqueThisTurn = { ...p.usedUniqueThisTurn || {}, smithy: true };
      G.log.push(`${p.name} used Smithy (paid 2 gold, drew ${drawn.length}).`);
      G.sfx = { name: "card-fan-1", at: Date.now() };
    },
    labStart: ({ G, playerID, ctx }) => {
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
      const p = G.players[playerID];
      if (p.isKilled) return INVALID_MOVE;
      if (!p.hasTakenAction) return INVALID_MOVE;
      if (!hasUnique(p, "Laboratory")) return INVALID_MOVE;
      if ((p.usedUniqueThisTurn || {}).lab) return INVALID_MOVE;
      if (p.hand.length === 0) return INVALID_MOVE;
      p.interaction = { type: "LAB_DISCARD", options: p.hand.map((c) => c.id) };
    },
    labDiscard: ({ G, playerID, ctx, events }, cardId) => {
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
      const p = G.players[playerID];
      if (!p.interaction || p.interaction.type !== "LAB_DISCARD") return INVALID_MOVE;
      const idx = p.hand.findIndex((c) => c.id === cardId);
      if (idx === -1) return INVALID_MOVE;
      const discarded = p.hand.splice(idx, 1)[0];
      G.districtDiscard = G.districtDiscard || [];
      G.districtDiscard.push(discarded);
      p.gold += 2;
      p.usedUniqueThisTurn = { ...p.usedUniqueThisTurn || {}, lab: true };
      p.interaction = null;
      G.log.push(`${p.name} used Laboratory (discarded ${discarded.name}, +2 gold).`);
      G.sfx = { name: "handleCoins2", at: Date.now() };
      checkAutoEnd(G, playerID, events);
    },
    endTurn: ({ G, playerID, events, ctx }) => {
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
      const p = G.players[playerID];
      G.log.push(`${p.name} finishes turn.`);
      p.hasTakenIncomeThisTurn = false;
      p.hasTakenAction = false;
      p.builtThisTurn = 0;
      p.abilityUsed = false;
      p.interaction = null;
      advanceRole(G, events);
    }
  },
  phases: {
    lobby: {
      start: true,
      next: "draft",
      turn: { activePlayers: { all: "lobby" } }
    },
    draft: {
      onBegin: ({ G }) => {
        G.log.push("*** NEW ROUND DRAFT ***");
        setupCharacterDeck(G);
      },
      turn: {
        order: {
          first: ({ G }) => parseInt(G.kingId),
          next: ({ ctx }) => (ctx.playOrderPos + 1) % ctx.numPlayers
        },
        onBegin: ({ G, ctx, events }) => {
          const p = G.players[ctx.currentPlayer];
          if (p.isBot && G.availableRoles.length > 0) {
            const role = G.availableRoles.shift();
            p.role = role;
            G.log.push(`[B] ${p.name} claimed a role.`);
            events.endTurn();
          }
        }
      },
      endIf: ({ G }) => G.players.every((p) => p.role !== null),
      next: "action"
    },
    action: {
      turn: {
        onBegin: ({ G, ctx, events }) => {
          const p = G.players[ctx.currentPlayer];
          if (p.isBot) {
            G.log.push(`${p.name} is thinking...`);
            p.gold += 2;
            events.endTurn();
          }
        }
      },
      onBegin: ({ G, events }) => {
        G.log.push("*** THE CALL BEGINS ***");
        G.activeRoleId = 0;
        advanceRole(G, events);
      }
    },
    results: {}
  }
};
var CitadelLobby = {
  name: "citadel-lobby",
  setup: () => ({ chat: [] }),
  moves: {
    submitChat: ({ G }, payload) => {
      const msg = typeof payload === "string" ? { sender: "System", text: payload } : payload;
      G.chat.push({ ...msg, timestamp: Date.now() });
      if (G.chat.length > 50) G.chat.shift();
    }
  },
  turn: {
    activePlayers: { all: "chatting" }
  }
};

// src/bot.ts
function runBotTurn(state, dispatch) {
  const me = (state.players || []).find((p) => p.id === state.currentPlayerId);
  try {
    const calcBotPoints = (pl) => {
      const city = pl.city || [];
      let score = city.reduce((sum, c) => sum + (c.cost || 0), 0);
      const colors = new Set(city.map((c) => c.color).filter(Boolean));
      const hasAllColorsRaw = colors.size >= 5;
      const has = (name) => city.some((c) => c.name === name);
      const hasAllColors = hasAllColorsRaw || !hasAllColorsRaw && has("Haunted Quarter");
      if (hasAllColors) score += 3;
      if (pl.firstBuilderBonus) score += 4;
      else if ((city.length || 0) >= 8) score += 2;
      if (has("University")) score += 2;
      if (has("Dragon Gate")) score += 2;
      if (has("Imperial Treasury")) score += pl.gold || 0;
      if (has("Map Room")) score += (pl.hand || []).length;
      return score;
    };
    const destroyCost = (targetPlayer, card) => {
      const hasGreatWall = (targetPlayer.city || []).some((c) => c.name === "Great Wall");
      return Math.max(0, (card.cost || 0) - 1) + (hasGreatWall ? 1 : 0);
    };
    if (!me || !me.isBot) return false;
    if (state.phase === "draft") {
      const roles = state.availableRoles || [];
      if (!roles.length) return false;
      let bestRole = roles[0];
      let maxScore = -1;
      roles.forEach((r) => {
        let score = Math.random() * 2;
        if (r.id === 4) score += (me.city || []).filter((c) => c.color === "noble").length;
        if (r.id === 5) score += (me.city || []).filter((c) => c.color === "religious").length;
        if (r.id === 6) score += (me.city || []).filter((c) => c.color === "trade").length;
        if (r.id === 8) score += (me.city || []).filter((c) => c.color === "military").length;
        if (r.id === 7 && (me.hand || []).length < 2) score += 2;
        if (r.id === 6 && (me.gold || 0) < 2) score += 2;
        if (r.id === 3 && (me.hand || []).length === 0) score += 3;
        if (score > maxScore) {
          maxScore = score;
          bestRole = r;
        }
      });
      dispatch({ type: "PICK_ROLE", payload: { playerId: state.currentPlayerId, roleId: bestRole.id } });
      return true;
    }
    if (state.phase === "action") {
      if (state.interaction) {
        if (state.interaction.type === "ASSASSINATE") {
          const options0 = state.interaction.options || [];
          if (!options0.length) return false;
          const early = (state.turn ?? 0) < 5;
          const options = early && options0.length > 1 ? options0.filter((id) => id !== 2) : options0;
          const preferred = [6, 7, 4, 5, 8, 3, 2];
          let target = options[0];
          for (const p of preferred) {
            if (options.includes(p)) {
              target = p;
              break;
            }
          }
          if (!target) target = options[Math.floor(Math.random() * options.length)];
          dispatch({ type: "RESOLVE_INTERACTION", payload: { type: "ASSASSINATE", target } });
          return true;
        }
        if (state.interaction.type === "STEAL") {
          const options = state.interaction.options || [];
          if (!options.length) return false;
          const preferred = [6, 7, 4, 5, 8, 3];
          let target = options[0];
          for (const p of preferred) {
            if (options.includes(p)) {
              target = p;
              break;
            }
          }
          if (!target) target = options[Math.floor(Math.random() * options.length)];
          dispatch({ type: "RESOLVE_INTERACTION", payload: { type: "STEAL", target } });
          return true;
        }
        if (state.interaction.type === "DESTROY") {
          const options = state.interaction.options || [];
          const detailed = options.map((opt) => {
            const pl = (state.players || []).find((pp) => pp.id === opt.playerId);
            const card = pl?.city?.find((cc) => cc.id === opt.cardId);
            if (!pl || !card) return null;
            const cost = destroyCost(pl, card);
            const blockedByKeep = card.name === "Keep";
            const blockedByCompleteCity = (pl.city?.length || 0) >= 8;
            const affordable = (me.gold || 0) >= cost;
            return {
              playerId: opt.playerId,
              cardId: opt.cardId,
              cost,
              affordable,
              blockedByKeep,
              blockedByCompleteCity,
              blockedByBishop: pl?.role?.id === 5,
              points: calcBotPoints(pl),
              cardCost: card.cost || 0
            };
          }).filter(Boolean);
          const valid = detailed.filter((x) => x.affordable && !x.blockedByKeep && !x.blockedByCompleteCity && !x.blockedByBishop);
          if (!valid.length) {
            dispatch({ type: "RESOLVE_INTERACTION", payload: { type: "CANCEL" } });
            return true;
          }
          const free = valid.filter((x) => x.cost === 0);
          const pool = free.length ? free : valid;
          const maxPts = Math.max(...pool.map((x) => x.points));
          const leaders = pool.filter((x) => x.points === maxPts);
          leaders.sort((a, b) => b.cardCost - a.cardCost || a.cost - b.cost);
          const choice = leaders[0];
          dispatch({ type: "RESOLVE_INTERACTION", payload: { type: "DESTROY", playerId: choice.playerId, cardId: choice.cardId } });
          return true;
        }
        if (state.interaction.type === "MAGIC") {
          const options = state.interaction.options || [];
          const others = (state.players || []).filter((p) => p.id !== me.id);
          const mostCardsPlayer = [...others].sort((a, b) => (b.hand?.length || 0) - (a.hand?.length || 0))[0];
          if (options.includes("SWAP_PLAYER") && (me.hand || []).length < 2 && (mostCardsPlayer?.hand?.length || 0) > 2) {
            dispatch({ type: "RESOLVE_INTERACTION", payload: { type: "MAGIC", target: "SWAP_PLAYER" } });
            return true;
          }
          if (options.includes("SWAP_DECK") && (me.hand || []).length < 2) {
            dispatch({ type: "RESOLVE_INTERACTION", payload: { type: "MAGIC", target: "SWAP_DECK" } });
            return true;
          }
          dispatch({ type: "RESOLVE_INTERACTION", payload: { type: "CANCEL" } });
          return true;
        }
        if (state.interaction.type === "MAGIC_SWAP_PLAYER") {
          const options = state.interaction.options || [];
          if (!options.length) {
            dispatch({ type: "RESOLVE_INTERACTION", payload: { type: "CANCEL" } });
            return true;
          }
          let best = options[0];
          let bestCount = -1;
          for (const pid of options) {
            const pl = (state.players || []).find((p) => p.id === pid);
            const n = (pl?.hand || []).length;
            if (n > bestCount) {
              bestCount = n;
              best = pid;
            }
          }
          dispatch({ type: "RESOLVE_INTERACTION", payload: { type: "MAGIC_SWAP_PLAYER", target: best } });
          return true;
        }
        if (state.interaction.type === "MAGIC_SWAP_DECK") {
          const options = state.interaction.options || [];
          if (!options.length) {
            dispatch({ type: "RESOLVE_INTERACTION", payload: { type: "MAGIC_SWAP_DECK", selectedIds: [] } });
            return true;
          }
          const hand = me.hand || [];
          const city = me.city || [];
          const builtNames = new Set(city.map((c) => c.name));
          const scored = hand.filter((c) => options.includes(c.id)).map((c) => {
            const alreadyBuilt = builtNames.has(c.name);
            const unbuildable = (c.cost || 0) > (me.gold || 0);
            let score = 0;
            if (alreadyBuilt) score += 5;
            if (unbuildable) score += 2;
            if ((c.cost || 0) <= 1) score += 1;
            score += Math.random() * 0.25;
            return { id: c.id, score };
          }).sort((a, b) => b.score - a.score);
          let selectedIds = [];
          if (options.length <= 2) {
            selectedIds = options.slice();
          } else {
            selectedIds = scored.filter((x) => x.score >= 2).map((x) => x.id);
            if (!selectedIds.length) selectedIds = [scored[0]?.id].filter(Boolean);
          }
          dispatch({ type: "RESOLVE_INTERACTION", payload: { type: "MAGIC_SWAP_DECK", selectedIds } });
          return true;
        }
        dispatch({ type: "RESOLVE_INTERACTION", payload: { type: "CANCEL" } });
        return true;
      }
      if (!me.hasTakenIncomeThisTurn) {
        if (state.isDrawing && state.drawnCards?.length) {
          const sorted = [...state.drawnCards].sort((a, b) => (b.cost || 0) - (a.cost || 0));
          dispatch({ type: "KEEP_CARD", payload: { cardId: sorted[0].id } });
          return true;
        }
        const cheapest = Math.min(...(me.hand || []).map((c) => c.cost || 99), 99);
        if ((me.gold || 0) >= cheapest) {
          dispatch({ type: "DRAW_CARDS_START" });
        } else {
          dispatch({ type: "TAKE_GOLD" });
        }
        return true;
      }
      if (!me.abilityUsed) {
        const hasSmithy = (me.city || []).some((c) => c.name === "Smithy");
        const hasLab = (me.city || []).some((c) => c.name === "Laboratory");
        if (hasSmithy && (me.gold || 0) >= 2) {
          dispatch({ type: "USE_SMITHY" });
          return true;
        }
        if (hasLab && (me.hand || []).length > 0) {
          const card = (me.hand || [])[0];
          dispatch({ type: "USE_LAB_START" });
          dispatch({ type: "USE_LAB_DISCARD", payload: { cardId: card.id } });
          return true;
        }
        dispatch({ type: "ACTIVATE_ABILITY" });
        return true;
      }
      const buildable = (me.hand || []).filter((c) => (me.gold || 0) >= (c.cost || 0) && !(me.city || []).some((b) => b.name === c.name));
      if (buildable.length && (me.builtThisTurn || 0) < (me.buildLimit || 1)) {
        buildable.sort((a, b) => (b.cost || 0) - (a.cost || 0));
        dispatch({ type: "BUILD_DISTRICT", payload: { cardId: buildable[0].id } });
        return true;
      }
      dispatch({ type: "END_TURN" });
      return true;
    }
    return false;
  } catch (e) {
    try {
      dispatch({ type: "RESOLVE_INTERACTION", payload: { type: "CANCEL" } });
    } catch {
    }
    try {
      dispatch({ type: "END_TURN" });
    } catch {
    }
    return true;
  }
}

// src/politikum.ts

// src/politikum/cards.generated.ts
var POLITIKUM_YAML_CARDS = [
  {
    "id": "persona_1",
    "type": "persona",
    "vp": 1,
    "count": 1,
    "text": "\u0420\u0443\u043D\u043E\u0432",
    "tags": [
      "faction:red_nationalist",
      "gender:m"
    ],
    "abilityKey": "on_enter_adjacent_bonus",
    "params": {
      "neighbors": [
        "persona_19",
        "persona_42"
      ],
      "tokens": 4
    }
  },
  {
    "id": "persona_2",
    "type": "persona",
    "vp": 7,
    "count": 1,
    "text": "\u0421\u0435\u0440\u0435\u0436\u043A\u043E",
    "tags": [
      "faction:leftwing",
      "gender:f"
    ]
  },
  {
    "id": "persona_3",
    "type": "persona",
    "vp": 3,
    "count": 1,
    "text": "SVTV",
    "tags": [
      "faction:rightwing"
    ],
    "abilityKey": "persona_3_on_enter_choice"
  },
  {
    "id": "persona_4",
    "type": "persona",
    "vp": 7,
    "count": 1,
    "text": "\u042F\u0448\u0438\u043D",
    "tags": [
      "faction:liberal",
      "gender:m"
    ],
    "abilityKey": "persona_4_on_enter_twitter_penalty"
  },
  {
    "id": "persona_5",
    "type": "persona",
    "vp": 2,
    "count": 1,
    "text": "\u041F\u0435\u0432\u0447\u0438\u0445",
    "tags": [
      "faction:fbk",
      "gender:f"
    ],
    "abilityKey": "persona_5_discard_liberal_steal_tokens"
  },
  {
    "id": "persona_6",
    "type": "persona",
    "vp": 2,
    "count": 1,
    "text": "\u041A\u0430\u0448\u0438\u043D",
    "tags": [
      "faction:rightwing",
      "gender:m"
    ],
    "abilityKey": "persona_6_on_action8_plus1"
  },
  {
    "id": "persona_7",
    "type": "persona",
    "vp": 2,
    "count": 1,
    "text": "\u041A\u0430\u0441\u043F\u0430\u0440\u043E\u0432",
    "tags": [
      "faction:liberal",
      "gender:m"
    ],
    "abilityKey": "persona_7_swap_two_in_coalition"
  },
  {
    "id": "persona_8",
    "type": "persona",
    "vp": 2,
    "count": 1,
    "text": "\u041B\u0430\u0437\u0435\u0440\u0441\u043E\u043D",
    "tags": [
      "faction:leftwing",
      "gender:f"
    ]
  },
  {
    "id": "persona_9",
    "type": "persona",
    "vp": -3,
    "count": 1,
    "text": "\u041F\u043E\u043D\u043E\u043C\u0430\u0440\u0451\u0432",
    "tags": [
      "faction:liberal",
      "gender:m"
    ]
  },
  {
    "id": "persona_10",
    "type": "persona",
    "vp": 3,
    "count": 1,
    "text": "\u041D\u0430\u043A\u0438",
    "tags": [
      "faction:fbk",
      "gender:m"
    ]
  },
  {
    "id": "persona_11",
    "type": "persona",
    "vp": 3,
    "count": 1,
    "text": "\u0421\u043E\u043B\u043E\u0432\u0435\u0439",
    "tags": [
      "faction:system",
      "gender:m"
    ]
  },
  {
    "id": "persona_12",
    "type": "persona",
    "abilityKey": "persona_12_on_enter_adjacent_red_buff",
    "vp": 3,
    "count": 1,
    "text": "\u0421\u0430\u0432\u0438\u043D",
    "tags": [
      "faction:red_nationalist",
      "gender:m"
    ]
  },
  {
    "id": "persona_13",
    "type": "persona",
    "abilityKey": "persona_13_retaliate_on_targeted_action",
    "vp": 2,
    "count": 1,
    "text": "\u0412\u0435\u043D\u0435\u0434\u0438\u0442\u043A\u043E\u0432",
    "tags": [
      "faction:system",
      "gender:m"
    ]
  },
  {
    "id": "persona_14",
    "type": "persona",
    "vp": 2,
    "count": 1,
    "text": "\u0420\u043E\u0439\u0437\u043C\u0430\u043D",
    "tags": [
      "faction:liberal",
      "gender:m"
    ],
    "abilityKey": "discard_one_persona_from_any_coalition"
  },
  {
    "id": "persona_15",
    "type": "persona",
    "vp": 3,
    "count": 1,
    "text": "\u041F\u043E\u0436\u0430\u0440\u0441\u043A\u0438\u0439",
    "tags": [
      "faction:rightwing",
      "gender:m"
    ]
  },
  {
    "id": "persona_16",
    "type": "persona",
    "vp": 3,
    "count": 1,
    "text": "\u041A\u0430\u0446",
    "tags": [
      "faction:liberal",
      "gender:m"
    ],
    "abilityKey": "persona_16_on_enter_draw3_discard3"
  },
  {
    "id": "persona_17",
    "type": "persona",
    "abilityKey": "persona_17_on_enter_steal_persona",
    "vp": 2,
    "count": 1,
    "text": "\u0410\u0440\u043D\u043E",
    "tags": [
      "faction:liberal",
      "gender:f"
    ]
  },
  {
    "id": "persona_18",
    "type": "persona",
    "vp": 5,
    "count": 1,
    "text": "\u0421\u043E\u0431\u043E\u043B\u044C",
    "tags": [
      "faction:fbk",
      "gender:f"
    ]
  },
  {
    "id": "persona_19",
    "type": "persona",
    "vp": 1,
    "count": 1,
    "text": "\u0413\u0438\u0440\u043A\u0438\u043D",
    "tags": [
      "faction:red_nationalist",
      "gender:m"
    ],
    "abilityKey": "on_enter_adjacent_bonus",
    "params": {
      "neighbors": [
        "persona_1",
        "persona_42"
      ],
      "tokens": 4
    }
  },
  {
    "id": "persona_20",
    "type": "persona",
    "vp": 2,
    "count": 1,
    "text": "\u0411\u044B\u043A\u043E\u0432",
    "tags": [
      "faction:liberal",
      "gender:m"
    ],
    "abilityKey": "persona_20_on_enter_take_from_discard"
  },
  {
    "id": "persona_21",
    "type": "persona",
    "vp": 1,
    "count": 1,
    "text": "\u0428\u0442\u0435\u0444\u0430\u043D\u043E\u0432",
    "tags": [
      "faction:leftwing",
      "gender:m"
    ],
    "abilityKey": "persona_21_on_enter_invert_tokens"
  },
  {
    "id": "persona_22",
    "type": "persona",
    "vp": 3,
    "count": 1,
    "text": "\u0421\u0432\u0435\u0442\u043E\u0432",
    "tags": [
      "faction:rightwing",
      "gender:m"
    ],
    "abilityKey": "persona_22_global_enter_mods"
  },
  {
    "id": "persona_23",
    "type": "persona",
    "vp": 4,
    "count": 1,
    "text": "\u0412\u043E\u043B\u043A\u043E\u0432",
    "tags": [
      "faction:fbk",
      "gender:m"
    ],
    "abilityKey": "persona_23_on_enter_self_inflict_draw"
  },
  {
    "id": "persona_24",
    "type": "persona",
    "vp": 3,
    "count": 1,
    "text": "\u041B\u0430\u0442\u044B\u043D\u0438\u043D\u0430",
    "tags": [
      "faction:rightwing",
      "gender:f"
    ],
    "abilityKey": "persona_24_passive_dual_leftwing_scaler"
  },
  {
    "id": "persona_25",
    "type": "persona",
    "vp": 1,
    "count": 1,
    "text": "\u041D\u0430\u0434\u0435\u0436\u0434\u0438\u043D",
    "tags": [
      "faction:system",
      "gender:m"
    ]
  },
  {
    "id": "persona_26",
    "type": "persona",
    "vp": 1,
    "count": 1,
    "text": "\u0414\u0435\u043C\u0443\u0448\u043A\u0438\u043D",
    "tags": [
      "faction:rightwing",
      "gender:m"
    ],
    "abilityKey": "persona_26_on_enter_purge_red_inherit_plus"
  },
  {
    "id": "persona_27",
    "type": "persona",
    "vp": 7,
    "count": 1,
    "text": "\u042E\u0434\u0438\u043D",
    "tags": [
      "faction:leftwing",
      "gender:m"
    ]
  },
  {
    "id": "persona_28",
    "type": "persona",
    "vp": 2,
    "count": 1,
    "text": "\u0412\u0435\u0434\u0443\u0442\u0430",
    "tags": [
      "faction:fbk",
      "gender:f"
    ],
    "abilityKey": "persona_28_on_enter_steal_plus_tokens"
  },
  {
    "id": "persona_29",
    "type": "persona",
    "vp": 4,
    "count": 1,
    "text": "\u042E\u043D\u0435\u043C\u0430\u043D",
    "tags": [
      "faction:red_nationalist",
      "gender:m"
    ]
  },
  {
    "id": "persona_30",
    "type": "persona",
    "vp": 1,
    "count": 1,
    "text": "\u0425\u043E\u0434\u043E\u0440\u043A\u043E\u0432\u0441\u043A\u0438\u0439",
    "tags": [
      "faction:liberal",
      "gender:m"
    ],
    "abilityKey": "persona_30_on_enter_buff_liberals"
  },
  {
    "id": "persona_31",
    "type": "persona",
    "vp": 3,
    "count": 1,
    "text": "\u0428\u043B\u043E\u0441\u0431\u0435\u0440\u0433",
    "tags": [
      "faction:system",
      "gender:m",
      "persona:immovable"
    ]
  },
  {
    "id": "persona_32",
    "type": "persona",
    "vp": 3,
    "count": 1,
    "text": "\u041F\u043B\u044E\u0449\u0435\u0432",
    "tags": [
      "faction:liberal",
      "gender:m"
    ],
    "abilityKey": "persona_32_activate_bounce"
  },
  {
    "id": "persona_33",
    "type": "persona",
    "vp": 0,
    "count": 1,
    "text": "\u0421\u043E\u0431\u0447\u0430\u043A",
    "tags": [
      "faction:neutral",
      "gender:f"
    ],
    "abilityKey": "persona_33_on_enter_choose_faction"
  },
  {
    "id": "persona_34",
    "type": "persona",
    "vp": 2,
    "count": 1,
    "text": "\u041C\u0438\u043B\u043E\u0432",
    "tags": [
      "faction:fbk",
      "gender:m"
    ],
    "abilityKey": "persona_34_on_enter_guess_topdeck"
  },
  {
    "id": "persona_35",
    "type": "persona",
    "vp": 4,
    "count": 1,
    "text": "\u0416\u0434\u0430\u043D\u043E\u0432",
    "tags": [
      "faction:fbk",
      "gender:m"
    ],
    "abilityKey": "persona_35_no_ability"
  },
  {
    "id": "persona_36",
    "type": "persona",
    "vp": 2,
    "count": 1,
    "text": "\u041A\u0430\u0433\u0430\u043B\u0438\u0446\u043A\u0438\u0439",
    "tags": [
      "faction:leftwing",
      "gender:m"
    ],
    "abilityKey": "persona_36_passive_ignore_action7"
  },
  {
    "id": "persona_37",
    "type": "persona",
    "vp": 4,
    "count": 1,
    "text": "\u0413\u0443\u0440\u0438\u0435\u0432",
    "tags": [
      "faction:leftwing",
      "gender:m"
    ],
    "abilityKey": "persona_37_on_enter_bribe_and_silence"
  },
  {
    "id": "persona_38",
    "type": "persona",
    "vp": 0,
    "count": 1,
    "text": "VotVot",
    "tags": [
      "faction:leftwing"
    ],
    "abilityKey": "persona_38_global_event_token_vacuum"
  },
  {
    "id": "persona_39",
    "type": "persona",
    "vp": 2,
    "count": 1,
    "text": "\u041B\u0435\u0444\u0442",
    "tags": [
      "faction:red_nationalist",
      "gender:m"
    ]
  },
  {
    "id": "persona_40",
    "type": "persona",
    "vp": 1,
    "count": 1,
    "text": "\u0414\u0443\u043D\u0446\u043E\u0432\u0430",
    "tags": [
      "faction:system",
      "gender:f"
    ],
    "abilityKey": "place_tokens_plus_vp",
    "params": {
      "tokens": 3,
      "delta": 1
    }
  },
  {
    "id": "persona_41",
    "type": "persona",
    "vp": 2,
    "count": 1,
    "text": "\u0414\u043E\u0436\u0434\u044C",
    "tags": [
      "faction:liberal"
    ],
    "abilityKey": "persona_41_on_enter_buff_fbk"
  },
  {
    "id": "persona_42",
    "type": "persona",
    "vp": 1,
    "count": 1,
    "text": "\u0421\u0442\u0440\u0435\u043B\u043A\u043E\u0432",
    "tags": [
      "faction:red_nationalist",
      "gender:m"
    ],
    "abilityKey": "on_enter_adjacent_bonus",
    "params": {
      "neighbors": [
        "persona_1",
        "persona_19"
      ],
      "tokens": 4
    }
  },
  {
    "id": "persona_43",
    "type": "persona",
    "vp": 1,
    "count": 1,
    "text": "\u0414\u043E\u0445\u0430",
    "tags": [
      "faction:leftwing"
    ],
    "abilityKey": "persona_43_on_enter_drain_rightwing"
  },
  {
    "id": "persona_44",
    "type": "persona",
    "vp": 1,
    "count": 1,
    "text": "\u0420\u0443\u0434\u043E\u0439",
    "tags": [
      "faction:leftwing",
      "gender:m"
    ]
  },
  {
    "id": "persona_45",
    "type": "persona",
    "vp": 2,
    "count": 1,
    "text": "\u0428\u0443\u043B\u044C\u043C\u0430\u043D",
    "tags": [
      "faction:liberal",
      "gender:f"
    ],
    "abilityKey": "persona_45_steal_from_opponent"
  },
  {
    "id": "event_1",
    "type": "event",
    "vp": 0,
    "count": 3,
    "timing": "on_draw",
    "abilityKey": "place_tokens_plus_vp",
    "params": {
      "tokens": 3,
      "delta": 1
    }
  },
  {
    "id": "event_2",
    "type": "event",
    "vp": 0,
    "count": 2,
    "timing": "on_draw",
    "abilityKey": "place_tokens_plus_vp",
    "params": {
      "tokens": 2,
      "delta": 1
    }
  },
  {
    "id": "event_3",
    "type": "event",
    "vp": 0,
    "count": 1,
    "timing": "on_draw",
    "abilityKey": "place_tokens_plus_vp",
    "params": {
      "tokens": 5,
      "delta": 1
    }
  },
  {
    "id": "event_10",
    "type": "event",
    "vp": 0,
    "count": 2,
    "timing": "on_draw",
    "abilityKey": "place_tokens_plus_vp",
    "params": {
      "tokens": 4,
      "delta": 1
    }
  },
  {
    "id": "event_11",
    "type": "event",
    "vp": 0,
    "count": 2,
    "timing": "on_draw",
    "abilityKey": "event_draw_cards",
    "params": {
      "count": 2
    }
  },
  {
    "id": "event_12a",
    "type": "event",
    "vp": 0,
    "count": 1,
    "timing": "on_draw",
    "abilityKey": "event_faction_minus1_draw1",
    "params": {
      "factionTag": "faction:fbk"
    },
    "tags": [
      "event_type:twitter_squabble"
    ]
  },
  {
    "id": "event_12b",
    "type": "event",
    "vp": 0,
    "count": 1,
    "timing": "on_draw",
    "abilityKey": "event_12b_discard_others_hand",
    "tags": [
      "event_type:twitter_squabble"
    ]
  },
  {
    "id": "event_12c",
    "type": "event",
    "vp": 0,
    "count": 1,
    "timing": "on_draw",
    "abilityKey": "event_faction_minus1_draw1",
    "params": {
      "factionTag": "faction:liberal"
    },
    "tags": [
      "event_type:twitter_squabble"
    ]
  },
  {
    "id": "event_15",
    "type": "event",
    "vp": 0,
    "count": 1,
    "timing": "on_draw",
    "abilityKey": "event_shuffle_all_hands_redeal"
  },
  {
    "id": "event_16",
    "type": "event",
    "vp": 0,
    "count": 1,
    "timing": "on_draw",
    "abilityKey": "event_16_discard_self_persona_then_draw1"
  },
  {
    "id": "action_4",
    "type": "action",
    "vp": 0,
    "count": 2,
    "timing": "on_play"
  },
  {
    "id": "action_5",
    "type": "action",
    "vp": 0,
    "count": 1,
    "timing": "on_play"
  },
  {
    "id": "action_6",
    "type": "action",
    "vp": 0,
    "count": 1,
    "timing": "response"
  },
  {
    "id": "action_7",
    "type": "action",
    "vp": 0,
    "count": 3,
    "timing": "on_play",
    "tags": [
      "action:block_persona",
      "action:persists"
    ]
  },
  {
    "id": "action_8",
    "type": "action",
    "vp": 0,
    "count": 8,
    "timing": "response"
  },
  {
    "id": "action_9",
    "type": "action",
    "vp": 0,
    "count": 2,
    "timing": "on_play"
  },
  {
    "id": "action_13",
    "type": "action",
    "vp": 0,
    "count": 2,
    "timing": "on_play",
    "tags": [
      "action:shield",
      "action:persists"
    ]
  },
  {
    "id": "action_14",
    "type": "action",
    "vp": 0,
    "count": 1,
    "timing": "response",
    "tags": [
      "action:cancel_effect_on_persona"
    ]
  },
  {
    "id": "action_17",
    "type": "action",
    "vp": 0,
    "count": 1,
    "timing": "on_play",
    "tags": [
      "action:minus_tokens"
    ]
  },
  {
    "id": "action_18",
    "type": "action",
    "vp": 0,
    "count": 2,
    "timing": "on_play",
    "tags": [
      "action:retrieve_persona_discard"
    ]
  }
];

// src/politikum/cards.ts
var POLITIKUM_CARDS_LIST = POLITIKUM_YAML_CARDS.map((c) => ({
  id: String(c.id),
  type: c.type,
  vp: Number(c.vp ?? 0),
  count: c.count == null ? void 0 : Number(c.count),
  tags: Array.isArray(c.tags) ? c.tags.map(String) : void 0,
  text: c.text == null ? void 0 : String(c.text),
  timing: c.timing == null ? void 0 : String(c.timing),
  abilityKey: c.abilityKey == null ? void 0 : String(c.abilityKey),
  params: c.params == null ? void 0 : c.params
}));
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
function applyTokenDelta(card, delta) {
  card.vpDelta = Number(card.vpDelta || 0) + delta;
  const base = Number(card.baseVp ?? 0);
  const tok = Number(card.vpDelta ?? 0);
  const pas = Number(card.passiveVpDelta ?? 0);
  card.vp = base + tok + pas;
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
    const neighbors = Array.isArray(card?.params?.neighbors) ? card.params.neighbors.map(String) : [];
    const tokens = Number(card?.params?.tokens ?? 4);
    const idx = (me.coalition || []).findIndex((c) => String(c.id) === String(card.id));
    if (idx < 0) return;
    const leftCard = idx > 0 ? me.coalition[idx - 1] : null;
    const rightCard = idx < (me.coalition || []).length - 1 ? me.coalition[idx + 1] : null;
    const leftBid = leftCard ? baseId(String(leftCard.id)) : null;
    const rightBid = rightCard ? baseId(String(rightCard.id)) : null;
    const matchLeft = leftBid && neighbors.includes(leftBid);
    const matchRight = rightBid && neighbors.includes(rightBid);
    if (!matchLeft && !matchRight) return;
    const affected = [];
    const tryGive = (c) => {
      if (!c || c.type !== "persona") return;
      if (c._adjBonusApplied) return;
      c._adjBonusApplied = true;
      applyTokenDelta(c, tokens);
      affected.push(c);
    };
    tryGive(card);
    if (matchLeft) tryGive(leftCard);
    if (matchRight) tryGive(rightCard);
    if (affected.length) {
      const names = affected.map((x) => String(x.name || x.id)).join(" + ");
      G.log.push(`${me.name} adjacency bonus: +${tokens} (${names}).`);
    }
  },
  persona_4_on_enter_twitter_penalty: ({ G, me, card }) => {
    const n = (G.discard || []).filter((c) => Array.isArray(c.tags) && c.tags.includes("event_type:twitter_squabble")).length;
    if (!n) return;
    applyTokenDelta(card, -2 * n);
    G.log.push(`${me.name} (${card.name || card.id}) got ${2 * n} \xD7 -1 from twitter squabbles in discard.`);
  },
  persona_12_on_enter_adjacent_red_buff: ({ G, me, card }) => {
    const idx = (me.coalition || []).findIndex((c) => String(c.id) === String(card.id));
    const left = idx > 0 ? (me.coalition || [])[idx - 1] : null;
    const right = idx >= 0 && idx < (me.coalition || []).length - 1 ? (me.coalition || [])[idx + 1] : null;
    const isRed = (x) => x && x.type === "persona" && Array.isArray(x.tags) && x.tags.includes("faction:red_nationalist") && !x.shielded;
    const L = isRed(left);
    const R = isRed(right);
    if (!L && !R) {
      G.log.push(`${me.name} (${card.name || card.id}) has no valid adjacent red_nationalist target.`);
      return;
    }
    if (L && !R) {
      applyTokenDelta(left, 2);
      G.log.push(`${me.name} (${card.name || card.id}) buffed ${left.name || left.id} (+2).`);
      return;
    }
    if (R && !L) {
      applyTokenDelta(right, 2);
      G.log.push(`${me.name} (${card.name || card.id}) buffed ${right.name || right.id} (+2).`);
      return;
    }
    const leftId = left ? String(left.id) : "";
    const rightId = right ? String(right.id) : "";
    if (!leftId && !rightId) {
      G.log.push(`${me.name} (${card.name || card.id}) was placed without adjacent targets; ability skipped.`);
      return;
    }
    G.pending = {
      kind: "persona_12_choose_adjacent_red",
      playerId: String(me.id),
      sourceCardId: String(card.id),
      leftId,
      rightId
    };
    G.log.push(`${me.name} (${card.name || card.id}) choose adjacent red_nationalist to buff (+2).`);
  },
  persona_3_on_enter_choice: ({ G, me, card }) => {
    G.pending = { kind: "persona_3_choice", playerId: String(me.id), sourceCardId: String(card.id) };
  },
  persona_5_discard_liberal_steal_tokens: ({ G, me, card }) => {
    const haveTarget = (G.players || []).some((pp) => {
      if (!pp || String(pp.id) === String(me.id)) return false;
      return (pp.coalition || []).some((c) => c && c.type === "persona" && !c.shielded && baseId(String(c.id)) !== "persona_31" && Array.isArray(c.tags) && c.tags.includes("faction:liberal"));
    });
    if (!haveTarget) {
      G.log.push(`\u041D\u0438 \u043E\u0434\u043D\u043E\u0433\u043E \u043B\u0438\u0431\u0435\u0440\u0430\u043B\u0430 \u043D\u0430 \u0432\u0441\u044E \u0438\u0433\u0440\u0443. \u042D\u0442\u043E \u043F\u0440\u043E\u0432\u0430\u043B!`);
      return;
    }
    G.pending = { kind: "persona_5_pick_liberal", playerId: String(me.id), sourceCardId: String(card.id) };
  },
  persona_7_swap_two_in_coalition: ({ G, me, card }) => {
    G.pending = {
      kind: "persona_7_swap_two_in_coalition",
      playerId: String(me.id),
      sourceCardId: String(card.id)
    };
    G.log.push(`${ruYou(me.name)} \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043B\u0438 \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C \u041A\u0430\u0441\u043F\u0430\u0440\u043E\u0432\u0430: \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u044E \u0438 \u0434\u0432\u0443\u0445 \u043F\u0435\u0440\u0441\u043E\u043D \u0434\u043B\u044F \u043F\u0435\u0440\u0435\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438.`);
  },
  persona_45_steal_from_opponent: ({ G, me, card }) => {
    G.pending = {
      kind: "persona_45_steal_from_opponent",
      playerId: String(me.id),
      sourceCardId: String(card.id)
    };
    G.log.push(`${me.name} (${card.name || card.id}) \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C: \u0437\u0430\u0431\u0438\u0440\u0430\u0435\u0442 \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u0443\u044E \u043A\u0430\u0440\u0442\u0443 \u0438\u0437 \u0440\u0443\u043A\u0438 \u043E\u043F\u043F\u043E\u043D\u0435\u043D\u0442\u0430`);
  },
  // p35: no special abilities
  persona_35_no_ability: () => {
  },
  persona_21_on_enter_invert_tokens: ({ G, me, card }) => {
    G.pending = { kind: "persona_21_pick_target_invert", playerId: String(me.id), sourceCardId: String(card.id) };
    G.log.push(`${actorWithPersona(me, "persona_21")} выбрал способность: инвертировать жетоны любого персонажа.`);
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
    const haveTarget = (G.players || []).some((pp) => (pp.coalition || []).some((c) => c.type === "persona" && baseId(String(c.id)) !== "persona_31" && !c.shielded && Array.isArray(c.tags) && c.tags.includes("faction:red_nationalist")));
    if (!haveTarget) {
      G.log.push(`${actorWithPersona(me, "persona_26")}: нет красно-националистического персонажа для сброса.`);
      return;
    }
    G.pending = { kind: "persona_26_pick_red_nationalist", playerId: String(me.id), sourceCardId: String(card.id) };
    G.log.push(`${me.name} \u0440\u0430\u0437\u044B\u0433\u0440\u0430\u043B \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C \u0414\u0435\u043C\u0443\u0448\u043A\u0438\u043D\u0430: \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043A\u0440\u0430\u0441\u043D\u043E\u0433\u043E \u043D\u0430\u0446\u0438\u043E\u043D\u0430\u043B\u0438\u0441\u0442\u0430, \u0447\u0442\u043E\u0431\u044B \u0441\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0438 \u0443\u043D\u0430\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u044C \u0435\u0433\u043E +1 \u0442\u043E\u043A\u0435\u043D\u044B`);
  },
  persona_28_on_enter_steal_plus_tokens: ({ G, me, card }) => {
    try {
      const haveAnyPlus = (G.players || []).some((pp) => (pp.coalition || []).some((c) => c?.type === "persona" && !c?.shielded && baseId(String(c?.id || "")) !== "persona_31" && Number(c?.vpDelta || 0) > 0));
      if (!haveAnyPlus) {
        G.log.push(`${me.name} \u0440\u0430\u0437\u044B\u0433\u0440\u0430\u043B \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C \u0412\u0435\u0434\u0443\u0442\u0430: \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430 \u043D\u0435 \u0438\u0437 \u0424\u0411\u041A, \u0438 \u0437\u0430\u0431\u0435\u0440\u0438\u0442\u0435 \u0443 \u043D\u0435\u0433\u043E \u0434\u043E 3-\u0451\u0445 +1 \u0442\u043E\u043A\u0435\u043D\u043E\u0432`);
        G.log.push(`${me.name} \u041D\u0438 \u0443 \u043A\u043E\u0433\u043E \u043D\u0435 \u043D\u0430\u0448\u043B\u043E\u0441\u044C \u0442\u043E\u043A\u0435\u043D\u043E\u0432. \u042D\u0442\u043E \u043A\u0430\u043A\u043E\u0439-\u0442\u043E \u043F\u0440\u043E\u0432\u0430\u043B!`);
        return;
      }
    } catch {
    }
    G.pending = { kind: "persona_28_pick_non_fbk", playerId: String(me.id), sourceCardId: String(card.id) };
    G.log.push(`${me.name} \u0440\u0430\u0437\u044B\u0433\u0440\u0430\u043B \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C \u0412\u0435\u0434\u0443\u0442\u0430: \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430 \u043D\u0435 \u0438\u0437 \u0424\u0411\u041A, \u0438 \u0437\u0430\u0431\u0435\u0440\u0438\u0442\u0435 \u0443 \u043D\u0435\u0433\u043E \u0434\u043E 3-\u0451\u0445 +1 \u0442\u043E\u043A\u0435\u043D\u043E\u0432`);
  },
  persona_32_activate_bounce: ({ G, me, card }) => {
    G.pending = { kind: "persona_32_pick_bounce_target", playerId: String(me.id), sourceCardId: String(card.id), cancellable: true };
    G.log.push(`${ruYou(me.name)} (${card.name || card.id}): \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u0435\u0440\u0441\u043E\u043D\u0443 \u0432 \u0441\u0432\u043E\u0435\u0439 \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u0438, \u0447\u0442\u043E\u0431\u044B \u0432\u0435\u0440\u043D\u0443\u0442\u044C \u0432 \u0440\u0443\u043A\u0443.`);
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
    const haveTarget = (G.players || []).some((pp) => {
      if (String(pp.id) === String(me.id)) return false;
      return (pp.coalition || []).some((c) => c.type === "persona" && baseId(String(c.id)) !== "persona_31" && !c.shielded);
    });
    if (!haveTarget) {
      G.log.push(`${ruYou(me.name)} (persona_37): \u043D\u0435\u0442 \u0446\u0435\u043B\u0438 \u0434\u043B\u044F \u043F\u043E\u0434\u043A\u0443\u043F\u0430.`);
      return;
    }
    G.pending = { kind: "persona_37_pick_opponent_persona", playerId: String(me.id), sourceCardId: String(card.id) };
  },
  persona_16_on_enter_draw3_discard3: ({ G, me, card }) => {
    const queuedEvents = [];
    for (let i = 0; i < 3; i++) {
      const next = (G.deck || []).shift();
      if (!next) break;
      if (next.type === "event") queuedEvents.push(next);
      else me.hand.push(next);
    }
    G.persona16AfterEvents = {
      playerId: String(me.id),
      sourceCardId: String(card.id),
      events: queuedEvents
    };
    const srcName = String(card?.text || card?.name || card?.id || "").trim();
    if (queuedEvents.length > 0) {
      const next = queuedEvents.shift();
      G.persona16AfterEvents.events = queuedEvents;
      G.lastEvent = next;
      const title = eventTitle(next);
      G.log.push(`${ruYou(me.name)} \u0432\u044B\u0442\u044F\u043D\u0443\u043B \u0421\u043E\u0431\u044B\u0442\u0438\u0435 "${title}" \u0438\u0437 \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u0438 ${srcName}.`);
      runAbility(next.abilityKey, { G, me, card: next });
      G.discard.push(next);
    } else {
      G.pending = { kind: "persona_16_discard3_from_hand", playerId: String(me.id), sourceCardId: String(card.id) };
    }
    G.log.push(`${actorWithPersona(me, "persona_16")}: возьмите 3 карты, затем сбросьте 3 карты с руки.`);
  },
  persona_33_on_enter_choose_faction: ({ G, me, card }) => {
    G.pending = { kind: "persona_33_choose_faction", playerId: String(me.id), sourceCardId: String(card.id) };
  },
  persona_34_on_enter_guess_topdeck: ({ G, me, card }) => {
    G.pending = { kind: "persona_34_guess_topdeck", playerId: String(me.id), sourceCardId: String(card.id) };
    G.log.push(`${ruYou(me.name)} (${card.name || card.id}): \u0443\u0433\u0430\u0434\u0430\u0439\u0442\u0435 \u0432\u0435\u0440\u0445\u043D\u044E\u044E \u043A\u0430\u0440\u0442\u0443 \u043A\u043E\u043B\u043E\u0434\u044B.`);
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
    G.pending = { kind: "persona_17_pick_opponent", playerId: String(me.id), sourceCardId: String(card.id) };
    G.log.push(`${ruYou(me.name)} (${card.name || card.id}): \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A\u0430 \u2014 \u043F\u043E\u0441\u043C\u043E\u0442\u0440\u0438\u0442\u0435 \u0435\u0433\u043E \u0440\u0443\u043A\u0443 \u0438 \u0437\u0430\u0431\u0435\u0440\u0438\u0442\u0435 1 \u043F\u0435\u0440\u0441\u043E\u043D\u0443.`);
  },
  // persona_13 retaliation is implemented in politikum.ts (after action targeting is confirmed)
  persona_13_retaliate_on_targeted_action: () => {
  },
  persona_20_on_enter_take_from_discard: ({ G, me, card }) => {
    const discard = (G.discard || []).filter((c) => c && c.type === "action");
    if (!discard.length) {
      G.log.push(`\u0412 \u0441\u0442\u043E\u043F\u043A\u0435 \u0441\u0431\u0440\u043E\u0441\u0430 \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0448\u043B\u043E\u0441\u044C!`);
      return;
    }
    if (discard.length === 1) {
      const [only] = discard.splice(0, 1);
      if (only) {
        me.hand.push(only);
        const actionName = String(only?.text || only?.name || only.name || only.id);
        G.log.push(`${ruYou(me.name)} \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u044F \u0411\u044B\u043A\u043E\u0432\u0430 \u0432\u0437\u044F\u043B ${actionName} \u0438\u0437 \u0441\u0431\u0440\u043E\u0441\u0430.`);
      }
      return;
    }
    G.pending = {
      kind: "persona_20_pick_from_discard",
      playerId: String(me.id),
      sourceCardId: String(card.id)
    };
    G.log.push(`${ruYou(me.name)} \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043B\u0438 \u0411\u044B\u043A\u043E\u0432\u0430: \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043A\u0430\u0440\u0442\u0443 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0438\u0437 \u0441\u0442\u043E\u043F\u043A\u0438 \u0441\u0431\u0440\u043E\u0441\u0430 \u0441\u0435\u0431\u0435 \u0432 \u0440\u0443\u043A\u0443`);
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
var range = (n) => Array.from({ length: n }, (_, i) => i + 1);
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function materializeCopies(defs) {
  const out = [];
  for (const d of defs) {
    const c = Math.max(1, Number(d.count || 1));
    for (let i = 1; i <= c; i++) {
      const instId = c === 1 ? d.id : `${d.id}#${i}`;
      const baseVp = d.vp ?? (d.type === "event" ? 0 : 1);
      out.push({
        id: instId,
        type: d.type,
        img: `/cards/${d.id}.webp`,
        name: d.text || d.id,
        baseVp,
        vp: baseVp,
        vpDelta: 0,
        passiveVpDelta: 0,
        tags: d.tags,
        abilityKey: d.abilityKey,
        params: d.params
      });
    }
  }
  return out;
}
function baseId2(instId) {
  return String(instId || "").split("#")[0];
}
function scorePlayer(pp) {
  return (pp.coalition || []).reduce((s, c) => s + Number(c.vp ?? (c.baseVp || 0)), 0);
}
function recalcPassives(G) {
  const allPlayers = G.players || [];
  const countLeftwing = (cards) => (cards || []).filter((c) => c.type === "persona" && Array.isArray(c.tags) && c.tags.includes("faction:leftwing")).length;
  for (const p of allPlayers) {
    const coal = p.coalition || [];
    const males = coal.filter((c) => c.type === "persona" && Array.isArray(c.tags) && c.tags.includes("gender:m")).length;
    const nonLeftwing = coal.filter((c) => c.type === "persona" && (!Array.isArray(c.tags) || !c.tags.includes("faction:leftwing"))).length;
    const myLeft = countLeftwing(coal);
    const otherLeft = allPlayers.filter((pp) => String(pp.id) != String(p.id)).reduce((s, pp) => s + countLeftwing(pp.coalition || []), 0);
    for (let i = 0; i < coal.length; i++) {
      const c = coal[i];
      if (c.type !== "persona") continue;
      const bid = baseId2(c.id);
      c.passiveVpDelta = 0;
      if (c.blockedAbilities) {
        const base2 = Number(c.baseVp ?? 0);
        const tok2 = Number(c.vpDelta ?? 0);
        c.vp = base2 + tok2;
        continue;
      }
      if (bid === "persona_2") {
        const selfMale = c.type === "persona" && Array.isArray(c.tags) && c.tags.includes("gender:m");
        c.passiveVpDelta = -(males - (selfMale ? 1 : 0));
      }
      if (bid === "persona_25") {
        const leftCount = coal.slice(0, i).filter((x) => x.type === "persona").length;
        c.passiveVpDelta = leftCount;
      }
      if (bid === "persona_27") {
        const factions = /* @__PURE__ */ new Set();
        for (const cc of coal || []) {
          if (!cc || cc.type !== "persona") continue;
          const tags = Array.isArray(cc.tags) ? cc.tags : [];
          const f = tags.find((t) => typeof t === "string" && t.startsWith("faction:"));
          if (!f) continue;
          if (f === "faction:leftwing") continue;
          factions.add(String(f));
        }
        c.passiveVpDelta = -factions.size;
      }
      if (bid === "persona_24") {
        c.passiveVpDelta = otherLeft - myLeft;
      }
      if (bid === "persona_33") {
        const chosen = String(c.chosenFactionTag || "");
        if (chosen) {
          const cnt = (coal || []).filter((x) => x.type === "persona" && Array.isArray(x.tags) && x.tags.includes(chosen)).length;
          c.passiveVpDelta = cnt;
        }
      }
      if (bid === "persona_18") {
        const left = i > 0 ? coal[i - 1] : null;
        const right = i < coal.length - 1 ? coal[i + 1] : null;
        const isFbk = (x) => x && x.type === "persona" && Array.isArray(x.tags) && x.tags.includes("faction:fbk");
        const adj = (isFbk(left) ? 1 : 0) + (isFbk(right) ? 1 : 0);
        c.passiveVpDelta = -3 * adj;
      }
      const base = Number(c.baseVp ?? 0);
      const tok = Number(c.vpDelta ?? 0);
      const pas = Number(c.passiveVpDelta ?? 0);
      c.vp = base + tok + pas;
    }
  }
}
function applyTokenDelta2(G, card, delta, _fromP15Mirror = false) {
  try {
    if (delta > 0 && baseId2(String(card?.id || "")) === "persona_43") {
      delta = Math.max(0, delta - 1);
    }
  } catch {
  }
  const prevPlus = Number(card.plusTokens ?? Math.max(0, Number(card.vpDelta || 0)));
  const prevMinus = Number(card.minusTokens ?? Math.max(0, -Number(card.vpDelta || 0)));
  let plus = prevPlus;
  let minus = prevMinus;
  if (delta > 0) plus += delta;
  if (delta < 0) minus += Math.abs(delta);
  card.plusTokens = plus;
  card.minusTokens = minus;
  card.vpDelta = plus - minus;
  const base = Number(card.baseVp ?? 0);
  const tok = Number(card.vpDelta ?? 0);
  const pas = Number(card.passiveVpDelta ?? 0);
  card.vp = base + tok + pas;
  try {
    if (!_fromP15Mirror && delta !== 0 && baseId2(String(card?.id || "")) === "persona_22") {
      const extra = delta > 0 ? 1 : -1;
      const give = delta + extra;
      const turnN = Number(G.turnN || 0);
      for (const pp of G.players || []) {
        for (const cc of pp.coalition || []) {
          if (baseId2(String(cc.id)) !== "persona_15") continue;
          const armedAt = Number(cc._p15ArmedTurn ?? 0);
          if (armedAt && turnN < armedAt) continue;
          applyTokenDelta2(G, cc, give, true);
        }
      }
    }
  } catch {
  }
}
function persona44OnPersonaDiscarded(G) {
  for (const pp of G.players || []) {
    for (const cc of pp.coalition || []) {
      if (baseId2(String(cc.id)) === "persona_44") applyTokenDelta2(G, cc, 1);
    }
  }
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
function factionTitle(tag) {
  switch (String(tag || "")) {
    case "faction:red_nationalist":
      return "\u041A\u0440\u0430\u0441\u043D\u044B\u0439 \u041D\u0430\u0446\u0438\u043E\u043D\u0430\u043B\u0438\u0441\u0442";
    case "faction:liberal":
      return "\u041B\u0438\u0431\u0435\u0440\u0430\u043B";
    case "faction:rightwing":
      return "\u041F\u0440\u0430\u0432\u044B\u0439";
    case "faction:leftwing":
      return "\u041B\u0435\u0432\u044B\u0439";
    case "faction:fbk":
      return "\u0424\u0411\u041A";
    case "faction:system":
      return "\u0421\u0438\u0441\u0442\u0435\u043C\u043D\u044B\u0439";
    case "faction:neutral":
      return "\u041D\u0435\u0439\u0442\u0440\u0430\u043B";
    default:
      return tag;
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
function endGameNow(G, ctx, events) {
  let best = null;
  let bestScore = -1;
  for (const pp of G.players || []) {
    const sc = scorePlayer(pp);
    if (sc > bestScore) {
      bestScore = sc;
      best = pp;
    }
  }
  G.gameOver = true;
  G.winnerId = best ? String(best.id) : null;
  const winnerPlayerId = best ? String(best.id) : null;
  const winnerName = best ? String(best.name || best.id) : null;
  try {
    const scoreNow = (pp) => (pp.coalition || []).reduce((s, c) => s + Number(c.vp || 0), 0);
    const scores = Object.fromEntries((G.players || []).map((pp) => [String(pp.id), scoreNow(pp)]));
    (G.history || (G.history = [])).push({ turn: Number(ctx?.turn || 0), scores });
  } catch {
  }
  G.log.push(`\u0418\u0433\u0440\u0430 \u043E\u043A\u043E\u043D\u0447\u0435\u043D\u0430. \u041F\u043E\u0431\u0435\u0434\u0438\u0442\u0435\u043B\u044C: ${winnerName || best?.id} (${bestScore} vp).`);
  events.endGame?.({ winnerPlayerId, winnerName });
}
function maybeTriggerRoundEnd(G, ctx) {
  if (G.roundEnding) return;
  const trigger = (G.players || []).find((pp) => (pp.coalition || []).length >= 7);
  if (!trigger) return;
  const active = (G.activePlayerIds || []).map(String).filter((id) => {
    const p = (G.players || []).find((pp) => String(pp.id) === String(id));
    return !!p?.active;
  });
  const remaining = Math.max(0, active.length - 1);
  G.roundEnding = true;
  G.roundEndTurn = Number(ctx.turn || 0) + remaining;
  G.log.push(`\u041A\u043E\u043D\u0435\u0446 \u0440\u0430\u0443\u043D\u0434\u0430: \u043A\u0442\u043E-\u0442\u043E \u0441\u043E\u0431\u0440\u0430\u043B 7 \u043A\u0430\u0440\u0442. \u041E\u0441\u0442\u0430\u043B\u043E\u0441\u044C \u0445\u043E\u0434\u043E\u0432: ${remaining}.`);
}
function maybeEndAfterRound(G, ctx, events) {
  if (!G.roundEnding) return false;
  try {
    if (G.pending) return false;
    if (G.response && !responseExpired(G)) return false;
  } catch {
  }
  const t = Number(G.roundEndTurn ?? -1);
  if (t < 0) return false;
  if (Number(ctx.turn || 0) >= t) {
    endGameNow(G, ctx, events);
    return true;
  }
  return false;
}
var nowMs = () => Date.now();
var RESPONSE_ACTION_MS = 15e3;
var RESPONSE_PERSONA_MS = 15e3;
var MAX_COALITION = 7;
function responseExpired(G) {
  const r = G.response;
  if (!r) return true;
  return nowMs() >= Number(r.expiresAtMs || 0) + 900;
}
function expireResponseAndResolveDeferred(G) {
  try {
    if (G.response && responseExpired(G)) G.response = null;
  } catch {
  }
  try {
    maybeResolveDeferredPersona(G);
  } catch {
  }
  try {
    if (!G.pending && !G.response && G.persona16AfterEvents) {
      const q = G.persona16AfterEvents;
      const me = (G.players || []).find((pp) => String(pp.id) === String(q.playerId));
      const events = Array.isArray(q.events) ? q.events : [];
      if (events.length > 0) {
        const next = events.shift();
        q.events = events;
        G.lastEvent = next;
        const title = eventTitle2(next);
        G.log.push(`${ruYou2(me?.name)} \u0432\u044B\u0442\u044F\u043D\u0443\u043B \u0421\u043E\u0431\u044B\u0442\u0438\u0435 "${title}" \u0438\u0437 \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u0438 ${q.sourceCardId}.`);
        runAbility(String(next.abilityKey || ""), { G, me, card: next });
        (G.discard || []).push(next);
      } else {
        G.pending = { kind: "persona_16_discard3_from_hand", playerId: String(q.playerId), sourceCardId: String(q.sourceCardId) };
        G.persona16AfterEvents = null;
      }
    }
  } catch {
  }
  try {
    if (!G.pending && G.pendingDeferred) {
      G.pending = G.pendingDeferred;
      G.pendingDeferred = null;
    }
  } catch {
  }
}
function actorWithPersona(me, personaBase) {
  const p = (me?.coalition || []).find((c) => baseId2(String(c.id)) === String(personaBase));
  const pname = String(p?.name || p?.text || personaBase);
  return `${ruYou2(me?.name)} ${pname}`;
}
function applyAdjacencyBonusesAround(G, owner, placedCard) {
  try {
    if (!owner || !placedCard) return;
    const idx = (owner.coalition || []).findIndex((c) => String(c.id) === String(placedCard.id));
    if (idx < 0) return;
    const neighbors = [];
    if (idx > 0) neighbors.push(owner.coalition[idx - 1]);
    if (idx < (owner.coalition || []).length - 1) neighbors.push(owner.coalition[idx + 1]);
    for (const n of neighbors) {
      if (!n || n.type !== "persona") continue;
      if (String(n.abilityKey || "") !== "on_enter_adjacent_bonus") continue;
      try {
        runAbility("on_enter_adjacent_bonus", { G, me: owner, card: n });
      } catch {
      }
    }
  } catch {
  }
}
function maybeResolveDeferredPersona(G) {
  const pend = G.pending;
  if (!pend || pend.kind !== "resolve_persona_after_response") return false;
  if (G.response && !responseExpired(G)) return false;
  if (G.response && responseExpired(G)) G.response = null;
  try {
    const pid = String(pend.personaId || "");
    const owner = (G.players || []).find((pp) => (pp.coalition || []).some((cc) => String(cc.id) === pid));
    const card = owner?.coalition?.find((cc) => String(cc.id) === pid);
    if (owner && card) {
      const key = String(pend.abilityKey || card.abilityKey || "");
      if (key) runAbility(key, { G, me: owner, card });
      applyAdjacencyBonusesAround(G, owner, card);
    }
  } catch {
  }
  try {
    const pk = G.pending;
    if (pk && pk.kind === "resolve_persona_after_response") G.pending = null;
  } catch {
  }
  try {
    recalcPassives(G);
  } catch {
  }
  return true;
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
  setup: ({ ctx }) => {
    const numPlayers = ctx.numPlayers;
    const defs = Object.values(POLITIKUM_CARDS || {});
    const personaDefs = defs.filter((d) => d.type === "persona");
    const actionDefs = defs.filter((d) => d.type === "action");
    const eventDefs = defs.filter((d) => d.type === "event");
    const personas = materializeCopies(personaDefs);
    const actions = materializeCopies(actionDefs);
    const events = materializeCopies(eventDefs);
    const preDealDeck = shuffle([...personas, ...actions]);
    const eventDeck = shuffle([...events]);
    const players = range(numPlayers).map((n) => {
      const id = String(n - 1);
      if (n === 1) {
        return { id, name: "You", hand: [], coalition: [], isBot: false, active: true };
      }
      return { id, name: `[H] Seat ${id}`, hand: [], coalition: [], isBot: false, active: false };
    });
    const scores0 = Object.fromEntries(players.map((pp) => [String(pp.id), 0]));
    return {
      players,
      deck: [],
      discard: [],
      preDealDeck,
      eventDeck,
      activePlayerIds: ["0"],
      log: ["Politikum: lobby opened."],
      chat: [],
      history: [{ turn: 0, scores: scores0 }],
      pending: null,
      response: null,
      botNextActAtMs: null,
      botPauseUntilMs: null,
      hasDrawn: false,
      hasPlayed: false,
      playsThisTurn: 0,
      maxPlaysThisTurn: 1,
      playVpDelta: 0,
      drawsThisTurn: 0
    };
  },
  phases: {
    lobby: {
      start: true,
      next: "action",
      turn: { activePlayers: { all: "lobby" } }
    },
    action: {
      turn: {
        // Only rotate through active seats (chosen in lobby).
        order: {
          first: ({ G }) => {
            const id = String((G.activePlayerIds || [])[0] || "0");
            return parseInt(id, 10) || 0;
          },
          next: ({ G, ctx }) => {
            const ids = (G.activePlayerIds || []).map(String).filter(Boolean);
            if (!ids.length) return (Number(ctx.playOrderPos || 0) + 1) % Number(ctx.numPlayers || 1);
            const cur = String(ctx.currentPlayer);
            const i = ids.indexOf(cur);
            const nextId = ids[(i >= 0 ? i + 1 : 0) % ids.length];
            return parseInt(String(nextId), 10) || 0;
          }
        },
        // allow out-of-turn cancels; we enforce legality inside moves
        activePlayers: { all: "all" },
        onBegin: ({ G, ctx, events }) => {
          try {
            if (G.roundEnding) {
              const t = Number(G.roundEndTurn ?? -1);
              if (t >= 0 && Number(ctx?.turn || 0) >= t && !G.pending && !G.response) {
                endGameNow(G, ctx, events);
                return;
              }
            }
          } catch {
          }
          G.turnStartedAtMs = nowMs();
          G.turnN = Number(ctx?.turn || 0);
          G.hasDrawn = false;
          G.hasPlayed = false;
          G.playsThisTurn = 0;
          G.maxPlaysThisTurn = 1;
          G.playVpDelta = 0;
          G.drawsThisTurn = 0;
          try {
            const cur = (G.players || []).find((pp) => String(pp.id) === String(ctx.currentPlayer));
            const isBot = !!cur?.isBot || String(cur?.name || "").startsWith("[B]");
            if (cur && isBot) {
              const drawn = drawTopCardForPlayer2(G, cur);
              G.hasDrawn = true;
              G.drawsThisTurn = drawn ? 1 : 0;
            } else if (cur && cur.skipMandatoryDrawThisTurn) {
              cur.skipMandatoryDrawThisTurn = false;
              G.hasDrawn = true;
              G.drawsThisTurn = 0;
              G.log.push(`${ruYou2(cur.name)} пропускает обязательный добор в начале хода.`);
            } else {
              G.hasDrawn = false;
              G.drawsThisTurn = 0;
            }
            G.botNextActAtMs = isBot ? nowMs() + 2e3 : null;
          } catch {
            G.botNextActAtMs = null;
          }
          try {
            const me = (G.players || []).find((pp) => String(pp.id) === String(ctx.currentPlayer));
            if (me && (me.coalition || []).some((c) => baseId2(String(c.id)) === "persona_11")) {
              const haveTargets = (G.players || []).some((pp) => {
                if (String(pp.id) === String(me.id)) return false;
                return (pp.coalition || []).some((c) => c.type === "persona" && baseId2(String(c.id)) !== "persona_31" && !c.shielded);
              });
              if (haveTargets) {
                G.pending = { kind: "persona_11_offer", playerId: String(me.id), sourceCardId: "persona_11" };
              }
            }
          } catch {
          }
        },
        onEnd: ({ G, ctx, events }) => {
          try {
            const scoreNow = (pp) => (pp.coalition || []).reduce((s, c) => s + Number(c.vp || 0), 0);
            const scores = Object.fromEntries((G.players || []).map((pp) => [String(pp.id), scoreNow(pp)]));
            (G.history || (G.history = [])).push({ turn: Number(ctx.turn || 0), scores });
          } catch {
          }
          try {
            if (!G.gameOver && Array.isArray(G.deck) && G.deck.length <= 0) {
              endGameNow(G, ctx, events);
            }
          } catch {
          }
        }
        // (bot actions are driven by moves.tickBot for pacing)
      }
    }
  },
  moves: wrapMoves({
    setPlayerIdentity: ({ G, ctx, playerID }, payload) => {
      if (String(ctx.phase || "") !== "lobby") return INVALID_MOVE2;
      const p = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!p) return INVALID_MOVE2;
      const playerId = String(payload?.playerId || "").trim();
      const email = payload?.email == null ? null : String(payload.email || "").trim().toLowerCase();
      if (!playerId) return INVALID_MOVE2;
      p.identity = { playerId, email };
      return;
    },
    setPlayerName: ({ G, ctx, playerID }, name) => {
      if (String(ctx.phase || "") !== "lobby") return INVALID_MOVE2;
      const p = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!p) return INVALID_MOVE2;
      const n = String(name || "").trim();
      if (!n) return INVALID_MOVE2;
      p.name = n;
      p.isBot = false;
      p.active = true;
      const ids = new Set((G.activePlayerIds || []).map(String));
      ids.add(String(p.id));
      const rest = Array.from(ids).filter((x) => x !== "0").sort((a, b) => Number(a) - Number(b));
      G.activePlayerIds = ["0", ...rest];
      G.log.push(`${ruYou2(p.name)} \u0433\u043E\u0442\u043E\u0432.`);
    },
    addBot: ({ G, ctx, playerID }) => {
      if (String(ctx.phase || "") !== "lobby") return INVALID_MOVE2;
      if (String(playerID) !== "0") return INVALID_MOVE2;
      const BOT_NAMES = [
        "Runov",
        "Serezhko",
        "SVTV",
        "Yashin",
        "Pevchih",
        "Kashin",
        "Kasparov",
        "Lazerson",
        "Ponomarev",
        "Naki",
        "Solovei",
        "Savin",
        "Venediktov",
        "Roizman",
        "Pozharskii",
        "Kaz",
        "Arno",
        "Sobol",
        "Girkin",
        "Bykov",
        "Shtefanov",
        "Svetov",
        "Volkov",
        "Latynina",
        "Nadezhdin",
        "Demushkin",
        "Yudin",
        "Veduta",
        "Yuneman",
        "Hodorkovsky",
        "Shlosberg",
        "Plushev",
        "Sobchak",
        "Milov",
        "Zhdanov",
        "Kagalicky",
        "Guriev",
        "VotVot",
        "Left",
        "Duncova",
        "Dozd",
        "Strelkov",
        "Doxa",
        "Rudoi",
        "Shulman"
      ];
      const pickBotName = () => BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
      const seat = (G.players || []).find((pp) => String(pp.id) !== "0" && !pp.active);
      if (!seat) return INVALID_MOVE2;
      seat.isBot = true;
      seat.active = true;
      seat.name = `[B] ${pickBotName()}`;
      const ids = new Set((G.activePlayerIds || []).map(String));
      ids.add(String(seat.id));
      const rest = Array.from(ids).filter((x) => x !== "0").sort((a, b) => Number(a) - Number(b));
      G.activePlayerIds = ["0", ...rest];
      G.log.push(`${seat.name} \u043F\u0440\u0438\u0441\u043E\u0435\u0434\u0438\u043D\u0438\u043B\u0441\u044F.`);
    },
    removePlayer: ({ G, ctx, playerID }, targetId) => {
      if (String(ctx.phase || "") !== "lobby") return INVALID_MOVE2;
      if (String(playerID) !== "0") return INVALID_MOVE2;
      if (String(targetId) === "0") return INVALID_MOVE2;
      const p = (G.players || []).find((pp) => String(pp.id) === String(targetId));
      if (!p) return INVALID_MOVE2;
      p.isBot = false;
      p.active = false;
      p.name = `[H] Seat ${String(p.id)}`;
      const ids = (G.activePlayerIds || []).map(String).filter((x) => x !== String(targetId));
      const rest = Array.from(new Set(ids)).filter((x) => x !== "0").sort((a, b) => Number(a) - Number(b));
      G.activePlayerIds = ["0", ...rest];
      G.log.push(`\u041C\u0435\u0441\u0442\u043E ${String(targetId)} \u043E\u0441\u0432\u043E\u0431\u043E\u0436\u0434\u0435\u043D\u043E.`);
    },
    submitChat: ({ G }, text, sender) => {
      const msg = String(text || "").trim();
      if (!msg) return INVALID_MOVE2;
      (G.chat || (G.chat = [])).push({ sender: String(sender || "Anon"), text: msg });
      if ((G.chat || []).length > 80) G.chat = (G.chat || []).slice(-80);
    },
    forceSkipTurn: ({ G, ctx, playerID, events }) => {
      if (String(ctx.phase || "") !== "action") return INVALID_MOVE2;
      const cur = (G.players || []).find((pp) => String(pp.id) === String(ctx.currentPlayer));
      const curIsBot = !!cur?.isBot || String(cur?.name || "").startsWith("[B]");
      if (!curIsBot) return INVALID_MOVE2;
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
        G.log.push(`${ruYou2(cur?.name || "Bot")} turn force-skipped by ${ruYou2((G.players || []).find((pp) => String(pp.id) === String(playerID))?.name || playerID)}.`);
      } catch {
      }
      try {
        if (maybeEndAfterRound(G, ctx, events)) return;
      } catch {
      }
      events.endTurn?.();
    },
    startGame: ({ G, ctx, playerID, events }) => {
      if (String(ctx.phase || "") !== "lobby") return INVALID_MOVE2;
      if (String(playerID) !== "0") return INVALID_MOVE2;
      const activeIds = (G.activePlayerIds || []).map(String).filter((id) => {
        const p = (G.players || []).find((pp) => String(pp.id) === id);
        return !!p?.active;
      });
      if (activeIds.length < 2) return INVALID_MOVE2;
      try {
        const names = activeIds.map((id) => (G.players || []).find((pp) => String(pp.id) === String(id))?.name || id);
        (G.chat || (G.chat = [])).push({ sender: "System", text: `Game starting: ${names.join(", ")}` });
      } catch {
      }
      for (const p of G.players || []) {
        p.hand = [];
        p.coalition = [];
      }
      const pre = shuffle([...G.preDealDeck || []]);
      const evs = shuffle([...G.eventDeck || []]);
      for (let k = 0; k < 5; k++) {
        for (const id of activeIds) {
          const c = pre.shift();
          if (!c) break;
          const p = (G.players || []).find((pp) => String(pp.id) === String(id));
          if (p) p.hand.push(c);
        }
      }
      G.deck = shuffle([...pre, ...evs]);
      G.discard = [];
      G.pending = null;
      G.response = null;
      G.gameOver = false;
      G.winnerId = null;
      G.roundEnding = false;
      G.roundEndTurn = null;
      G.lastEvent = null;
      G.lastAction = null;
      G.hasDrawn = false;
      G.hasPlayed = false;
      G.playsThisTurn = 0;
      G.maxPlaysThisTurn = 1;
      G.playVpDelta = 0;
      G.drawsThisTurn = 0;
      const rest = activeIds.filter((x) => x !== "0").sort((a, b) => Number(a) - Number(b));
      G.activePlayerIds = ["0", ...rest];
      const scoreNow = (pp) => (pp.coalition || []).reduce((s, c) => s + Number(c.vp || 0), 0);
      const scores0 = Object.fromEntries((G.players || []).map((pp) => [String(pp.id), scoreNow(pp)]));
      G.history = [{ turn: 0, scores: scores0 }];
      G.log.push(`Politikum: \u0441\u0442\u0430\u0440\u0442 \u0438\u0433\u0440\u044B \u2014 \u0438\u0433\u0440\u043E\u043A\u043E\u0432: ${activeIds.length}.`);
      events.setPhase?.("action");
      events.endTurn?.({ next: "0" });
    },
    skipResponseWindow: ({ G, ctx, playerID, events }) => {
      const r = G.response;
      if (!r) return INVALID_MOVE2;
      G.response = null;
      try {
        maybeResolveDeferredPersona(G);
      } catch {
      }
      try {
        recalcPassives(G);
      } catch {
      }
      try {
        if (String(ctx?.currentPlayer || "") === String(playerID) && !G.response && !G.pending && G.hasDrawn && G.hasPlayed) {
          if (maybeEndAfterRound(G, ctx, events)) return;
          events.endTurn?.();
        }
      } catch {
      }
    },
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
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_12_choose_adjacent_red") return INVALID_MOVE2;
      if (String(playerID) !== String(ctx.currentPlayer)) return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      const candidates = [String(pend.leftId || ""), String(pend.rightId || "")].filter(Boolean).map((id) => (me.coalition || []).find((c) => String(c.id) === id)).filter((t) => t && t.type === "persona" && Array.isArray(t.tags) && t.tags.includes("faction:red_nationalist") && !t.shielded);
      if (!candidates.length) {
        G.log.push(`${me.name} (${pend.sourceCardId}) has no valid adjacent target anymore; ability skipped.`);
        G.pending = null;
        recalcPassives(G);
        return;
      }
      if (candidates.length === 1 && !String(targetCoalitionCardId || "")) {
        const only = candidates[0];
        applyTokenDelta2(G, only, 2);
        G.log.push(`${me.name} (${pend.sourceCardId}) auto-buffed ${only.name || only.id} (+2).`);
        G.pending = null;
        recalcPassives(G);
        return;
      }
      const tid = String(targetCoalitionCardId || "");
      if (!(tid === String(pend.leftId) || tid === String(pend.rightId))) return INVALID_MOVE2;
      const t = (me.coalition || []).find((c) => String(c.id) === tid);
      if (!t || t.type !== "persona") return INVALID_MOVE2;
      if (!Array.isArray(t.tags) || !t.tags.includes("faction:red_nationalist")) return INVALID_MOVE2;
      if (t.shielded) return INVALID_MOVE2;
      applyTokenDelta2(G, t, 2);
      G.log.push(`${me.name} (${pend.sourceCardId}) buffed ${t.name || t.id} (+2).`);
      G.pending = null;
      recalcPassives(G);
      return;
    },
    persona5PickLiberal: ({ G, ctx, playerID, events }, ownerId, coalitionCardId) => {
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_5_pick_liberal") return INVALID_MOVE2;
      if (String(playerID) !== String(ctx.currentPlayer)) return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      const self = (me.coalition || []).find((c) => String(c.id) === String(pend.sourceCardId));
      if (!self) return INVALID_MOVE2;
      const owner = (G.players || []).find((pp) => String(pp.id) === String(ownerId));
      if (!owner || String(owner.id) === String(playerID)) return INVALID_MOVE2;
      const idx = (owner.coalition || []).findIndex((c) => String(c.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE2;
      const target = owner.coalition[idx];
      if (target?.shielded) return INVALID_MOVE2;
      if (!Array.isArray(target?.tags) || !target.tags.includes("faction:liberal")) return INVALID_MOVE2;
      const [drop] = owner.coalition.splice(idx, 1);
      if (drop) G.discard.push(drop);
      const tok = Number(drop?.vpDelta || 0);
      if (tok) {
        applyTokenDelta2(G, self, tok);
        drop.vpDelta = 0;
        drop.plusTokens = 0;
        drop.minusTokens = 0;
      }
      G.log.push(`${ruYou2(me.name)} (${self?.name || self?.text || "persona_5"}): \u0441\u0431\u0440\u043E\u0441\u0438\u043B ${drop?.name || drop?.id} \u0438 \u0443\u043A\u0440\u0430\u043B ${tok} \u0436\u0435\u0442\u043E\u043D(\u043E\u0432).`);
      G.pending = null;
      recalcPassives(G);
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
    // Hand limit: if you end turn with >7 cards, discard down to 7 by clicking hand cards.
    discardFromHandDownTo7: ({ G, ctx, playerID }, cardId) => {
      const pend = G.pending;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      if (!pend || pend.kind !== "discard_down_to_7") {
        const isCurrent = String(ctx?.currentPlayer || "") === String(playerID);
        const overLimit = Number((me.hand || []).length) > 7;
        if (!isCurrent || !overLimit) return INVALID_MOVE2;
      } else {
        if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      }
      const idx = (me.hand || []).findIndex((c) => String(c.id) === String(cardId));
      if (idx < 0) return INVALID_MOVE2;
      const [drop] = me.hand.splice(idx, 1);
      if (drop) {
        G.discard.push(drop);
        if (drop.type === "persona") persona44OnPersonaDiscarded(G);
      }
      if (Number((me.hand || []).length) <= 7) {
        G.pending = null;
      }
      recalcPassives(G);
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
    persona7SwapTwoInCoalition: ({ G, ctx, playerID }, ownerId, firstPersonaId, secondPersonaId) => {
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_7_swap_two_in_coalition") return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      if (String(ctx?.currentPlayer || "") !== String(playerID)) return INVALID_MOVE2;
      const fid = String(firstPersonaId || "");
      const sid = String(secondPersonaId || "");
      if (!fid || !sid || fid === sid) return INVALID_MOVE2;
      let owner = (G.players || []).find((pp) => String(pp.id) === String(ownerId));
      const findOwnerByBoth = () => {
        return (G.players || []).find((pp) => {
          const ids = new Set((pp.coalition || []).map((c) => String(c?.id || "")));
          return ids.has(fid) && ids.has(sid);
        });
      };
      if (!owner) owner = findOwnerByBoth();
      const idxA0 = (owner?.coalition || []).findIndex((c) => String(c.id) === fid);
      const idxB0 = (owner?.coalition || []).findIndex((c) => String(c.id) === sid);
      if (!owner || idxA0 < 0 || idxB0 < 0) owner = findOwnerByBoth();
      const idxA = (owner?.coalition || []).findIndex((c) => String(c.id) === fid);
      const idxB = (owner?.coalition || []).findIndex((c) => String(c.id) === sid);
      if (!owner || idxA < 0 || idxB < 0 || idxA === idxB) return INVALID_MOVE2;
      const ca = owner.coalition[idxA];
      const cb = owner.coalition[idxB];
      if (!ca || !cb || ca.type !== "persona" || cb.type !== "persona") return INVALID_MOVE2;
      owner.coalition[idxA] = cb;
      owner.coalition[idxB] = ca;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      G.log.push(`${ruYou2(me?.name || playerID)} \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043B\u0438 \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C \u041A\u0430\u0441\u043F\u0430\u0440\u043E\u0432\u0430 \u0438 \u043F\u043E\u043C\u0435\u043D\u044F\u043B\u0438 \u043C\u0435\u0441\u0442\u0430\u043C\u0438 ${ca.name || ca.id} \u0438 ${cb.name || cb.id} \u0443 ${owner.name}.`);
      G.pending = null;
      recalcPassives(G);
    },
    // Persona 8: swap Lazerson (p8) with the just-played persona (during cancel_persona response window)
    persona8SwapWithPlayedPersona: ({ G, playerID }) => {
      const r = G.response;
      if (!r || r.kind !== "cancel_persona") return INVALID_MOVE2;
      if (responseExpired(G)) return INVALID_MOVE2;
      const spec = r.persona8Swap;
      if (!spec || String(spec.playerId) !== String(playerID)) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      const owner = (G.players || []).find((pp) => String(pp.id) === String(spec.ownerId));
      if (!me || !owner) return INVALID_MOVE2;
      const iP8 = (me.coalition || []).findIndex((c) => baseId2(String(c.id)) === "persona_8");
      if (iP8 < 0) return INVALID_MOVE2;
      const iPlayed = (owner.coalition || []).findIndex((c) => String(c.id) === String(spec.playedPersonaId));
      if (iPlayed < 0) return INVALID_MOVE2;
      const p8 = me.coalition[iP8];
      const played = owner.coalition[iPlayed];
      p8._p8Used = true;
      if (!p8 || !played || p8.type !== "persona" || played.type !== "persona") return INVALID_MOVE2;
      me.coalition.splice(iP8, 1);
      owner.coalition[iPlayed] = p8;
      me.coalition.push(played);
      try {
        for (const pp of G.players || []) {
          const hi = (pp.hand || []).findIndex((c) => String(c.id) === String(played.id));
          if (hi >= 0) pp.hand.splice(hi, 1);
        }
      } catch {
      }
      G.log.push(`${actorWithPersona(me, "persona_8")} \u043F\u043E\u043C\u0435\u043D\u044F\u043B\u0441\u044F \u0441 ${played.name || played.id}.`);
      recalcPassives(G);
      G.response = null;
    },
    // Persona 10 (Naki): discard persona_10 from YOUR COALITION to cancel an effect targeting your coalition
    persona10CancelFromHand: ({ G, playerID }, _cardId) => {
      const r = G.response;
      if (!r || r.kind !== "cancel_action") return INVALID_MOVE2;
      if (responseExpired(G)) return INVALID_MOVE2;
      if (String(r.allowPersona10By || "") !== String(playerID)) return INVALID_MOVE2;
      if (!(G.pending?.kind === "action_4_discard" || G.pending?.kind === "action_9_discard_persona")) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      const idx = (me.coalition || []).findIndex((c) => c?.type === "persona" && baseId2(String(c.id)) === "persona_10");
      if (idx < 0) return INVALID_MOVE2;
      const [drop] = (me.coalition || []).splice(idx, 1);
      if (drop) {
        G.discard.push(drop);
        if (drop.type === "persona") persona44OnPersonaDiscarded(G);
      }
      G.pending = null;
      G.response = null;
      G.log.push(`${ruYou2(me.name)} \u0441\u0431\u0440\u043E\u0441\u0438\u043B ${drop?.name || drop?.id || "persona_10"}, \u043E\u0442\u043C\u0435\u043D\u0438\u0432 \u044D\u0444\u0444\u0435\u043A\u0442 \u043D\u0430 \u0441\u0432\u043E\u0435\u0439 \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u0438.`);
      recalcPassives(G);
    },
    persona10CancelFromCoalition: ({ G, playerID }) => {
      const r = G.response;
      if (!r || r.kind !== "cancel_action") return INVALID_MOVE2;
      if (responseExpired(G)) return INVALID_MOVE2;
      if (String(r.allowPersona10By || "") !== String(playerID)) return INVALID_MOVE2;
      if (!(G.pending?.kind === "action_4_discard" || G.pending?.kind === "action_9_discard_persona")) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      const idx = (me.coalition || []).findIndex((c) => c?.type === "persona" && baseId2(String(c.id)) === "persona_10");
      if (idx < 0) return INVALID_MOVE2;
      const [drop] = (me.coalition || []).splice(idx, 1);
      if (drop) {
        G.discard.push(drop);
        if (drop.type === "persona") persona44OnPersonaDiscarded(G);
      }
      G.pending = null;
      G.response = null;
      G.log.push(`${ruYou2(me.name)} \u0441\u0431\u0440\u043E\u0441\u0438\u043B ${drop?.name || drop?.id || "persona_10"}, \u043E\u0442\u043C\u0435\u043D\u0438\u0432 \u044D\u0444\u0444\u0435\u043A\u0442 \u043D\u0430 \u0441\u0432\u043E\u0435\u0439 \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u0438.`);
      recalcPassives(G);
    },
    // Persona 45: on-enter, choose opponent then steal 1 facedown card from their hand.
    persona21InvertTokens: ({ G, playerID }, ownerId, coalitionCardId) => {
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_21_pick_target_invert") return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      const owner = (G.players || []).find((pp) => String(pp.id) === String(ownerId));
      if (!owner) return INVALID_MOVE2;
      const idx = (owner.coalition || []).findIndex((c) => String(c.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE2;
      const target = owner.coalition[idx];
      if (!target || target.type !== "persona") return INVALID_MOVE2;
      const before = Number(target.vpDelta || 0);
      const prevPlus = Number(target.plusTokens ?? Math.max(0, before));
      const prevMinus = Number(target.minusTokens ?? Math.max(0, -before));
      target.plusTokens = prevMinus;
      target.minusTokens = prevPlus;
      target.vpDelta = -before;
      recalcPassives(G);
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      G.log.push(`${ruYou2(me?.name || playerID)} \u043F\u0435\u0440\u0435\u0432\u0435\u0440\u043D\u0443\u043B \u0436\u0435\u0442\u043E\u043D\u044B \u043D\u0430 ${target.name || target.id} (${before} \u2192 ${target.vpDelta}).`);
      G.pending = null;
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
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_26_pick_red_nationalist") return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      const self = (me.coalition || []).find((c) => baseId2(String(c.id)) === "persona_26");
      if (!self) return INVALID_MOVE2;
      const owner = (G.players || []).find((pp) => String(pp.id) === String(ownerId));
      if (!owner) return INVALID_MOVE2;
      const idx = (owner.coalition || []).findIndex((c) => String(c.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE2;
      const target = owner.coalition[idx];
      if (!target || target.type !== "persona") return INVALID_MOVE2;
      if (!Array.isArray(target.tags) || !target.tags.includes("faction:red_nationalist")) return INVALID_MOVE2;
      if (target.shielded) return INVALID_MOVE2;
      const plus = Math.max(0, Number(target.vpDelta || 0));
      owner.coalition.splice(idx, 1);
      G.discard.push(target);
      if (target.type === "persona") persona44OnPersonaDiscarded(G);
      if (plus) applyTokenDelta2(G, self, plus);
      recalcPassives(G);
      G.log.push(`${actorWithPersona(me, "persona_26")} \u0441\u0431\u0440\u043E\u0441\u0438\u043B ${target.name || target.id} \u0438 \u0443\u043D\u0430\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043B ${plus} \xD7 +1.`);
      G.pending = null;
    },
    persona28StealPlusTokens: ({ G, playerID }, ownerId, coalitionCardId, n) => {
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_28_pick_non_fbk") return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      const self = (me.coalition || []).find((c) => baseId2(String(c.id)) === "persona_28");
      if (!self) return INVALID_MOVE2;
      const owner = (G.players || []).find((pp) => String(pp.id) === String(ownerId));
      if (!owner) return INVALID_MOVE2;
      const idx = (owner.coalition || []).findIndex((c) => String(c.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE2;
      const target = owner.coalition[idx];
      if (!target || target.type !== "persona") return INVALID_MOVE2;
      if (Array.isArray(target.tags) && target.tags.includes("faction:fbk")) return INVALID_MOVE2;
      if (target.shielded) return INVALID_MOVE2;
      const want = Math.max(0, Math.min(3, Number(n ?? 3)));
      const avail = Math.max(0, Number(target.vpDelta || 0));
      const take = Math.min(want, avail);
      if (take) {
        applyTokenDelta2(G, target, -take);
        applyTokenDelta2(G, self, take);
      }
      recalcPassives(G);
      G.log.push(`${actorWithPersona(me, "persona_28")} \u0443\u043A\u0440\u0430\u043B ${take} \xD7 +1 \u0443 ${target.name || target.id}.`);
      G.pending = null;
    },
    // Persona 11 (Solovei): optional at start of turn
    persona11Skip: ({ G, ctx, playerID }) => {
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_11_offer") return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      if (String(ctx.currentPlayer) !== String(playerID)) return INVALID_MOVE2;
      G.pending = null;
    },
    persona11Use: ({ G, ctx, playerID }) => {
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_11_offer") return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      if (String(ctx.currentPlayer) !== String(playerID)) return INVALID_MOVE2;
      if (G.hasDrawn) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      const i11 = (me.coalition || []).findIndex((c) => baseId2(String(c.id)) === "persona_11");
      if (i11 < 0) return INVALID_MOVE2;
      const haveTargets = (G.players || []).some((pp) => {
        if (String(pp.id) === String(me.id)) return false;
        return (pp.coalition || []).some((c) => c.type === "persona" && baseId2(String(c.id)) !== "persona_31" && !c.shielded);
      });
      if (!haveTargets) {
        G.pending = null;
        return INVALID_MOVE2;
      }
      G.log.push(`${ruYou2(me.name)} \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442 \u0421\u043E\u043B\u043E\u0432\u044C\u044F: \u0434\u043E\u0431\u043E\u0440 \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D.`);
      G.pending = { kind: "persona_11_pick_opponent_persona", playerId: String(playerID), sourceCardId: "persona_11" };
    },
    persona11DiscardOpponentPersona: ({ G, ctx, playerID, events }, ownerId, coalitionCardId) => {
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_11_pick_opponent_persona") return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      if (String(ctx.currentPlayer) !== String(playerID)) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      const i11 = (me.coalition || []).findIndex((c) => baseId2(String(c.id)) === "persona_11");
      if (i11 < 0) return INVALID_MOVE2;
      const owner = (G.players || []).find((pp) => String(pp.id) === String(ownerId));
      if (!owner || String(owner.id) === String(playerID)) return INVALID_MOVE2;
      const idx = (owner.coalition || []).findIndex((c) => String(c.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE2;
      const target = owner.coalition[idx];
      if (!target || target.type !== "persona") return INVALID_MOVE2;
      if (target.shielded) return INVALID_MOVE2;
      const [sol] = me.coalition.splice(i11, 1);
      if (sol) {
        G.discard.push(sol);
        if (sol.type === "persona") persona44OnPersonaDiscarded(G);
      }
      const [drop] = owner.coalition.splice(idx, 1);
      if (drop) {
        G.discard.push(drop);
        if (drop.type === "persona") persona44OnPersonaDiscarded(G);
      }
      G.log.push(`${ruYou2(me.name)} (\u0421\u043E\u043B\u043E\u0432\u0435\u0439): \u0441\u0431\u0440\u043E\u0441\u0438\u043B \u0441\u0435\u0431\u044F \u0438 ${drop?.name || drop?.id} \u0443 ${owner.name}.`);
      G.pending = null;
      recalcPassives(G);
    },
    // Persona 17 (Arno): choose opponent, reveal hand, steal a persona into your hand.
    persona17PickOpponent: ({ G, ctx, playerID, events }, targetId) => {
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_17_pick_opponent") return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      if (String(ctx.currentPlayer) !== String(playerID)) return INVALID_MOVE2;
      const tid = String(targetId || "");
      if (!tid || tid === String(playerID)) return INVALID_MOVE2;
      const target = (G.players || []).find((pp) => String(pp.id) === tid);
      if (!target) return INVALID_MOVE2;
      const personaCount = (target.hand || []).filter((c) => c && c.type === "persona").length;
      if (personaCount <= 0) {
        G.log.push(`${ruYou2(String((G.players || []).find((pp) => String(pp.id) === String(playerID))?.name || ""))} (\u0410\u0440\u043D\u043E): \u0443 ${target.name} \u043D\u0435\u0442 \u043F\u0435\u0440\u0441\u043E\u043D \u0432 \u0440\u0443\u043A\u0435 (\u043F\u0440\u043E\u043F\u0443\u0441\u043A).`);
        G.pending = null;
        recalcPassives(G);
        if (G.hasDrawn && G.hasPlayed && !G.response) {
          if (maybeEndAfterRound(G, ctx, events)) return;
          events.endTurn?.();
        }
        return;
      }
      G.pending = { kind: "persona_17_pick_persona_from_hand", playerId: String(playerID), sourceCardId: String(pend.sourceCardId || "persona_17"), targetId: tid };
    },
    persona17StealPersonaFromHand: ({ G, ctx, playerID }, cardId) => {
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_17_pick_persona_from_hand") return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      if (String(ctx.currentPlayer) !== String(playerID)) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      const target = (G.players || []).find((pp) => String(pp.id) === String(pend.targetId));
      if (!me || !target) return INVALID_MOVE2;
      const idx = (target.hand || []).findIndex((c2) => String(c2.id) === String(cardId));
      if (idx < 0) return INVALID_MOVE2;
      const c = target.hand[idx];
      if (!c || c.type !== "persona") return INVALID_MOVE2;
      target.hand.splice(idx, 1);
      me.hand.push(c);
      G.log.push(`${ruYou2(me.name)} (\u0410\u0440\u043D\u043E) \u0437\u0430\u0431\u0440\u0430\u043B ${c.name || c.id} \u0438\u0437 \u0440\u0443\u043A\u0438 ${target.name}.`);
      G.pending = null;
      recalcPassives(G);
    },
    // Persona 32: return a chosen persona from your coalition to your hand.
    persona32BounceToHand: ({ G, playerID }, coalitionCardId) => {
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_32_pick_bounce_target") return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      const idx = (me.coalition || []).findIndex((c) => String(c.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE2;
      const target = me.coalition[idx];
      if (!target || target.type !== "persona") return INVALID_MOVE2;
      me.coalition.splice(idx, 1);
      me.hand.push(target);
      G.log.push(`${actorWithPersona(me, "persona_32")} \u0432\u0435\u0440\u043D\u0443\u043B ${target.name || target.id} \u0432 \u0440\u0443\u043A\u0443.`);
      G.pending = null;
      recalcPassives(G);
    },
    // Generic cancel for selected pendings (stability)
    cancelPending: ({ G, ctx, playerID }) => {
      const pend = G.pending;
      if (!pend) return;
      const ownerId = String(pend.playerId || pend.attackerId || pend.targetId || "");
      if (ownerId && String(ownerId) !== String(playerID)) return INVALID_MOVE2;
      if (String(ctx.currentPlayer) !== String(playerID)) return INVALID_MOVE2;
      const k = String(pend.kind || "");
      const ALLOW = /* @__PURE__ */ new Set([
        "persona_3_choice",
        "persona_5_pick_liberal",
        "persona_7_swap_two_in_coalition",
        "persona_11_offer",
        "persona_11_pick_opponent_persona",
        "persona_13_pick_target",
        "persona_16_discard3_from_hand",
        "persona_17_pick_opponent",
        "persona_17_pick_persona_from_hand",
        "persona_20_pick_from_discard",
        "persona_21_pick_target_invert",
        "persona_23_choose_self_inflict_draw",
        "persona_26_pick_red_nationalist",
        "persona_28_pick_non_fbk",
        "persona_32_pick_bounce_target",
        "persona_33_choose_faction",
        "persona_34_guess_topdeck",
        "persona_37_pick_opponent_persona",
        "persona_45_steal_from_opponent",
        "action_7_block_persona",
        "action_13_shield_persona",
        "action_17_choose_opponent_persona",
        "action_18_pick_persona_from_discard"
      ]);
      if (!ALLOW.has(k)) return INVALID_MOVE2;
      if (k === "action_7_block_persona") {
        try {
          const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
          const la = G.lastAction;
          if (me && la && baseId2(String(la.id)) === "action_7") {
            const di = (G.discard || []).findIndex((cc) => String(cc.id) === String(la.id));
            if (di >= 0) {
              const [back] = (G.discard || []).splice(di, 1);
              if (back) me.hand.push(back);
            }
            G.lastAction = null;
            G.hasPlayed = false;
          }
        } catch {
        }
      }
      G.pending = null;
      try {
        recalcPassives(G);
      } catch {
      }
    },
    // Persona 32: cancel (do nothing)
    persona32CancelBounce: ({ G, playerID }) => {
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_32_pick_bounce_target") return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      G.pending = null;
    },
    persona37BribeAndSilence: ({ G, playerID }, ownerId, coalitionCardId) => {
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_37_pick_opponent_persona") return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      const owner = (G.players || []).find((pp) => String(pp.id) === String(ownerId));
      if (!owner || String(owner.id) === String(playerID)) return INVALID_MOVE2;
      const idx = (owner.coalition || []).findIndex((c) => String(c.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE2;
      const target = owner.coalition[idx];
      if (!target || target.type !== "persona") return INVALID_MOVE2;
      if (target.shielded) return INVALID_MOVE2;
      applyTokenDelta2(G, target, 2);
      target.blockedAbilities = true;
      recalcPassives(G);
      const self37 = (me.coalition || []).find((c) => baseId2(String(c.id)) === "persona_37");
      const selfName = String(self37?.name || self37?.text || "persona_37");
      G.log.push(`${ruYou2(me.name)} ${selfName} \u043F\u043E\u0434\u043A\u0443\u043F\u0438\u043B ${target.name || target.id} (+2) \u0438 \u043D\u0430\u0432\u0441\u0435\u0433\u0434\u0430 \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043B \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u0438.`);
      G.pending = null;
    },
    persona33ChooseFaction: ({ G, playerID }, factionTag) => {
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_33_choose_faction") return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      const self = (me.coalition || []).find((c) => baseId2(String(c.id)) === "persona_33");
      if (!self) return INVALID_MOVE2;
      const tag = String(factionTag || "");
      if (!tag.startsWith("faction:")) return INVALID_MOVE2;
      const KNOWN = /* @__PURE__ */ new Set(["faction:liberal", "faction:rightwing", "faction:leftwing", "faction:fbk", "faction:red_nationalist", "faction:system", "faction:neutral"]);
      if (!KNOWN.has(tag)) return INVALID_MOVE2;
      self.chosenFactionTag = tag;
      recalcPassives(G);
      const pname = String(self?.name || self?.text || "persona_33");
      G.log.push(`${ruYou2(me.name)} ${pname} \u0432\u044B\u0431\u0440\u0430\u043B\u0430 \u0444\u0440\u0430\u043A\u0446\u0438\u044E ${factionTitle(tag)}.`);
      G.pending = null;
    },
    persona34GuessTopdeck: ({ G, ctx, playerID, events }, guessBaseId) => {
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_34_guess_topdeck") return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      const guess = String(guessBaseId || "");
      if (!guess || guess === "skip") {
        G.pending = null;
        G.log.push(`${actorWithPersona(me, "persona_34")} \u043F\u0440\u043E\u043F\u0443\u0441\u0442\u0438\u043B \u0433\u0430\u0434\u0430\u043D\u0438\u0435.`);
        return;
      }
      const deck = Array.isArray(G.deck) ? G.deck : [];
      let found = null;
      let skipped = 0;
      for (const c of deck) {
        if (!c) continue;
        if (c.type === "persona") {
          found = c;
          break;
        }
        skipped++;
      }
      if (!found) {
        const guessName2 = personaTitleByBaseId(guess);
        G.log.push(`${actorWithPersona(me, "persona_34")} \u0437\u0430\u0433\u0430\u0434\u0430\u043B ${guessName2}, \u043D\u043E \u0432 \u043A\u043E\u043B\u043E\u0434\u0435 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435\u0442 \u043F\u0435\u0440\u0441\u043E\u043D.`);
        G.pending = null;
        return;
      }
      const actual = baseId2(String(found.id));
      const guessName = personaTitleByBaseId(guess);
      const actualName = personaTitleByBaseId(actual);
      G.log.push(`${actorWithPersona(me, "persona_34")} \u0437\u0430\u0433\u0430\u0434\u0430\u043B ${guessName}. \u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0430\u044F \u043F\u0435\u0440\u0441\u043E\u043D\u0430 \u0432 \u043A\u043E\u043B\u043E\u0434\u0435 (${skipped} \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E): ${actualName}.`);
      if (guess === actual) {
        G.gameOver = true;
        G.winnerId = String(playerID);
        G.log.push(`${actorWithPersona(me, "persona_34")}: \u0443\u0433\u0430\u0434\u0430\u043B \u2014 \u043C\u0433\u043D\u043E\u0432\u0435\u043D\u043D\u0430\u044F \u043F\u043E\u0431\u0435\u0434\u0430 \u0434\u043B\u044F ${ruYou2(me.name)}.`);
        events.endGame?.();
      }
      G.pending = null;
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
    persona45StealFromOpponent: ({ G, playerID }, targetId) => {
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_45_steal_from_opponent") return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      const target = (G.players || []).find((pp) => String(pp.id) === String(targetId));
      if (!target || String(target.id) === String(playerID)) return INVALID_MOVE2;
      const hand = target.hand || [];
      if (!hand.length) {
        G.log.push(`${ruYou2(me.name)} сбросил ${toDiscard.length} карт(ы) после добора 3.`);
        G.pending = null;
        return;
      }
      const idx = Math.floor(Math.random() * hand.length);
      const [stolen] = hand.splice(idx, 1);
      if (stolen) {
        me.hand.push(stolen);
        G.log.push(`\u0412\u044B \u0441 \u0428\u0443\u043B\u044C\u043C\u0430\u043D \u0437\u0430\u0431\u0440\u0430\u043B\u0438 1 \u043A\u0430\u0440\u0442\u0443 \u0443 ${target.name}.`);
      }
      G.pending = null;
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
    persona16Discard3FromHand: ({ G, playerID }, cardIdA, cardIdB, cardIdC) => {
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_16_discard3_from_hand") return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      const ids = [cardIdA, cardIdB, cardIdC].map(String);
      const unique = Array.from(new Set(ids)).filter((x) => x && x !== "undefined" && x !== "null");
      const toDiscard = unique.slice(0, Math.min(3, (me.hand || []).length));
      for (const id of toDiscard) {
        const i = (me.hand || []).findIndex((c) => String(c.id) === String(id));
        if (i >= 0) {
          const [drop] = me.hand.splice(i, 1);
          if (drop) {
            G.discard.push(drop);
            if (drop.type === "persona") persona44OnPersonaDiscarded(G);
          }
        }
      }
      G.pending = null;
      try {
        expireResponseAndResolveDeferred(G);
      } catch {
      }
      recalcPassives(G);
      G.log.push(`${ruYou2(me.name)} сбросил ${toDiscard.length} карт(ы) после добора 3.`);
    },
    // Persona 20: picker from discard (any card type)
    persona20PickFromDiscard: ({ G, playerID }, cardId) => {
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_20_pick_from_discard") return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      const idx = (G.discard || []).findIndex((c2) => String(c2.id) === String(cardId));
      if (idx < 0) return INVALID_MOVE2;
      const c = G.discard[idx];
      if (!c) return INVALID_MOVE2;
      if (c.type === "event") return INVALID_MOVE2;
      G.discard.splice(idx, 1);
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE2;
      me.hand.push(c);
      const title = c.type === "action" ? actionTitle(c) : c.name || c.id;
      G.log.push(`${ruYou2(me.name)} \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u044F \u0411\u044B\u043A\u043E\u0432\u0430 \u0432\u0437\u044F\u043B \xAB${title}\xBB \u0438\u0437 \u0441\u0431\u0440\u043E\u0441\u0430.`);
      G.pending = null;
    },
    // Tick for human turns only clears expired responses / deferred abilities.
    // Do NOT auto-end here: that races with a manual End Turn click and produces invalid stateID errors.
    tick: ({ G, ctx }) => {
      try {
        if (String(ctx.phase || "") !== "action") return INVALID_MOVE2;
        expireResponseAndResolveDeferred(G);
      } catch {
      }
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
        const pend0 = G.pending;
        if (pend0 && pend0.kind === "persona_11_offer" && String(pend0.playerId) === String(p.id)) {
          G.pending = null;
          G.botNextActAtMs = nowMs() + 250;
          return;
        }
        if (pend0 && pend0.kind === "persona_17_pick_opponent" && String(pend0.playerId) === String(p.id)) {
          let best = null;
          let bestCount = -1;
          for (const opp of G.players || []) {
            if (String(opp.id) === String(p.id)) continue;
            const cnt = (opp.hand || []).filter((c) => c && c.type === "persona").length;
            if (cnt > bestCount) {
              bestCount = cnt;
              best = opp;
            }
          }
          if (!best || bestCount <= 0) {
            G.pending = null;
            G.botNextActAtMs = nowMs() + 250;
            return;
          }
          G.pending = { kind: "persona_17_pick_persona_from_hand", playerId: String(p.id), sourceCardId: String(pend0.sourceCardId || "persona_17"), targetId: String(best.id) };
          G.botNextActAtMs = nowMs() + 250;
          return;
        }
        if (pend0 && pend0.kind === "persona_17_pick_persona_from_hand" && String(pend0.playerId) === String(p.id)) {
          const target = (G.players || []).find((pp) => String(pp.id) === String(pend0.targetId));
          const idx = (target?.hand || []).findIndex((c2) => c2 && c2.type === "persona");
          if (!target || idx < 0) {
            G.pending = null;
            G.botNextActAtMs = nowMs() + 250;
            return;
          }
          const c = target.hand[idx];
          target.hand.splice(idx, 1);
          p.hand.push(c);
          G.log.push(`${ruYou2(p.name)} (\u0410\u0440\u043D\u043E) \u0437\u0430\u0431\u0440\u0430\u043B ${c.name || c.id} \u0438\u0437 \u0440\u0443\u043A\u0438 ${target.name}.`);
          G.pending = null;
          recalcPassives(G);
          G.botNextActAtMs = nowMs() + 600;
          return;
        }
        if (pend0 && pend0.kind === "persona_16_discard3_from_hand" && String(pend0.playerId) === String(p.id)) {
          const hand = Array.isArray(p.hand) ? p.hand : [];
          const toDiscard = Math.min(3, hand.length);
          for (let i = 0; i < toDiscard; i++) {
            const card = hand.shift();
            if (card) G.discard.push(card);
          }
          G.pending = null;
          recalcPassives(G);
          G.log.push(`${ruYou2(p.name)} (Кац) сбрасывает ${toDiscard} карт.`);
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
          if (pend.kind === "persona_5_pick_liberal" && String(pend.playerId) === String(p.id)) {
            try {
              const self = (p.coalition || []).find((c) => String(c.id) === String(pend.sourceCardId));
              const owners = (G.players || []).filter((pp) => String(pp.id) !== String(p.id));
              let picked = false;
              for (const owner of owners) {
                const j = (owner.coalition || []).findIndex((c) => c.type === "persona" && baseId2(String(c.id)) !== "persona_31" && !c.shielded && Array.isArray(c.tags) && c.tags.includes("faction:liberal"));
                if (j < 0) continue;
                const [drop] = owner.coalition.splice(j, 1);
                if (drop) {
                  G.discard.push(drop);
                  const tok = Number(drop.vpDelta || 0);
                  if (tok && self) applyTokenDelta2(G, self, tok);
                  G.log.push(`${ruYou2(p.name)} (${pend.sourceCardId}): \u0441\u0431\u0440\u043E\u0441\u0438\u043B ${drop?.name || drop?.id} \u0438 \u0443\u043A\u0440\u0430\u043B ${tok} \u0436\u0435\u0442\u043E\u043D(\u043E\u0432).`);
                }
                picked = true;
                break;
              }
              if (!picked) G.log.push(`${ruYou2(p.name)} (${pend.sourceCardId}): \u043D\u0435\u0442 \u043B\u0438\u0431\u0435\u0440\u0430\u043B\u0430 \u0434\u043B\u044F \u0441\u0431\u0440\u043E\u0441\u0430.`);
            } catch {
            }
            G.pending = null;
            recalcPassives(G);
            try {
              if (!G.response && !G.pending && G.hasDrawn && G.hasPlayed) {
                if (maybeEndAfterRound(G, ctx, events)) return;
                events.endTurn?.();
                return;
              }
            } catch {
            }
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
          if (pend.kind === "persona_7_swap_two_in_coalition" && String(pend.playerId) === String(p.id)) {
            const myCoal = (p.coalition || []).filter((c) => c.type === "persona");
            if (myCoal.length >= 2) {
              const owner = p;
              const idxA = (owner.coalition || []).findIndex((c) => c.type === "persona");
              const idxB = (owner.coalition || []).findIndex((c, j) => c.type === "persona" && j !== idxA);
              if (idxA >= 0 && idxB >= 0) {
                const ca = owner.coalition[idxA];
                const cb = owner.coalition[idxB];
                owner.coalition[idxA] = cb;
                owner.coalition[idxB] = ca;
                G.log.push(`${ruYou2(p.name)} (${pend.sourceCardId}) \u043F\u043E\u043C\u0435\u043D\u044F\u043B \u043C\u0435\u0441\u0442\u0430\u043C\u0438 \u0434\u0432\u0443\u0445 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0435\u0439 \u0432 \u0441\u0432\u043E\u0435\u0439 \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u0438.`);
              }
            } else {
              G.log.push(`${ruYou2(p.name)} (${pend.sourceCardId}): \u043D\u0435\u043A\u043E\u0433\u043E \u043C\u0435\u043D\u044F\u0442\u044C \u043C\u0435\u0441\u0442\u0430\u043C\u0438 (\u0430\u0432\u0442\u043E\u0441\u043A\u0438\u043F).`);
            }
            G.pending = null;
            recalcPassives(G);
            try {
              if (!G.response && !G.pending && G.hasDrawn && G.hasPlayed) {
                if (maybeEndAfterRound(G, ctx, events)) return;
                events.endTurn?.();
                return;
              }
            } catch {
            }
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
          if (pend.kind === "persona_45_steal_from_opponent" && String(pend.playerId) === String(p.id)) {
            const opps = (G.players || []).filter((pp) => String(pp.id) !== String(p.id));
            const scored = opps.map((pp) => ({
              p: pp,
              vp: scorePlayer(pp),
              coal: (pp.coalition || []).filter((c) => c.type === "persona").length,
              hand: (pp.hand || []).length
            })).sort((a, b) => b.vp - a.vp || b.coal - a.coal || b.hand - a.hand);
            const last = String(p.botLastOffTargetId || "");
            let target = scored.find((x) => String(x.p?.id) !== last)?.p || scored[0]?.p;
            if (target) p.botLastOffTargetId = String(target.id);
            if (target && (target.hand || []).length) {
              const idx = Math.floor(Math.random() * target.hand.length);
              const [stolen] = target.hand.splice(idx, 1);
              if (stolen) {
                p.hand.push(stolen);
                G.log.push(`${p.name} \u0437\u0430\u0431\u0440\u0430\u043B 1 \u043A\u0430\u0440\u0442\u0443 \u0443 ${target.name}.`);
              }
            } else {
              G.log.push(`${ruYou2(p.name)} (${pend.sourceCardId}) \u0445\u043E\u0442\u0435\u043B \u0443\u043A\u0440\u0430\u0441\u0442\u044C \u043A\u0430\u0440\u0442\u0443, \u043D\u043E \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0435\u0439 \u0440\u0443\u043A\u0438 \u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A\u0430 \u043D\u0435 \u043D\u0430\u0448\u043B\u043E\u0441\u044C.`);
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
            const haveHumanAction8Responders = (G.players || []).some((pp) => {
              if (!pp?.active) return false;
              if (String(pp.id) === String(p.id)) return false;
              const isBot2 = !!pp?.isBot || String(pp?.name || "").startsWith("[B]");
              if (isBot2) return false;
              try {
                return (pp.hand || []).some((hc) => hc?.type === "action" && baseId2(String(hc.id)) === "action_8");
              } catch {
                return false;
              }
            });
            if (haveHumanAction8Responders) {
              G.response = {
                kind: "cancel_persona",
                playedBy: String(p.id),
                personaCard: c,
                expiresAtMs: nowMs() + RESPONSE_PERSONA_MS
              };
              G.botPauseUntilMs = nowMs() + RESPONSE_PERSONA_MS;
            } else {
              G.response = null;
              G.botPauseUntilMs = 0;
            }
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
    endTurn: ({ G, ctx, playerID, events }) => {
      expireResponseAndResolveDeferred(G);
      if (G.pending && G.pending?.kind === "resolve_persona_after_response") return INVALID_MOVE2;
      if (playerID !== ctx.currentPlayer) {
        G.debugLastEndTurnReject = "not_current_player";
        return INVALID_MOVE2;
      }
      if (G.pending) {
        const pk = G.pending;
        if (pk?.kind === "event_12b_discard_from_hand") {
          const targets = Array.isArray(pk.targetIds) ? pk.targetIds.map(String) : [];
          if (!targets.includes(String(playerID))) {
          } else {
            G.debugLastEndTurnReject = `pending:${String(pk?.kind || "")}`;
            return INVALID_MOVE2;
          }
        } else if (pk?.kind === "persona_13_pick_target") {
          if (String(pk.playerId) !== String(playerID)) {
          } else {
            G.debugLastEndTurnReject = `pending:${String(pk?.kind || "")}`;
            return INVALID_MOVE2;
          }
        } else {
          G.debugLastEndTurnReject = `pending:${String(pk?.kind || "")}`;
          return INVALID_MOVE2;
        }
      }
      if (!G.hasDrawn || !G.hasPlayed) {
        G.debugLastEndTurnReject = `need_draw_play (drawn=${String(!!G.hasDrawn)} played=${String(!!G.hasPlayed)})`;
        return INVALID_MOVE2;
      }
      G.debugLastEndTurnReject = null;
      try {
        const p = (G.players || []).find((pp) => String(pp.id) === String(playerID));
        if (p && String(p.name || "").startsWith("[B]") && !G.hasPlayed) {
          const c = (p.hand || [])[0];
          if (c) {
            p.hand.splice(0, 1);
            p.coalition.push(c);
            G.hasPlayed = true;
            G.log.push(`${p.name} played ${c.name || c.id}.`);
          }
        }
      } catch {
      }
      try {
        const p = (G.players || []).find((pp) => String(pp.id) === String(playerID));
        const nHand = Number((p?.hand || []).length);
        const isBot = !!p?.isBot || String(p?.name || "").startsWith("[B]");
        if (nHand > 7) {
          if (isBot) {
            while (Number((p.hand || []).length) > 7) {
              const drop = p.hand.pop();
              if (drop) G.discard.push(drop);
            }
          } else {
            G.pending = { kind: "discard_down_to_7", playerId: String(playerID), sourceCardId: "hand_limit" };
            G.debugLastEndTurnReject = "hand_limit";
            return INVALID_MOVE2;
          }
        }
      } catch {
      }
      if (maybeEndAfterRound(G, ctx, events)) return;
      events.endTurn();
    },
    beginTurnDraw: ({ G, playerID, ctx }) => {
      expireResponseAndResolveDeferred(G);
      if (String(playerID) !== String(ctx.currentPlayer)) return INVALID_MOVE2;
      if (G.pending) return INVALID_MOVE2;
      if (G.response && !responseExpired(G)) return INVALID_MOVE2;
      if (G.hasDrawn) return INVALID_MOVE2;
      const p = G.players.find((pp) => String(pp.id) === String(playerID));
      if (!p) return INVALID_MOVE2;
      const c = drawTopCardForPlayer2(G, p);
      if (!c) return INVALID_MOVE2;
      G.hasDrawn = true;
      G.drawsThisTurn = Math.max(1, Number(G.drawsThisTurn || 0) + 1);
      return;
    },
    drawCard: ({ G, playerID, ctx, events }) => {
      expireResponseAndResolveDeferred(G);
      if (G.pending && G.pending?.kind === "resolve_persona_after_response") return INVALID_MOVE2;
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE2;
      if (G.pending) return INVALID_MOVE2;
      if (G.response && !responseExpired(G)) return INVALID_MOVE2;
      const draws = Number(G.drawsThisTurn || 0);
      if (!G.hasDrawn) return INVALID_MOVE2;
      if (draws >= 2) return INVALID_MOVE2;
      if (G.hasPlayed) return INVALID_MOVE2;
      const p = G.players.find((pp) => String(pp.id) === String(playerID));
      if (!p) return INVALID_MOVE2;
      const c = drawTopCardForPlayer2(G, p);
      if (!c) return INVALID_MOVE2;
      G.drawsThisTurn = draws + 1;
      G.hasDrawn = true;
      G.hasPlayed = true;
      if (maybeEndAfterRound(G, ctx, events)) return;
      events.endTurn?.();
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
      let persona8Swap = null;
      try {
        const ownerId = String(owner?.id);
        for (const pp of G.players || []) {
          if (String(pp.id) === String(playerID)) continue;
          if (String(pp.id) === ownerId) continue;
          const hasReadyP8 = (pp.coalition || []).some((x) => baseId2(String(x.id)) === "persona_8" && !x._p8Used);
          if (hasReadyP8) {
            persona8Swap = { playerId: String(pp.id), ownerId, playedPersonaId: String(c.id) };
            break;
          }
        }
      } catch {
      }
      const humanAction8Responders = (G.players || []).some((pp) => {
        if (!pp?.active) return false;
        if (String(pp.id) === String(playerID)) return false;
        const isBot2 = !!pp?.isBot || String(pp?.name || "").startsWith("[B]");
        if (isBot2) return false;
        try {
          return (pp.hand || []).some((hc) => hc?.type === "action" && baseId2(String(hc.id)) === "action_8");
        } catch {
          return false;
        }
      });
      const botAction8Responder = (G.players || []).find((pp) => {
        if (!pp?.active) return false;
        if (String(pp.id) === String(playerID)) return false;
        const isBot2 = !!pp?.isBot || String(pp?.name || "").startsWith("[B]");
        if (!isBot2) return false;
        try {
          return (pp.hand || []).some((hc) => hc?.type === "action" && baseId2(String(hc.id)) === "action_8");
        } catch {
          return false;
        }
      });
      const persona8SwapByHuman = !!persona8Swap && (() => {
        const owner = (G.players || []).find((pp) => String(pp.id) === String(persona8Swap.ownerId));
        if (!owner?.active) return false;
        const isBot2 = !!owner?.isBot || String(owner?.name || "").startsWith("[B]");
        return !isBot2;
      })();
      const needResponseWindow = humanAction8Responders || persona8SwapByHuman;
      if (needResponseWindow) {
        G.response = {
          kind: "cancel_persona",
          playedBy: String(playerID),
          personaCard: c,
          expiresAtMs: nowMs() + RESPONSE_PERSONA_MS,
          persona8Swap
        };
        G.botPauseUntilMs = nowMs() + RESPONSE_PERSONA_MS;
        G.pending = {
          kind: "resolve_persona_after_response",
          playerId: String(playerID),
          sourceCardId: String(c.id),
          personaId: String(c.id),
          abilityKey: c.abilityKey
        };
      } else if (botAction8Responder && baseId2(String(c.id)) !== "persona_33") {
        G.response = null;
        try {
          const bot = botAction8Responder;
          const botIdx = (bot.hand || []).findIndex((hc) => hc?.type === "action" && baseId2(String(hc.id)) === "action_8");
          if (botIdx >= 0) {
            const [botCard] = bot.hand.splice(botIdx, 1);
            if (botCard) {
              G.discard.push(botCard);
              G.lastAction = botCard;
            }
          }
          const ownerCoal = owner.coalition || [];
          const dropIdx = ownerCoal.findIndex((cc) => String(cc.id) === String(c.id));
          if (dropIdx >= 0) {
            const [drop] = ownerCoal.splice(dropIdx, 1);
            if (drop) {
              G.discard.push(drop);
              if (drop.type === "persona") persona44OnPersonaDiscarded(G);
            }
          }
          for (const pp of G.players || []) {
            for (const cc of pp.coalition || []) {
              const b = baseId2(String(cc.id));
              if (b === "persona_6") applyTokenDelta2(G, cc, 1);
              if (b === "persona_29") applyTokenDelta2(G, cc, -1);
            }
          }
          recalcPassives(G);
          G.pending = null;
          G.log.push(`${bot.name} обвинил ${c.name || c.id} в работе на кремль!`);
        } catch {
        }
      } else {
        G.response = null;
        try {
          runAbility(String(c.abilityKey || ""), { G, me: owner, card: c });
          applyAdjacencyBonusesAround(G, owner, c);
        } catch {
        }
      }
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
      const responseBase = responseCard ? baseId2(responseCard.id) : null;
      if (responseBase === "action_8" && G.response?.kind === "cancel_persona" && String(G.response.playedBy) !== String(playerID)) {
        const exp = Number(G.response.expiresAtMs || 0);
        const graceMs = 2e3;
        if (exp && nowMs() > exp + graceMs) return INVALID_MOVE2;
        if (baseId2(String(G.response.personaCard?.id || "")) === "persona_33") return INVALID_MOVE2;
        try {
          const pendDef = G.pending;
          if (pendDef?.kind === "resolve_persona_after_response" && String(pendDef.personaId) === String(G.response.personaCard?.id)) {
            G.pending = null;
          }
        } catch {
        }
        me.hand.splice(idxResponse, 1);
        G.discard.push(responseCard);
        G.lastAction = responseCard;
        try {
          for (const pp of G.players || []) {
            const j = (pp.coalition || []).findIndex((cc) => cc.id === G.response.personaCard.id);
            if (j >= 0) {
              const [undo] = pp.coalition.splice(j, 1);
              if (undo) {
                G.discard.push(undo);
                if (undo.type === "persona") persona44OnPersonaDiscarded(G);
              }
              break;
            }
          }
        } catch {
        }
        try {
          for (const pp of G.players || []) {
            for (const cc of pp.coalition || []) {
              const b = baseId2(String(cc.id));
              if (b === "persona_6") applyTokenDelta2(G, cc, 1);
              if (b === "persona_29") applyTokenDelta2(G, cc, -1);
            }
          }
          recalcPassives(G);
        } catch {
        }
        const targetName = String(G.response.personaCard?.name || G.response.personaCard?.text || G.response.personaCard?.id || "персонажа");
        G.log.push(`${me.name} обвинил ${targetName} в работе на кремль!`);
        G.response = null;
        return;
      }
      if (String(playerID) !== String(ctx.currentPlayer)) {
        const idx2 = (me.hand || []).findIndex((c3) => c3.id === cardId);
        if (idx2 === -1) return INVALID_MOVE2;
        const c2 = me.hand[idx2];
        if (c2.type !== "action") return INVALID_MOVE2;
        const base2 = baseId2(c2.id);
        if (base2 === "action_6" && G.response?.kind === "cancel_action" && String(G.response.playedBy) !== String(playerID) && !responseExpired(G)) {
          me.hand.splice(idx2, 1);
          G.discard.push(c2);
          G.lastAction = c2;
          G.discard.push(G.response.actionCard);
          G.pending = null;
          G.log.push(`${ruYou2(me.name)} \u041E\u0422\u041C\u0415\u041D\u0418\u041B \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 ${G.response.actionCard.id} (\u0432 \u0441\u0431\u0440\u043E\u0441).`);
          G.response = null;
          return;
        }
        if (base2 === "action_8" && G.response?.kind === "cancel_persona" && String(G.response.playedBy) !== String(playerID)) {
          const exp = Number(G.response.expiresAtMs || 0);
          const graceMs = 2e3;
          if (exp && nowMs() > exp + graceMs) return INVALID_MOVE2;
          if (baseId2(String(G.response.personaCard?.id || "")) === "persona_33") return INVALID_MOVE2;
          try {
            const pendDef = G.pending;
            if (pendDef?.kind === "resolve_persona_after_response" && String(pendDef.personaId) === String(G.response.personaCard?.id)) {
              G.pending = null;
            }
          } catch {
          }
          me.hand.splice(idx2, 1);
          G.discard.push(c2);
          G.lastAction = c2;
          try {
            for (const pp of G.players || []) {
              const j = (pp.coalition || []).findIndex((cc) => cc.id === G.response.personaCard.id);
              if (j >= 0) {
                const [undo] = pp.coalition.splice(j, 1);
                if (undo) {
                  G.discard.push(undo);
                  if (undo.type === "persona") persona44OnPersonaDiscarded(G);
                }
                break;
              }
            }
          } catch {
          }
          try {
            for (const pp of G.players || []) {
              for (const cc of pp.coalition || []) {
                const b = baseId2(String(cc.id));
                if (b === "persona_6") applyTokenDelta2(G, cc, 1);
                if (b === "persona_29") applyTokenDelta2(G, cc, -1);
              }
            }
            recalcPassives(G);
          } catch {
          }
          const targetName = String(G.response.personaCard?.name || G.response.personaCard?.text || G.response.personaCard?.id || "\u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430");
          G.log.push(`${me.name} \u043E\u0431\u0432\u0438\u043D\u0438\u043B ${targetName} \u0432 \u0440\u0430\u0431\u043E\u0442\u0435 \u043D\u0430 \u043A\u0440\u0435\u043C\u043B\u044C!`);
          G.response = null;
          return;
        }
        if (base2 === "action_14" && G.response?.kind === "cancel_action" && !responseExpired(G) && (G.pending?.kind === "action_4_discard" || G.pending?.kind === "action_9_discard_persona") && String(G.pending?.targetId) === String(playerID)) {
          me.hand.splice(idx2, 1);
          G.discard.push(c2);
          G.lastAction = c2;
          if (G.response.actionCard) {
            G.discard.push(G.response.actionCard);
          }
          G.pending = null;
          const offender = actionTitleByBaseId(baseId2(String(G.response.actionCard?.id || ""))) || actionTitle(G.response.actionCard) || String(G.response.actionCard?.id || "");
          const canceller = actionTitleByBaseId(baseId2(String(c2?.id || ""))) || actionTitle(c2) || "ACTION 14";
          G.log.push(`${ruYou2(me.name)} \u043E\u0442\u043C\u0435\u043D\u0438\u043B \u044D\u0444\u0444\u0435\u043A\u0442 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F "${offender}" \u043D\u0430 \u0441\u0432\u043E\u0435\u0439 \u043A\u043E\u0430\u043B\u0438\u0446\u0438\u0438 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u044F "${canceller}".`);
          G.response = null;
          return;
        }
        return INVALID_MOVE2;
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
        const allowPersona10By = (target.coalition || []).some((x) => baseId2(String(x.id)) === "persona_10") ? tid : null;
        G.response = {
          kind: "cancel_action",
          playedBy: String(playerID),
          actionCard: c,
          expiresAtMs: nowMs() + RESPONSE_ACTION_MS,
          allowPersona10By
        };
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
        const allowPersona10By = (target.coalition || []).some((x) => baseId2(String(x.id)) === "persona_10") ? tid : null;
        G.response = {
          kind: "cancel_action",
          playedBy: String(playerID),
          actionCard: c,
          expiresAtMs: nowMs() + RESPONSE_ACTION_MS,
          allowPersona10By
        };
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
        G.response = {
          kind: "cancel_action",
          playedBy: String(playerID),
          actionCard: c,
          expiresAtMs: nowMs() + RESPONSE_ACTION_MS
        };
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
    persona13PickTarget: ({ G, ctx, playerID }, ownerId, coalitionCardId) => {
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_13_pick_target") return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      const attacker = (G.players || []).find((pp) => String(pp.id) === String(pend.attackerId));
      if (!attacker) return INVALID_MOVE2;
      if (String(ownerId) !== String(attacker.id)) return INVALID_MOVE2;
      const idx = (attacker.coalition || []).findIndex((c) => String(c.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE2;
      const target = attacker.coalition[idx];
      if (!target || target.type !== "persona") return INVALID_MOVE2;
      if (target.shielded) return INVALID_MOVE2;
      applyTokenDelta2(G, target, -1);
      recalcPassives(G);
      const me = (G.players || []).find((pp) => String(pp.id) === String(playerID));
      G.log.push(`${ruYou2(me?.name || playerID)} (\u0412\u0435\u043D\u0435\u0434\u0438\u0442\u043A\u043E\u0432): \u0434\u0430\u043B -1 \u043D\u0430 ${target.name || target.id}.`);
      G.pending = null;
    },
    persona13Skip: ({ G, playerID }) => {
      const pend = G.pending;
      if (!pend || pend.kind !== "persona_13_pick_target") return INVALID_MOVE2;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE2;
      G.pending = null;
      return;
    }
  })
};

globalThis.PolitikumBridge = {
  createMatchJson(numPlayers){ return JSON.stringify(createMatchState(numPlayers)); },
  applyMoveJson(stateJson, playerID, moveName, argsJson){
    const state = JSON.parse(stateJson);
    const args = argsJson ? JSON.parse(argsJson) : [];
    return JSON.stringify(applyMove(state, playerID, moveName, args));
  }
};
