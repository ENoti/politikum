package com.politikum.engine;

import com.fasterxml.jackson.core.type.TypeReference;
import com.politikum.service.PolitikumEngine;
import com.politikum.util.JsonUtils;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import java.time.*;
import java.util.*;
import static com.politikum.engine.GameState.*;
import static org.junit.jupiter.api.Assertions.*;

class JavaLobbyEngineTest {
    JavaLobbyEngine engine() throws Exception { return new JavaLobbyEngine(new CardCatalog(), Clock.fixed(Instant.ofEpochMilli(1234567890), ZoneOffset.UTC), () -> 0.25); }

    @Test void matchesLegacyCheckpointsWithTheSameClockAndRandomness() throws Exception {
        List<Map<String, Object>> checkpoints;
        try (var input = new ClassPathResource("engine/lobby-legacy.json").getInputStream()) {
            checkpoints = JsonUtils.mapper().readValue(input, new TypeReference<>() {});
        }
        var engine = engine();
        Map<String, Object> state = engine.createMatchState(4);
        for (var step : checkpoints) {
            if (step.get("move") != null) {
                String original = JsonUtils.stringify(state);
                var result = engine.applyMove(state, (String) step.get("id"), (String) step.get("move"), list(step.get("args")));
                assertEquals(original, JsonUtils.stringify(state), "Input state must not mutate");
                assertEquals(step.get("ok"), result.get("ok"));
                assertEquals(step.get("error"), result.get("error"));
                state = map(result.get("state"));
            }
            assertEquals(JsonUtils.mapper().readTree(JsonUtils.stringify(step.get("expected"))), LegacyParity.normalize(JsonUtils.mapper().readTree(JsonUtils.stringify(normalize(state)))), String.valueOf(step.get("move")));
        }
    }

    @Test void everyMaterializedCardMatchesTheLegacyCatalog() throws Exception {
        var catalog = new CardCatalog();
        List<Map<String, Object>> cards = new ArrayList<>();
        for (String type : List.of("persona", "event", "action")) cards.addAll(catalog.materialize(type));
        String expected;
        try (var in = new ClassPathResource("engine/catalog-legacy.sha256").getInputStream()) {
            expected = new String(in.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8).trim();
        }
        byte[] digest = java.security.MessageDigest.getInstance("SHA-256").digest(
            JsonUtils.stringify(canonical(cards)).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        assertEquals(expected, HexFormat.of().formatHex(digest));
    }

    static Object canonical(Object value) {
        if (value instanceof List<?> values) return values.stream().map(JavaLobbyEngineTest::canonical).toList();
        if (value instanceof Map<?, ?> values) {
            Map<String, Object> sorted = new TreeMap<>();
            values.forEach((key, item) -> sorted.put(String.valueOf(key), canonical(item)));
            return sorted;
        }
        return value;
    }

    @Test void dealsAllSeatCountsWithoutEventsOrDuplicateInstances() throws Exception {
        var engine = engine();
        for (int count = 2; count <= 5; count++) {
            var state = engine.createMatchState(count);
            for (int i = 1; i < count; i++) state = map(engine.applyMove(state, "0", "addBot", List.of()).get("state"));
            state = map(engine.applyMove(state, "0", "startGame", List.of()).get("state"));
            var g = map(state.get("G")); Set<String> ids = new HashSet<>();
            for (Object player : list(g.get("players"))) {
                List<Map<String, Object>> hand = list(map(player).get("hand"));
                assertEquals(5, hand.size());
                for (var card : hand) { assertNotEquals("event", card.get("type")); assertTrue(ids.add((String) card.get("id"))); }
            }
            List<Map<String, Object>> deck = list(g.get("deck"));
            assertEquals(83 - count * 5, deck.size());
            assertEquals(15, deck.stream().filter(c -> "event".equals(c.get("type"))).count());
            for (var card : deck) assertTrue(ids.add((String) card.get("id")));
            assertEquals(83, ids.size());
        }
    }

    @Test void enforcesLobbyRulesAndChatLimitAndPreservesExtensions() throws Exception {
        var engine = engine(); var state = engine.createMatchState(2);
        map(state.get("G")).put("futureRule", Map.of("nested", List.of(1, 2)));
        for (String move : List.of("startGame", "removePlayer")) assertEquals(false, engine.applyMove(state, "1", move, List.of("0")).get("ok"));
        assertEquals(false, engine.applyMove(state, "0", "startGame", List.of()).get("ok"));
        assertEquals(false, engine.applyMove(state, "0", "setPlayerName", List.of(" ")).get("ok"));
        for (int i = 0; i < 85; i++) state = map(engine.applyMove(state, "0", "submitChat", List.of("message" + i)).get("state"));
        List<Map<String, Object>> chat = list(map(state.get("G")).get("chat"));
        assertEquals(80, chat.size()); assertEquals("message5", chat.get(0).get("text"));
        assertEquals(Map.of("nested", List.of(1, 2)), map(state.get("G")).get("futureRule"));
        map(state.get("ctx")).put("gameover", true);
        assertEquals("gameover", engine.applyMove(state, "0", "submitChat", List.of("hello")).get("error"));
    }

    @Test void nativeStateContinuesThroughRemainingJsMovesAndBack() throws Exception {
        var engine = new PolitikumEngine();
        try {
            var state = engine.createMatchState(2);
            state = map(engine.applyMove(state, "0", "addBot", List.of()).get("state"));
            state = map(engine.applyMove(state, "0", "startGame", List.of()).get("state"));
            List<Map<String, Object>> deck = list(map(state.get("G")).get("deck"));
            int i = 0; while ("event".equals(deck.get(i).get("type"))) i++;
            Collections.swap(deck, 0, i);
            var drawn = engine.applyMove(state, "0", "beginTurnDraw", List.of());
            assertEquals(true, drawn.get("ok")); state = map(drawn.get("state"));
            assertEquals(6, list(map(GameState.<Object>list(map(state.get("G")).get("players")).get(0)).get("hand")).size());
            assertEquals(true, engine.applyMove(state, "0", "submitChat", List.of("Java after JS")).get("ok"));
        } finally { engine.close(); }
    }

    static Object normalize(Object value) {
        if (value instanceof List<?> values) return values.stream().map(JavaLobbyEngineTest::normalize).toList();
        if (value instanceof Map<?, ?> values) {
            if (values.containsKey("id") && values.containsKey("type")) return values.get("id");
            Map<String, Object> result = new LinkedHashMap<>();
            values.forEach((key, item) -> { if (!"trace".equals(key)) result.put(String.valueOf(key), normalize(item)); });
            return result;
        }
        return value;
    }
}
