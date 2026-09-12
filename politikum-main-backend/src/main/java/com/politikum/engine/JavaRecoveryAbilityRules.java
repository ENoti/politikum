package com.politikum.engine;

import java.util.function.Function;
import static com.politikum.engine.GameState.object;

/** Persona 20 discard retrieval and persona 32 coalition-to-hand recovery. */
public final class JavaRecoveryAbilityRules {
    private final JavaAbilityRules.Scoring scoring;
    private final Function<RuleNode, String> actionTitle;
    public JavaRecoveryAbilityRules(JavaAbilityRules.Scoring scoring, Function<RuleNode, String> actionTitle) {
        this.scoring = scoring;
        this.actionTitle = actionTitle;
    }

    public void enterDiscard(RuleNode g, RuleNode me, RuleNode source) {
        RuleNode discard = g.get("discard");
        int count = 0;
        RuleNode only = discard.at(-1);
        for (int i = 0; i < discard.size(); i++) {
            if (!discard.at(i).get("type").text().equals("action")) continue;
            count++;
            only = discard.at(i);
        }
        if (count == 0) {
            log(g, "В стопке сброса ничего не нашлось!");
        } else if (count == 1) {
            // Compatibility: legacy removes from a filtered array, leaving G.discard intact.
            me.get("hand").add(only);
            String title = only.get("text").truthy() ? only.get("text").text() : name(only);
            log(g, who(me) + " используя Быкова взял " + title + " из сброса.");
        } else {
            g.set("pending", object("kind", "persona_20_pick_from_discard", "playerId", me.get("id").text(), "sourceCardId", source.get("id").text()));
            log(g, who(me) + " использовали Быкова: выберите карту действия из стопки сброса себе в руку");
        }
    }

    public void enterBounce(RuleNode g, RuleNode me, RuleNode source) {
        g.set("pending", object("kind", "persona_32_pick_bounce_target", "playerId", me.get("id").text(),
            "sourceCardId", source.get("id").text(), "cancellable", true));
        log(g, who(me) + " (" + name(source) + "): выберите персону в своей коалиции, чтобы вернуть в руку.");
    }

    public boolean pickDiscard(RuleNode g, String actor, String cardId) {
        if (!owns(g, actor, "persona_20_pick_from_discard")) return false;
        RuleNode discard = g.get("discard");
        int index = indexOf(discard, cardId);
        RuleNode card = discard.at(index);
        if (card.missing() || card.get("type").text().equals("event")) return false;
        discard.removeAt(index);
        RuleNode me = find(g.get("players"), actor);
        if (me.missing()) return false;
        me.get("hand").add(card);
        String title = card.get("type").text().equals("action") ? actionTitle.apply(card) : name(card);
        log(g, who(me) + " используя Быкова взял «" + title + "» из сброса.");
        g.set("pending", null);
        return true;
    }

    public boolean bounce(RuleNode g, String actor, String cardId) {
        if (!owns(g, actor, "persona_32_pick_bounce_target")) return false;
        RuleNode me = find(g.get("players"), actor);
        if (me.missing()) return false;
        RuleNode coalition = me.get("coalition");
        int index = indexOf(coalition, cardId);
        RuleNode target = coalition.at(index);
        if (!target.get("type").text().equals("persona")) return false;
        coalition.removeAt(index);
        me.get("hand").add(target);
        // The source name is resolved after removal, including when it returns itself.
        String sourceName = "persona_32";
        for (int i = 0; i < coalition.size(); i++) {
            RuleNode source = coalition.at(i);
            if (!source.get("id").text().split("#", 2)[0].equals("persona_32")) continue;
            sourceName = source.get("name").truthy() ? source.get("name").text()
                : source.get("text").truthy() ? source.get("text").text() : "persona_32";
            break;
        }
        log(g, who(me) + " " + sourceName + " вернул " + name(target) + " в руку.");
        g.set("pending", null);
        scoring.recalculate(g);
        return true;
    }

    public boolean cancelBounce(RuleNode g, String actor) {
        if (!owns(g, actor, "persona_32_pick_bounce_target")) return false;
        g.set("pending", null);
        return true;
    }

    private static boolean owns(RuleNode g, String actor, String kind) {
        return g.get("pending").get("kind").text().equals(kind) && g.get("pending").get("playerId").text().equals(actor);
    }
    private static RuleNode find(RuleNode nodes, String id) { return nodes.at(indexOf(nodes, id)); }
    private static int indexOf(RuleNode nodes, String id) {
        for (int i = 0; i < nodes.size(); i++) if (nodes.at(i).get("id").text().equals(id)) return i;
        return -1;
    }
    private static String name(RuleNode card) { return card.get("name").truthy() ? card.get("name").text() : card.get("id").text(); }
    private static String who(RuleNode player) { String name = player.get("name").text(); return name.equals("You") ? "Вы" : name; }
    private static void log(RuleNode g, String text) { g.get("log").add(text); }
}
