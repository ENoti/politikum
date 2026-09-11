// Compatibility transport. All lifecycle decisions live in JavaTurnRules.
function nativeTurn(operation, G, ctx, playerID = '', args = [], events = null) {
  return __politikumNativeTurn(operation, { G, ctx: ctx || {}, __eventQueue: events?._queue || [] }, playerID, args);
}
function flushEvents(state) { __politikumNativeTurn('flush', state, '', []); }
function drawTopCardForPlayer2(G, player) { return nativeTurn('drawTop', G, null, String(player?.id || '')); }
function responseExpired(G) { return nativeTurn('responseExpired', G); }
function expireResponseAndResolveDeferred(G) { nativeTurn('expire', G); }
function maybeResolveDeferredPersona(G) { return nativeTurn('resolveDeferred', G); }
function endGameNow(G, ctx) { nativeTurn('finish', G, ctx); }
function maybeTriggerRoundEnd(G, ctx) { nativeTurn('triggerRoundEnd', G, ctx); }
function maybeEndAfterRound(G, ctx) { return nativeTurn('maybeEndAfterRound', G, ctx); }

var NATIVE_TURN_MOVES = Object.fromEntries([
  'beginTurnDraw', 'drawCard', 'endTurn', 'tick', 'skipResponseWindow', 'forceSkipTurn', 'discardFromHandDownTo7'
].map(name => [name, ({ G, ctx, playerID, events }, ...args) =>
  nativeTurn(name, G, ctx, String(playerID), args, events) ? undefined : INVALID_MOVE2
]));

// Card-specific effects remain here until the ability migration.
function turnDrawnEvent(G, p, card) {
  const evName = eventTitle2(card), bid = baseId2(String(card.id));
  if (!['event_1', 'event_2', 'event_3', 'event_10', 'event_15'].includes(bid)) {
    if (bid === 'event_12b') G.log.push(`${ruYou2(p.name)} ${ruDrewVerb(p.name)} Срач в Твиттере: Секс скандал!`);
    else if (bid === 'event_12c') G.log.push(`${ruYou2(p.name)} ${ruDrewVerb(p.name)} "${evName}"`);
    else G.log.push(`${ruYou2(p.name)} ${ruDrewVerb(p.name)} ${evName}`);
  }
  if (Array.isArray(card.tags) && card.tags.includes('event_type:twitter_squabble')) {
    for (const owner of G.players || []) for (const c of owner.coalition || []) {
      if (baseId2(String(c.id)) === 'persona_4') applyTokenDelta2(G, c, -2);
    }
  }
  runAbility(card.abilityKey, { G, me: p, card });
  persona38OnEventPlayed(G, card);
}
function turnDeferredPersona(G, pending) {
  const id = String(pending.personaId || '');
  const owner = (G.players || []).find(p => (p.coalition || []).some(c => String(c.id) === id));
  const card = owner?.coalition?.find(c => String(c.id) === id);
  if (owner && card) {
    const key = String(pending.abilityKey || card.abilityKey || '');
    if (key) runAbility(key, { G, me: owner, card });
    applyAdjacencyBonusesAround(G, owner, card);
  }
}
function turnQueuedEvent(G, queue, card) {
  const me = (G.players || []).find(p => String(p.id) === String(queue.playerId));
  G.log.push(`${ruYou2(me?.name)} вытянул Событие "${eventTitle2(card)}" из способности ${queue.sourceCardId}.`);
  runAbility(String(card.abilityKey || ''), { G, me, card });
}
