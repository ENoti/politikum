package com.politikum.engine;

/** Transitional effect dispatch and display helpers; selection rules live in Java. */
public interface AbilityEffects {
    void run(RuleNode g, RuleNode me, RuleNode card);
    void expire(RuleNode g);
    boolean endRound(RuleNode g, RuleNode ctx);
    double random();
    String eventTitle(RuleNode card);
    String actor(RuleNode me, String persona);
}
