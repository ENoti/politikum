// The server selects eligible cards; the client only chooses a shortcut priority.
export function playFirstResponse(reactions = {}, moves) {
  const cardId = reactions.cancelActionCardId || reactions.cancelPersonaCardId || reactions.cancelEffectCardId;
  if (cardId) return moves.playAction(cardId);
  if (reactions.persona10Cancel) return moves.persona10CancelFromCoalition();
}
