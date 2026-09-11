package com.politikum.engine;

import java.util.*;
import static com.politikum.engine.GameState.*;

/** Authoritative scoring and token rules, independent of Graal and HTTP. */
public final class JavaScoringRules {
    public double scorePlayer(Map<String, Object> player) {
        double score = 0;
        for (Map<String, Object> c : cards(player)) score += number(c.get("vp") == null ? c.get("baseVp") : c.get("vp"));
        return score;
    }

    public void recalculate(Map<String, Object> g) {
        List<Map<String, Object>> players = list(g.get("players"));
        for (Map<String, Object> p : players) {
            List<Map<String, Object>> coalition = cards(p);
            long males = coalition.stream().filter(c -> taggedPersona(c, "gender:m")).count();
            long myLeft = leftCount(coalition);
            long otherLeft = players.stream().filter(other -> !Objects.equals(String.valueOf(other.get("id")), String.valueOf(p.get("id"))))
                .mapToLong(other -> leftCount(cards(other))).sum();
            for (int i = 0; i < coalition.size(); i++) {
                Map<String, Object> card = coalition.get(i);
                if (!isPersona(card)) continue;
                double passive = 0;
                if (!truthy(card.get("blockedAbilities"))) {
                    switch (baseId(card)) {
                        case "persona_2" -> passive = -(males - (taggedPersona(card, "gender:m") ? 1 : 0));
                        case "persona_25" -> passive = coalition.subList(0, i).stream().filter(JavaScoringRules::isPersona).count();
                        case "persona_27" -> {
                            Set<String> factions = new HashSet<>();
                            for (Map<String, Object> c : coalition) {
                                if (!isPersona(c)) continue;
                                for (Object tag : list(c.get("tags"))) {
                                    if (tag instanceof String text && text.startsWith("faction:")) {
                                        if (!text.equals("faction:leftwing")) factions.add(text);
                                        break;
                                    }
                                }
                            }
                            passive = -factions.size();
                        }
                        case "persona_24" -> passive = otherLeft - myLeft;
                        case "persona_33" -> {
                            String faction = Objects.toString(card.get("chosenFactionTag"), "");
                            if (!faction.isEmpty()) passive = coalition.stream().filter(c -> taggedPersona(c, faction)).count();
                        }
                        case "persona_18" -> {
                            int adjacent = 0;
                            if (i > 0 && taggedPersona(coalition.get(i - 1), "faction:fbk")) adjacent++;
                            if (i + 1 < coalition.size() && taggedPersona(coalition.get(i + 1), "faction:fbk")) adjacent++;
                            passive = -3 * adjacent;
                        }
                        default -> { }
                    }
                }
                card.put("passiveVpDelta", numeric(passive));
                updateVp(card);
            }
        }
    }

    /** Legacy ability arithmetic does not update separate plus/minus counters. */
    public void applySimpleTokens(Map<String, Object> card, double delta) {
        card.put("vpDelta", numeric(number(card.get("vpDelta")) + delta));
        updateVp(card);
    }

    public void applyTokens(Map<String, Object> g, Map<String, Object> card, double delta, boolean mirrored) {
        if (delta > 0 && baseId(card).equals("persona_43")) delta = Math.max(0, delta - 1);
        double oldDelta = number(card.get("vpDelta"));
        double plus = card.get("plusTokens") == null ? Math.max(0, oldDelta) : number(card.get("plusTokens"));
        double minus = card.get("minusTokens") == null ? Math.max(0, -oldDelta) : number(card.get("minusTokens"));
        if (delta > 0) plus += delta;
        if (delta < 0) minus += Math.abs(delta);
        card.put("plusTokens", numeric(plus)); card.put("minusTokens", numeric(minus));
        card.put("vpDelta", numeric(plus - minus)); updateVp(card);
        if (!mirrored && delta != 0 && baseId(card).equals("persona_22")) {
            double give = delta + (delta > 0 ? 1 : -1);
            for (Map<String, Object> p : GameState.<Map<String, Object>>list(g.get("players"))) {
                for (Map<String, Object> other : cards(p)) {
                    if (!baseId(other).equals("persona_15")) continue;
                    double armed = number(other.get("_p15ArmedTurn"));
                    if (armed != 0 && number(g.get("turnN")) < armed) continue;
                    applyTokens(g, other, give, true);
                }
            }
        }
    }

    public void personaDiscarded(Map<String, Object> g) {
        for (Map<String, Object> p : GameState.<Map<String, Object>>list(g.get("players"))) {
            for (Map<String, Object> c : cards(p)) if (baseId(c).equals("persona_44")) applyTokens(g, c, 1, false);
        }
    }

    private static void updateVp(Map<String, Object> c) {
        c.put("vp", numeric(number(c.get("baseVp")) + number(c.get("vpDelta")) + number(c.get("passiveVpDelta"))));
    }
    private static List<Map<String, Object>> cards(Map<String, Object> p) { return list(p.get("coalition")); }
    private static boolean isPersona(Map<String, Object> c) { return "persona".equals(c.get("type")); }
    private static boolean taggedPersona(Map<String, Object> c, String tag) { return isPersona(c) && list(c.get("tags")).contains(tag); }
    private static long leftCount(List<Map<String, Object>> cards) { return cards.stream().filter(c -> taggedPersona(c, "faction:leftwing")).count(); }
    private static String baseId(Map<String, Object> c) { return Objects.toString(c.get("id"), "").split("#", 2)[0]; }
    public static double number(Object value) {
        if (value == null) return 0;
        if (value instanceof Number n) return n.doubleValue();
        if (value instanceof Boolean b) return b ? 1 : 0;
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) return 0;
        try { return Double.parseDouble(text); } catch (NumberFormatException e) { return Double.NaN; }
    }
    public static Number numeric(double value) {
        if (!Double.isFinite(value)) return null; // JS JSON.stringify converts NaN/Infinity to null.
        if (value == Math.rint(value) && value >= Long.MIN_VALUE && value < Long.MAX_VALUE) return (long) value;
        return value;
    }
}
