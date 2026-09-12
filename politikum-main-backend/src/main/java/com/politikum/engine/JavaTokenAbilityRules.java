package com.politikum.engine;

import static com.politikum.engine.GameState.object;

/** Persona 21/26/28 choices. Shared scoring owns token arithmetic and discard bonuses. */
public final class JavaTokenAbilityRules {
    private final JavaAbilityRules.Scoring scoring;
    public JavaTokenAbilityRules(JavaAbilityRules.Scoring scoring) { this.scoring = scoring; }

    public void enter(int persona, RuleNode g, RuleNode me, RuleNode card) {
        if (persona == 26 && !hasEntryTarget(g, true)) {
            log(g, actor(me, 26) + ": нет красно-националистического персонажа для сброса.");
            return;
        }
        String stealMessage = me.get("name").text() + " разыграл способность Ведута: выберите персонажа не из ФБК, и заберите у него до 3-ёх +1 токенов";
        if (persona == 28 && !hasEntryTarget(g, false)) {
            log(g, stealMessage);
            log(g, me.get("name").text() + " Ни у кого не нашлось токенов. Это какой-то провал!");
            return;
        }
        g.set("pending", object("kind", kind(persona), "playerId", me.get("id").text(), "sourceCardId", card.get("id").text()));
        log(g, switch (persona) {
            case 21 -> actor(me, 21) + " выбрал способность: инвертировать жетоны любого персонажа.";
            case 26 -> me.get("name").text() + " разыграл способность Демушкина: выберите красного националиста, чтобы сбросить и унаследовать его +1 токены";
            case 28 -> stealMessage;
            default -> throw new IllegalArgumentException("Unknown token ability: " + persona);
        });
    }

    public boolean choose(int persona, RuleNode g, RuleNode request, String actorId, String targetId) {
        RuleNode pending = g.get("pending");
        if (!pending.get("kind").text().equals(kind(persona)) || !pending.get("playerId").text().equals(actorId)) return false;
        RuleNode players = g.get("players");
        RuleNode me = find(players, actorId);
        RuleNode self = firstBase(me.get("coalition"), "persona_" + persona);
        if (persona != 21 && (me.missing() || self.missing())) return false;
        RuleNode owner = find(players, request.get("ownerId").text());
        if (owner.missing()) return false;
        RuleNode coalition = owner.get("coalition");
        int index = indexOf(coalition, targetId);
        RuleNode target = coalition.at(index);
        if (!isPersona(target)) return false;
        if (persona != 21 && target.get("shielded").truthy()) return false;
        switch (persona) {
            case 21 -> {
                double before = target.get("vpDelta").number();
                double plus = target.get("plusTokens").missing() ? Math.max(0, before) : target.get("plusTokens").number();
                double minus = target.get("minusTokens").missing() ? Math.max(0, -before) : target.get("minusTokens").number();
                target.set("plusTokens", minus);
                target.set("minusTokens", plus);
                target.set("vpDelta", -before);
                scoring.recalculate(g);
                String who = me.get("name").truthy() ? me.get("name").text() : actorId;
                log(g, ru(who) + " перевернул жетоны на " + name(target) + " (" + number(before) + " → " + number(target.get("vpDelta").number()) + ").");
            }
            case 26 -> {
                if (!tagged(target, "faction:red_nationalist")) return false;
                double plus = Math.max(0, target.get("vpDelta").number());
                coalition.removeAt(index);
                // Keep the live card reference: the source may itself have been discarded.
                g.get("discard").add(target);
                scoring.personaDiscarded(g);
                if (nonzero(plus)) scoring.tokens(g, self, plus);
                scoring.recalculate(g);
                log(g, actor(me, 26) + " сбросил " + name(target) + " и унаследовал " + number(plus) + " × +1.");
            }
            case 28 -> {
                if (tagged(target, "faction:fbk")) return false;
                double want = Math.max(0, Math.min(3, request.get("amount").number()));
                double take = Math.min(want, Math.max(0, target.get("vpDelta").number()));
                if (nonzero(take)) {
                    scoring.tokens(g, target, -take);
                    scoring.tokens(g, self, take);
                }
                scoring.recalculate(g);
                log(g, actor(me, 28) + " украл " + number(take) + " × +1 у " + name(target) + ".");
            }
            default -> throw new IllegalArgumentException("Unknown token ability: " + persona);
        }
        g.set("pending", null);
        return true;
    }

    private static boolean hasEntryTarget(RuleNode g, boolean redOnly) {
        RuleNode players = g.get("players");
        for (int i = 0; i < players.size(); i++) {
            RuleNode coalition = players.at(i).get("coalition");
            for (int j = 0; j < coalition.size(); j++) {
                RuleNode card = coalition.at(j);
                if (!isPersona(card) || base(card).equals("persona_31") || card.get("shielded").truthy()) continue;
                if (redOnly ? tagged(card, "faction:red_nationalist") : card.get("vpDelta").number() > 0) return true;
            }
        }
        return false;
    }
    private static String kind(int persona) {
        return switch (persona) {
            case 21 -> "persona_21_pick_target_invert";
            case 26 -> "persona_26_pick_red_nationalist";
            case 28 -> "persona_28_pick_non_fbk";
            default -> throw new IllegalArgumentException("Unknown token ability: " + persona);
        };
    }
    private static String actor(RuleNode player, int persona) {
        RuleNode self = firstBase(player.get("coalition"), "persona_" + persona);
        String title = self.get("name").truthy() ? self.get("name").text()
            : self.get("text").truthy() ? self.get("text").text() : "persona_" + persona;
        return ru(player.get("name").text()) + " " + title;
    }
    private static RuleNode firstBase(RuleNode cards, String base) {
        for (int i = 0; i < cards.size(); i++) if (base(cards.at(i)).equals(base)) return cards.at(i);
        return cards.at(-1);
    }
    private static RuleNode find(RuleNode cards, String id) { return cards.at(indexOf(cards, id)); }
    private static int indexOf(RuleNode cards, String id) {
        for (int i = 0; i < cards.size(); i++) if (cards.at(i).get("id").text().equals(id)) return i;
        return -1;
    }
    private static boolean tagged(RuleNode card, String tag) {
        RuleNode tags = card.get("tags");
        for (int i = 0; i < tags.size(); i++) if (tags.at(i).text().equals(tag)) return true;
        return false;
    }
    private static boolean isPersona(RuleNode c) { return c.get("type").text().equals("persona"); }
    private static String base(RuleNode c) { return c.get("id").text().split("#", 2)[0]; }
    private static String name(RuleNode c) { return c.get("name").truthy() ? c.get("name").text() : c.get("id").text(); }
    private static String ru(String name) { return name.equals("You") ? "Вы" : name; }
    private static boolean nonzero(double value) { return value != 0 && !Double.isNaN(value); }
    private static String number(double value) { return Double.isFinite(value) ? String.valueOf(JavaScoringRules.numeric(value)) : Double.toString(value); }
    private static void log(RuleNode g, String text) { g.get("log").add(text); }
}
