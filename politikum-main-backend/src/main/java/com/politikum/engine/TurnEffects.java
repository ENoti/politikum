package com.politikum.engine;

/** Card effects still awaiting migration. The lifecycle decides when to invoke them. */
public interface TurnEffects {
    void drawnEvent(RuleNode game, RuleNode player, RuleNode card);
    void deferredPersona(RuleNode game, RuleNode pending);
    void queuedEvent(RuleNode game, RuleNode queue, RuleNode card);
    void recalculate(RuleNode game);
    void personaDiscarded(RuleNode game);
}
