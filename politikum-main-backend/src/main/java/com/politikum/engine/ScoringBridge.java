package com.politikum.engine;

import com.politikum.util.JsonUtils;
import java.util.*;
import static com.politikum.engine.GameState.*;

/** Temporary JSON adapter. Only scoring fields are patched into existing guest objects. */
public final class ScoringBridge {
    private final JavaScoringRules rules = new JavaScoringRules();
    public String execute(String operation, String json) {
        Map<String, Object> request = JsonUtils.parseMap(json);
        Map<String, Object> g = map(request.get("G")), card = map(request.get("card"));
        switch (operation) {
            case "score" -> { return JsonUtils.stringify(JavaScoringRules.numeric(rules.scorePlayer(map(request.get("player"))))); }
            case "recalculate" -> rules.recalculate(g);
            case "simpleTokens" -> rules.applySimpleTokens(card, JavaScoringRules.number(request.get("delta")));
            case "tokens" -> rules.applyTokens(g, card, JavaScoringRules.number(request.get("delta")), truthy(request.get("mirrored")));
            case "personaDiscarded" -> rules.personaDiscarded(g);
            default -> throw new IllegalArgumentException("Unknown native scoring operation: " + operation);
        }
        List<Object> players = new ArrayList<>();
        for (Map<String, Object> p : GameState.<Map<String, Object>>list(g.get("players"))) {
            players.add(GameState.<Map<String, Object>>list(p.get("coalition")).stream().map(ScoringBridge::values).toList());
        }
        return JsonUtils.stringify(object("card", values(card), "players", players));
    }
    private static Map<String, Object> values(Map<String, Object> card) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (String key : List.of("vp", "vpDelta", "passiveVpDelta", "plusTokens", "minusTokens")) {
            if (card.containsKey(key)) out.put(key, card.get(key));
        }
        return out;
    }
}
