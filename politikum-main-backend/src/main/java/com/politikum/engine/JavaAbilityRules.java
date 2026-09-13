package com.politikum.engine;

import java.util.*;
import static com.politikum.engine.GameState.object;

/** Native adjacency, entry effects and player choices; JS only transports these calls. */
public final class JavaAbilityRules {
    /** Display-only compatibility callbacks; game decisions remain in native rules. */
    public interface Titles {
        String action(RuleNode card);
        String persona(String baseId);
    }
    public interface Scoring {
        void simple(RuleNode card, double delta);
        void tokens(RuleNode g, RuleNode card, double delta);
        void recalculate(RuleNode g);
        void personaDiscarded(RuleNode g);
    }
    private final Scoring scoring;
    private final JavaActionRules actions;
    private final JavaEventRules eventRules;
    private final JavaSharedPersonaRules sharedPersonas;
    private final JavaRemainingPersonaRules remainingPersonas;
    private final JavaMigratedBotAbilities botAbilities;
    private final JavaResponseRules responses;
    private final JavaHandAbilityRules handAbilities;
    private final JavaCoalitionAbilityRules coalitionAbilities;
    private final JavaTokenAbilityRules tokenAbilities;
    private final JavaRecoveryAbilityRules recoveryAbilities;
    private final JavaTopdeckAbilityRules topdeckAbility;
    public JavaAbilityRules(Scoring scoring, Titles titles, AbilityEffects effects) {
        this.scoring = scoring;
        this.eventRules = new JavaEventRules(scoring,effects);
        this.sharedPersonas = new JavaSharedPersonaRules(scoring,effects);
        this.remainingPersonas = new JavaRemainingPersonaRules(scoring,effects);
        this.botAbilities = new JavaMigratedBotAbilities(scoring,effects);
        this.responses = new JavaResponseRules(scoring,effects);
        this.actions = new JavaActionRules(scoring,titles,effects,responses);
        this.handAbilities = new JavaHandAbilityRules(scoring,effects);
        this.coalitionAbilities = new JavaCoalitionAbilityRules(scoring);
        this.tokenAbilities = new JavaTokenAbilityRules(scoring);
        this.recoveryAbilities = new JavaRecoveryAbilityRules(scoring, titles::action);
        this.topdeckAbility = new JavaTopdeckAbilityRules(titles::persona);
    }

    public boolean invoke(String operation, RuleNode g, RuleNode me, RuleNode card, RuleNode ctx, String actor, String target) {
        switch (operation) {
            case "playAction" -> { return actions.play(g,ctx,me,actor,card.at(0).text(),card.at(1).text()); }
            case "action7", "action13", "action17", "action18" -> { return actions.choose(Integer.parseInt(operation.substring(6)),g,ctx,me,actor,card.at(0).text(),target); }
            case "actionDiscard" -> { return actions.discardChoice(g,ctx,me,actor,target); }
            case "botActionChoice" -> { return actions.botChoice(g,me); }
            case "botActionPlay" -> actions.botPlay(g,me,card);
            case "draw_1", "event_draw_cards", "event_faction_minus1_draw1", "event_12b_discard_others_hand", "event_shuffle_all_hands_redeal", "event_16_discard_self_persona_then_draw1" -> eventRules.enter(operation,g,me,card);
            case "eventDraw" -> eventRules.draw(g,me,ctx.get("source").text(),ctx.get("count").number());
            case "eventDiscardHand" -> { return eventRules.discardHand(g,actor,target); }
            case "eventDiscardCoalition" -> { return eventRules.discardCoalition(g,actor,target); }
            case "botEventChoice" -> { return eventRules.botDiscard(g,me); }
            case "turnDrawnEvent", "legacyDrawnEvent" -> eventRules.drawnEvent(g,me,card,operation.equals("legacyDrawnEvent"));
            case "turnQueuedEvent" -> eventRules.queuedEvent(g,me,card);
            case "place_tokens_plus_vp" -> sharedPersonas.enterTokens(g,me,card);
            case "discard_one_persona_from_any_coalition" -> sharedPersonas.enterDiscard(g,me,card);
            case "applyPendingToken" -> { return sharedPersonas.tokens(g,actor,target); }
            case "discardPersonaFromCoalition" -> { return sharedPersonas.discard(g,ctx,actor,card); }
            case "persona_3_on_enter_choice" -> remainingPersonas.enter(3,g,me,card);
            case "persona_6_on_action8_plus1" -> remainingPersonas.enter(6,g,me,card);
            case "persona_23_on_enter_self_inflict_draw" -> remainingPersonas.enter(23,g,me,card);
            case "persona_30_on_enter_buff_liberals" -> remainingPersonas.enter(30,g,me,card);
            case "persona_41_on_enter_buff_fbk" -> remainingPersonas.enter(41,g,me,card);
            case "persona_43_on_enter_drain_rightwing" -> remainingPersonas.enter(43,g,me,card);
            case "vacuum38" -> remainingPersonas.vacuum(g,card);
            case "globalEnter22" -> remainingPersonas.globalEnter22(g,card);
            case "choose23" -> { return remainingPersonas.choose23(g,actor,ctx.get("amount").number()); }
            case "recycle39" -> { return remainingPersonas.recycle39(g,ctx,actor); }
            case "skip3", "choose3" -> { return remainingPersonas.choose3(g,ctx,actor,card,operation.equals("skip3")); }
            case "botRemainingPersona" -> { return remainingPersonas.bot(g,me); }
            case "botEarlyChoice" -> {
                String kind=g.get("pending").get("kind").text();
                return (kind.equals("persona_11_offer")||kind.startsWith("persona_17_pick_"))&&botAbilities.choose(g,me,ctx,card);
            }
            case "botMigratedChoice" -> { return botAbilities.choose(g,me,ctx,card); }
            case "cancelPending" -> { return responses.cancelPending(g,ctx,actor); }
            case "swapResponse" -> { return responses.swap(g,actor); }
            case "cancel10" -> { return responses.cancel10(g,actor); }
            case "handlesResponse" -> { return responses.handles(g,card,ctx,actor); }
            case "responseAction" -> { return responses.action(g,me,card,ctx,actor); }
            case "openActionResponse" -> responses.openAction(g,me,card,actor,true);
            case "openUntargetedResponse" -> responses.openAction(g,me,card,actor,false);
            case "playedPersonaResponse" -> responses.playedPersona(g,me,card,actor);
            case "botPersonaResponse" -> responses.openBotPersona(g,card,actor);
            case "persona_16_on_enter_draw3_discard3" -> handAbilities.enter(16,g,me,card);
            case "persona_17_on_enter_steal_persona" -> handAbilities.enter(17,g,me,card);
            case "persona_45_steal_from_opponent" -> handAbilities.enter(45,g,me,card);
            case "discard16", "pick17", "steal17", "steal45" -> { return handAbilities.choose(operation,g,ctx,actor,card,me); }
            case "persona_5_discard_liberal_steal_tokens" -> coalitionAbilities.enter(5,g,me,card);
            case "persona_7_swap_two_in_coalition" -> coalitionAbilities.enter(7,g,me,card);
            case "pickLiberal", "swapCoalition", "skipSolovei", "useSolovei", "discardSolovei" -> { return coalitionAbilities.choose(operation,g,ctx,actor,card); }
            case "persona_34_on_enter_guess_topdeck" -> topdeckAbility.enter(g, me, card);
            case "guessTopdeck" -> { return topdeckAbility.guess(g, ctx, actor, target); }
            case "persona_20_on_enter_take_from_discard" -> recoveryAbilities.enterDiscard(g, me, card);
            case "persona_32_activate_bounce" -> recoveryAbilities.enterBounce(g, me, card);
            case "recoverDiscard" -> { return recoveryAbilities.pickDiscard(g, actor, target); }
            case "bounceToHand" -> { return recoveryAbilities.bounce(g, actor, target); }
            case "cancelBounce" -> { return recoveryAbilities.cancelBounce(g, actor); }
            case "persona_21_on_enter_invert_tokens" -> tokenAbilities.enter(21, g, me, card);
            case "persona_26_on_enter_purge_red_inherit_plus" -> tokenAbilities.enter(26, g, me, card);
            case "persona_28_on_enter_steal_plus_tokens" -> tokenAbilities.enter(28, g, me, card);
            case "invertTokens" -> { return tokenAbilities.choose(21, g, ctx, actor, target); }
            case "purgeRed" -> { return tokenAbilities.choose(26, g, ctx, actor, target); }
            case "stealPlus" -> { return tokenAbilities.choose(28, g, ctx, actor, target); }
            case "on_enter_adjacent_bonus" -> adjacent(g, me, card);
            case "persona_4_on_enter_twitter_penalty" -> twitter(g, me, card);
            case "persona_12_on_enter_adjacent_red_buff" -> redBuff(g, me, card);
            case "persona_33_on_enter_choose_faction" -> g.set("pending", object(
                "kind", "persona_33_choose_faction", "playerId", me.get("id").text(),
                "sourceCardId", card.get("id").text()));
            case "chooseFaction" -> { return chooseFaction(g, actor, target); }
            case "persona_37_on_enter_bribe_and_silence" -> offerBribe(g, me, card);
            case "bribeAndSilence" -> { return bribeAndSilence(g, ctx.get("ownerId").text(), actor, target); }
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
    private static final Map<String, String> FACTIONS = Map.of(
        "faction:liberal", "Либерал", "faction:rightwing", "Правый",
        "faction:leftwing", "Левый", "faction:fbk", "ФБК",
        "faction:red_nationalist", "Красный Националист",
        "faction:system", "Системный", "faction:neutral", "Нейтрал");

    private boolean chooseFaction(RuleNode g, String actor, String tag) {
        RuleNode pending = g.get("pending");
        if (!pending.get("kind").text().equals("persona_33_choose_faction")
            || !pending.get("playerId").text().equals(actor)) return false;
        RuleNode me = g.get("players").at(find(g.get("players"), actor));
        if (me.missing()) return false;
        // Preserve legacy selection of the first persona_33, even if sourceCardId differs.
        RuleNode coalition = me.get("coalition");
        for (int i = 0; i < coalition.size(); i++) {
            RuleNode self = coalition.at(i);
            if (!base(self).equals("persona_33")) continue;
            if (!FACTIONS.containsKey(tag)) return false;
            self.set("chosenFactionTag", tag);
            scoring.recalculate(g);
            String title = self.get("name").truthy() ? self.get("name").text()
                : self.get("text").truthy() ? self.get("text").text() : "persona_33";
            String who = me.get("name").text();
            log(g, (who.equals("You") ? "Вы" : who) + " " + title + " выбрала фракцию " + FACTIONS.get(tag) + ".");
            g.set("pending", null);
            return true;
        }
        return false;
    }
    private static boolean ownsRetaliation(RuleNode g, String actor) {
        RuleNode pending = g.get("pending");
        return pending.get("kind").text().equals("persona_13_pick_target")
            && pending.get("playerId").text().equals(actor);
    }
    private void offerBribe(RuleNode g, RuleNode me, RuleNode card) {
        RuleNode players = g.get("players");
        for (int i = 0; i < players.size(); i++) {
            RuleNode owner = players.at(i);
            if (owner.get("id").text().equals(me.get("id").text())) continue;
            RuleNode coalition = owner.get("coalition");
            for (int j = 0; j < coalition.size(); j++) {
                RuleNode candidate = coalition.at(j);
                if (!persona(candidate) || base(candidate).equals("persona_31") || candidate.get("shielded").truthy()) continue;
                g.set("pending", object("kind", "persona_37_pick_opponent_persona",
                    "playerId", me.get("id").text(), "sourceCardId", card.get("id").text()));
                return;
            }
        }
        String who = me.get("name").text();
        log(g, (who.equals("You") ? "Вы" : who) + " (persona_37): нет цели для подкупа.");
    }

    private boolean bribeAndSilence(RuleNode g, String ownerId, String actor, String targetId) {
        RuleNode pending = g.get("pending");
        if (!pending.get("kind").text().equals("persona_37_pick_opponent_persona")
            || !pending.get("playerId").text().equals(actor)) return false;
        RuleNode players = g.get("players");
        RuleNode me = players.at(find(players, actor));
        RuleNode owner = players.at(find(players, ownerId));
        if (me.missing() || owner.missing() || owner.get("id").text().equals(actor)) return false;
        RuleNode target = owner.get("coalition").at(find(owner.get("coalition"), targetId));
        if (!persona(target) || target.get("shielded").truthy()) return false;
        // Legacy choice resolution does not repeat the entry-time persona_31 exclusion.
        scoring.tokens(g, target, 2);
        target.set("blockedAbilities", true);
        scoring.recalculate(g);
        String selfName = "persona_37";
        RuleNode coalition = me.get("coalition");
        for (int i = 0; i < coalition.size(); i++) {
            RuleNode self = coalition.at(i);
            if (!base(self).equals("persona_37")) continue;
            selfName = self.get("name").truthy() ? self.get("name").text()
                : self.get("text").truthy() ? self.get("text").text() : "persona_37";
            break;
        }
        String who = me.get("name").text();
        log(g, (who.equals("You") ? "Вы" : who) + " " + selfName + " подкупил " + name(target)
            + " (+2) и навсегда заблокировал способности.");
        g.set("pending", null);
        return true;
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
