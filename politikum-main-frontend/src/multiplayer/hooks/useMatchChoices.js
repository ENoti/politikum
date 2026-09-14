import { useMemo } from 'react';

/**
 * Read-only adapter for server-projected match choices.
 * The browser never derives authoritative eligibility here; it only maps
 * Java's viewer-specific projection to convenient UI predicates.
 */
export function useMatchChoices(game = {}) {
  return useMemo(() => {
    const choices = game?.choices || {};
    const hand = choices.hand || {};
    const actions = choices.actions || {};
    const players = choices.players || {};
    const cards = choices.cards || {};
    const targets = choices.targets || {};
    return {
      raw: choices,
      reactions: choices.reactions || {},
      handChoice: (card) => hand[String(card?.id)] || {},
      canTarget: (move, ownerId, card) => (targets[move] || []).some((target) =>
        String(target.ownerId) === String(ownerId) && String(target.cardId) === String(card?.id)),
      canPickPlayer: (move, playerId) => (players[move] || []).some((id) => String(id) === String(playerId)),
      canPlayToPlayer: (selection, playerId) => (hand[String(selection?.cardId)]?.targetPlayerIds || [])
        .some((id) => String(id) === String(playerId)),
      choiceCards: (move, list) => (list || []).filter((card) => (cards[move] || [])
        .some((id) => String(id) === String(card?.id))),
    };
  }, [game?.choices]);
}
