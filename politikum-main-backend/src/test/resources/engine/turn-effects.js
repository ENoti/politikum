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

// Event effects now execute in Java; deferred persona dispatch remains transitional.
function turnDrawnEvent(G, p, card) {
  nativeAbility('turnDrawnEvent', G, p, card);
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
  nativeAbility('turnQueuedEvent', G, queue, card);
}
