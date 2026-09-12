package com.politikum.engine;

import java.util.function.Function;
import static com.politikum.engine.GameState.object;

/** Persona 34: inspect the next persona without drawing and resolve instant victory. */
public final class JavaTopdeckAbilityRules {
    private final Function<String, String> personaTitle;
    public JavaTopdeckAbilityRules(Function<String, String> personaTitle) { this.personaTitle = personaTitle; }

    public void enter(RuleNode g, RuleNode me, RuleNode source) {
        g.set("pending", object("kind", "persona_34_guess_topdeck", "playerId", me.get("id").text(), "sourceCardId", source.get("id").text()));
        String title = source.get("name").truthy() ? source.get("name").text() : source.get("id").text();
        log(g, who(me) + " (" + title + "): угадайте верхнюю карту колоды.");
    }

    public boolean guess(RuleNode g, RuleNode ctx, String actorId, String guess) {
        RuleNode pending = g.get("pending");
        if (!pending.get("kind").text().equals("persona_34_guess_topdeck") || !pending.get("playerId").text().equals(actorId)) return false;
        RuleNode players = g.get("players");
        RuleNode me = players.at(-1);
        for (int i = 0; i < players.size(); i++) {
            if (players.at(i).get("id").text().equals(actorId)) { me = players.at(i); break; }
        }
        if (me.missing()) return false;
        if (guess.isEmpty() || guess.equals("skip")) {
            g.set("pending", null);
            log(g, actor(me) + " пропустил гадание.");
            return true;
        }
        RuleNode deck = g.get("deck");
        RuleNode found = deck.at(-1);
        int skipped = 0;
        for (int i = 0; i < deck.size(); i++) {
            RuleNode card = deck.at(i);
            if (!card.truthy()) continue;
            if (card.get("type").text().equals("persona")) { found = card; break; }
            skipped++;
        }
        String guessName = personaTitle.apply(guess);
        if (found.missing()) {
            log(g, actor(me) + " загадал " + guessName + ", но в колоде больше нет персон.");
        } else {
            String actual = found.get("id").text().split("#", 2)[0];
            log(g, actor(me) + " загадал " + guessName + ". Следующая персона в колоде (" + skipped + " пропущено): " + personaTitle.apply(actual) + ".");
            if (guess.equals(actual)) {
                g.set("gameOver", true);
                g.set("winnerId", actorId);
                log(g, actor(me) + ": угадал — мгновенная победа для " + who(me) + ".");
                // Same terminal flags as makeEvents.endGame(); do not run round scoring.
                ctx.set("gameover", true);
            }
        }
        g.set("pending", null);
        return true;
    }

    private static String actor(RuleNode me) {
        RuleNode coalition = me.get("coalition");
        String title = "persona_34";
        for (int i = 0; i < coalition.size(); i++) {
            RuleNode card = coalition.at(i);
            if (!card.get("id").text().split("#", 2)[0].equals("persona_34")) continue;
            title = card.get("name").truthy() ? card.get("name").text()
                : card.get("text").truthy() ? card.get("text").text() : "persona_34";
            break;
        }
        return who(me) + " " + title;
    }
    private static String who(RuleNode me) { String name = me.get("name").text(); return name.equals("You") ? "Вы" : name; }
    private static void log(RuleNode g, String message) { g.get("log").add(message); }
}
