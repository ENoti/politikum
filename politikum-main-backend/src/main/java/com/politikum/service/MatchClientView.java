package com.politikum.service;

import java.util.*;

/** Public match boundary: persisted engine state must never be returned directly. */
public final class MatchClientView {
    private MatchClientView() {}

    public static Map<String, Object> state(Map<String, Object> state, String viewerId) {
        Map<String, Object> out = pick(state, "_stateID");
        out.put("ctx", pick(map(state.get("ctx")), "numPlayers", "phase", "currentPlayer",
            "playOrderPos", "turn", "gameover"));
        Map<String, Object> source = map(state.get("G"));
        Map<String, Object> g = pick(source, "discard", "activePlayerIds", "log", "chat", "history",
            "hasDrawn", "hasPlayed", "playsThisTurn", "maxPlaysThisTurn", "playVpDelta", "drawsThisTurn",
            "lastAction", "lastEvent", "gameOver", "winnerId", "roundEnding", "roundEndTurn",
            "turnN", "turnStartedAtMs", "botNextActAtMs", "botPauseUntilMs");
        // Retain array lengths for card-back/count rendering, without IDs or faces.
        g.put("deck", hiddenCards(source.get("deck")));
        Map<String, Object> pending = map(source.get("pending"));
        g.put("pending", choice(source.get("pending")));
        g.put("pendingDeferred", choice(source.get("pendingDeferred")));
        g.put("response", source.get("response") == null ? null : pick(map(source.get("response")),
            "kind", "playedBy", "personaCard", "actionCard", "expiresAtMs", "persona8Swap", "allowPersona10By"));
        List<Map<String, Object>> players = new ArrayList<>();
        for (Object item : list(source.get("players"))) {
            Map<String, Object> player = map(item);
            Map<String, Object> view = pick(player, "id", "name", "coalition", "isBot", "active", "surrendered");
            view.put("identity", pick(map(player.get("identity")), "playerId"));
            boolean ownHand = viewerId != null && viewerId.equals(String.valueOf(player.get("id")));
            // Arno explicitly reveals the selected opponent's hand to the acting player.
            boolean arno = viewerId != null && viewerId.equals(pending.get("playerId"))
                && "persona_17_pick_persona_from_hand".equals(pending.get("kind"))
                && Objects.equals(String.valueOf(player.get("id")), pending.get("targetId"));
            view.put("hand", ownHand || arno ? withoutSecrets(list(player.get("hand"))) : hiddenCards(player.get("hand")));
            players.add(view);
        }
        g.put("players", players);
        out.put("G", g);
        g.put("choices", MatchChoices.forView(out,viewerId));
        return out;
    }

    public static Map<String, Object> seat(Map<String, Object> source) {
        Map<String, Object> out = pick(source, "id", "playerId", "name", "reservedName", "isConnected",
            "isBot", "isActive", "seatIndex", "seat", "score");
        out.put("data", pick(map(source.get("data")), "playerId"));
        return out;
    }

    private static Object choice(Object source) {
        return source == null ? null : pick(map(source), "kind", "playerId", "attackerId", "targetId",
            "targetIds", "sourceCardId", "personaId", "abilityKey", "remaining", "delta", "taken",
            "leftId", "rightId", "cancellable");
    }

    private static List<Object> hiddenCards(Object cards) {
        return new ArrayList<>(Collections.nCopies(list(cards).size(), Map.of("hidden", true)));
    }

    private static Map<String, Object> pick(Map<String, Object> source, String... keys) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (String key : keys) if (source.containsKey(key)) out.put(key, withoutSecrets(source.get(key)));
        return out;
    }

    /** Also strips credentials from historical tournament result metadata. */
    public static Object withoutSecrets(Object value) {
        if (value instanceof Map<?, ?> values) {
            Map<String, Object> out = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : values.entrySet()) {
                String key = String.valueOf(entry.getKey());
                if (Set.of("credentials", "playerCredentials", "email", "trace", "debugLastMoveReject",
                    "debugLastEndTurnReject").contains(key)) continue;
                out.put(key, withoutSecrets(entry.getValue()));
            }
            return out;
        }
        if (value instanceof List<?> values) return values.stream().map(MatchClientView::withoutSecrets).toList();
        return value;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object value) {
        return value instanceof Map<?, ?> ? (Map<String, Object>) value : Map.of();
    }

    private static List<?> list(Object value) {
        return value instanceof List<?> values ? values : List.of();
    }
}
