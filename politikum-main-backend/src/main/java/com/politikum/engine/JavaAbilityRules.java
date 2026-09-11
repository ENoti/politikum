package com.politikum.engine;

import java.util.*;
import static com.politikum.engine.GameState.object;

/** First native ability group: adjacency and persona 4/12 effects. */
public final class JavaAbilityRules {
    public interface Scoring {
        void simple(RuleNode card, double delta);
        void tokens(RuleNode g, RuleNode card, double delta);
        void recalculate(RuleNode g);
    }
    private final Scoring scoring;
    public JavaAbilityRules(Scoring scoring) { this.scoring = scoring; }

    public boolean invoke(String operation, RuleNode g, RuleNode me, RuleNode card, RuleNode ctx, String actor, String target) {
        switch (operation) {
            case "on_enter_adjacent_bonus" -> adjacent(g, me, card);
            case "persona_4_on_enter_twitter_penalty" -> twitter(g, me, card);
            case "persona_12_on_enter_adjacent_red_buff" -> redBuff(g, me, card);
            case "around" -> around(g, me, card);
            case "chooseRed" -> { return chooseRed(g, ctx, actor, target); }
            case "retaliate" -> { return retaliate(g, ctx.get("ownerId").text(), actor, target); }
            case "skipRetaliation" -> {
                if (!ownsRetaliation(g, actor)) return false;
                g.set("pending", null);
            }
            default -> throw new IllegalArgumentException("Unknown native ability: " + operation);
        }
        return true;
    }
    private void adjacent(RuleNode g, RuleNode me, RuleNode card) {
        RuleNode coalition = me.get("coalition");
        int index = find(coalition, card.get("id").text());
        if (index < 0) return;
        RuleNode left = coalition.at(index - 1), right = coalition.at(index + 1);
        boolean l = contains(card.get("params").get("neighbors"), base(left));
        boolean r = contains(card.get("params").get("neighbors"), base(right));
        if (!l && !r) return;
        double tokens = card.get("params").get("tokens").missing() ? 4 : card.get("params").get("tokens").number();
        List<String> affected = new ArrayList<>();
        give(card, tokens, affected);
        if (l) give(left, tokens, affected);
        if (r) give(right, tokens, affected);
        if (!affected.isEmpty()) log(g, me.get("name").text() + " adjacency bonus: +" + num(tokens) + " (" + String.join(" + ", affected) + ").");
    }
    private static boolean ownsRetaliation(RuleNode g, String actor) {
        RuleNode pending = g.get("pending");
        return pending.get("kind").text().equals("persona_13_pick_target")
            && pending.get("playerId").text().equals(actor);
    }
    private boolean retaliate(RuleNode g, String owner, String actor, String targetId) {
        if (!ownsRetaliation(g, actor)) return false;
        RuleNode players = g.get("players");
        RuleNode attacker = players.at(find(players, g.get("pending").get("attackerId").text()));
        if (attacker.missing() || !owner.equals(attacker.get("id").text())) return false;
        RuleNode target = attacker.get("coalition").at(find(attacker.get("coalition"), targetId));
        if (!persona(target) || target.get("shielded").truthy()) return false;
        scoring.tokens(g, target, -1);
        scoring.recalculate(g);
        RuleNode me = players.at(find(players, actor));
        String who = me.get("name").truthy() ? me.get("name").text() : actor;
        if (who.equals("You")) who = "Вы";
        log(g, who + " (Венедитков): дал -1 на " + name(target) + ".");
        g.set("pending", null);
        return true;
    }
    private void give(RuleNode card, double amount, List<String> affected) {
        if (!persona(card) || card.get("_adjBonusApplied").truthy()) return;
        card.set("_adjBonusApplied", true);
        scoring.simple(card, amount); affected.add(name(card));
    }
    private void twitter(RuleNode g, RuleNode me, RuleNode card) {
        int count = 0;
        for (int i = 0; i < g.get("discard").size(); i++)
            if (contains(g.get("discard").at(i).get("tags"), "event_type:twitter_squabble")) count++;
        if (count == 0) return;
        scoring.simple(card, -2 * count);
        log(g, me.get("name").text() + " (" + name(card) + ") got " + (2 * count) + " × -1 from twitter squabbles in discard.");
    }
    private void redBuff(RuleNode g, RuleNode me, RuleNode card) {
        RuleNode coalition = me.get("coalition");
        int index = find(coalition, card.get("id").text());
        RuleNode left = coalition.at(index - 1), right = coalition.at(index < 0 ? -1 : index + 1);
        boolean l = red(left), r = red(right);
        String prefix = me.get("name").text() + " (" + name(card) + ") ";
        if (!l && !r) { log(g, prefix + "has no valid adjacent red_nationalist target."); return; }
        if (l != r) {
            RuleNode selected = l ? left : right;
            scoring.simple(selected, 2); log(g, prefix + "buffed " + name(selected) + " (+2)."); return;
        }
        g.set("pending", object("kind", "persona_12_choose_adjacent_red", "playerId", me.get("id").text(),
            "sourceCardId", card.get("id").text(), "leftId", left.get("id").text(), "rightId", right.get("id").text()));
        log(g, prefix + "choose adjacent red_nationalist to buff (+2).");
    }
    private boolean chooseRed(RuleNode g, RuleNode ctx, String actor, String target) {
        RuleNode pending = g.get("pending");
        if (!pending.get("kind").text().equals("persona_12_choose_adjacent_red")
            || !ctx.get("currentPlayer").text().equals(actor) || !pending.get("playerId").text().equals(actor)) return false;
        RuleNode me = g.get("players").at(find(g.get("players"), actor));
        if (me.missing()) return false;
        List<RuleNode> candidates = new ArrayList<>();
        for (String side : List.of("leftId", "rightId")) {
            String id = pending.get(side).text();
            RuleNode candidate = me.get("coalition").at(find(me.get("coalition"), id));
            if (!id.isEmpty() && red(candidate)) candidates.add(candidate);
        }
        String prefix = me.get("name").text() + " (" + pending.get("sourceCardId").text() + ") ";
        if (candidates.isEmpty()) {
            log(g, prefix + "has no valid adjacent target anymore; ability skipped.");
        } else {
            boolean automatic = candidates.size() == 1 && target.isEmpty();
            RuleNode chosen = automatic ? candidates.get(0) : me.get("coalition").at(find(me.get("coalition"), target));
            if (!automatic && (!target.equals(pending.get("leftId").text()) && !target.equals(pending.get("rightId").text()) || !red(chosen))) return false;
            scoring.tokens(g, chosen, 2);
            log(g, prefix + (automatic ? "auto-buffed " : "buffed ") + name(chosen) + " (+2).");
        }
        g.set("pending", null); scoring.recalculate(g); return true;
    }
    private void around(RuleNode g, RuleNode me, RuleNode placed) {
        if (me.missing() || placed.missing()) return;
        int index = find(me.get("coalition"), placed.get("id").text());
        if (index < 0) return;
        for (int i : new int[]{index - 1, index + 1}) {
            RuleNode neighbor = me.get("coalition").at(i);
            if (!persona(neighbor) || !neighbor.get("abilityKey").text().equals("on_enter_adjacent_bonus")) continue;
            if (neighbor.get("blockedAbilities").truthy()) {
                String who = me.get("name").text().equals("You") ? "Вы" : me.get("name").text();
                log(g, who + ": способность заблокирована (on_enter_adjacent_bonus, " + neighbor.get("id").text() + ").");
            } else adjacent(g, me, neighbor);
        }
    }
    private static boolean persona(RuleNode c) { return c.get("type").text().equals("persona"); }
    private static boolean red(RuleNode c) { return persona(c) && contains(c.get("tags"), "faction:red_nationalist") && !c.get("shielded").truthy(); }
    private static int find(RuleNode a, String id) { for (int i=0;i<a.size();i++) if(a.at(i).get("id").text().equals(id)) return i; return -1; }
    private static boolean contains(RuleNode a, String text) { if(text.isEmpty())return false; for(int i=0;i<a.size();i++)if(a.at(i).text().equals(text))return true; return false; }
    private static String base(RuleNode c) { return c.get("id").text().split("#",2)[0]; }
    private static String name(RuleNode c) { return c.get("name").truthy() ? c.get("name").text() : c.get("id").text(); }
    private static String num(double n) { return String.valueOf(JavaScoringRules.numeric(n)); }
    private static void log(RuleNode g, String text) { g.get("log").add(text); }
}
