package com.politikum.service;

import com.politikum.controller.GameApiController;
import com.politikum.util.JsonUtils;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.sqlite.SQLiteDataSource;

import java.nio.file.Path;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class MatchPrivacyTest {
    @TempDir Path directory;
    static PolitikumEngine engine;
    JdbcTemplate jdbc;
    PolitikumRepository repository;
    LiveMatchService service;
    MockMvc http;
    String matchId, hostCredential, guestCredential;

    @BeforeAll static void engine() throws Exception { engine = new PolitikumEngine(); }

    @AfterAll static void closeEngine() { engine.close(); }

    @BeforeEach void setup() {
        SQLiteDataSource source = new SQLiteDataSource();
        source.setUrl("jdbc:sqlite:" + directory.resolve("test.sqlite"));
        jdbc = new JdbcTemplate(source);
        repository = new PolitikumRepository(jdbc);
        repository.init();
        service = new LiveMatchService(jdbc, engine, repository);
        http = MockMvcBuilders.standaloneSetup(new GameApiController(service, repository)).build();
        matchId = (String) service.createMatch(3, "account0", "Alice", "Privacy test").get("matchID");
        hostCredential = (String) service.joinMatch(matchId, "0", "Alice", "account0", "alice@example.test").get("playerCredentials");
        guestCredential = (String) service.joinMatch(matchId, "1", "Bob", "account1", "bob@example.test").get("playerCredentials");
        assertNotNull(hostCredential);
        assertNotNull(guestCredential);
        assertEquals(true, service.applyMove(matchId, "0", hostCredential, "addBot", List.of()).get("ok"));
        assertEquals(true, service.applyMove(matchId, "0", hostCredential, "startGame", List.of()).get("ok"));
    }

    @Test void metadataAndSpectatorStateContainNoCredentialsOrPrivateCards() {
        for (Object response : List.of(service.getMatch(matchId), service.getPublicOpenMatches(50),
            service.getOwnedMatches("account0", 20), service.getState(matchId, null, null))) {
            String json = JsonUtils.stringify(response);
            assertFalse(json.contains(hostCredential));
            assertFalse(json.contains(guestCredential));
            assertFalse(json.contains("@example.test"));
        }
        Map<String, Object> g = g(service.getState(matchId, null, null));
        for (Object player : list(g.get("players"))) assertHidden(map(player).get("hand"));
        assertHidden(g.get("deck"));
        assertFalse(g.containsKey("preDealDeck"));
        assertFalse(g.containsKey("eventDeck"));
        assertFalse(g.containsKey("trace"));
    }

    @Test void authenticatedReadsRevealOnlyTheCredentialOwnersHand() throws Exception {
        http.perform(get("/games/politikum/{id}/state", matchId)
                .header("X-Player-ID", "0").header("X-Player-Credentials", hostCredential))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.state.G.players[0].hand[0].id").exists())
            .andExpect(jsonPath("$.state.G.players[1].hand[0].id").doesNotExist());
        http.perform(get("/games/politikum/{id}/state", matchId)
                .header("X-Player-ID", "1").header("X-Player-Credentials", hostCredential))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.state").doesNotExist());
        http.perform(get("/games/politikum/{id}/state", matchId).header("X-Player-ID", "0"))
            .andExpect(status().isUnauthorized());
        http.perform(get("/games/politikum/{id}/state", matchId).header("X-Player-Credentials", hostCredential))
            .andExpect(status().isUnauthorized());
    }

    @Test void movesTicksAndSurrenderUseTheSamePrivateView() {
        for (String move : List.of("tick", "tickBot", "beginTurnDraw")) {
            assertEquals("bad_credentials", service.applyMove(matchId, "1", hostCredential, move, List.of()).get("error"));
        }
        assertEquals("forbidden_move", service.applyMove(matchId, "0", hostCredential,
            "setPlayerIdentity", List.of(Map.of("playerId", "victim"))).get("error"));
        for (String move : List.of("tick", "tickBot")) {
            assertEquals("server_driven_move", service.applyMove(matchId, "0", hostCredential, move, List.of()).get("error"));
        }
        Map<String, Object> result = service.getState(matchId, "0", hostCredential);
        assertEquals(true, result.get("ok"));
        assertNotNull(map(list(map(list(g(result).get("players")).get(0)).get("hand")).get(0)).get("id"));
        assertHidden(map(list(g(result).get("players")).get(1)).get("hand"));
        assertHidden(g(result).get("deck"));
        assertHidden(map(list(g(service.surrender(matchId, "0", hostCredential)).get("players")).get(1)).get("hand"));
    }

    @Test void ordinaryDrawStillChangesAuthoritativeStateAndReturnsThePrivateHand() {
        Map<String, Object> state = storedState();
        Map<String, Object> original = map(state.get("G"));
        List<Object> deck = new ArrayList<>(list(original.get("deck")));
        int cardIndex = 0;
        while ("event".equals(map(deck.get(cardIndex)).get("type"))) cardIndex++;
        Object drawn = deck.remove(cardIndex);
        deck.add(0, drawn);
        original.put("deck", deck);
        save(state);
        int before = list(map(list(original.get("players")).get(0)).get("hand")).size();
        Map<String, Object> result = service.applyMove(matchId, "0", hostCredential, "beginTurnDraw", List.of());
        assertEquals(true, result.get("ok"));
        List<?> hand = list(map(list(g(result).get("players")).get(0)).get("hand"));
        assertEquals(before + 1, hand.size());
        assertTrue(hand.stream().anyMatch(card -> Objects.equals(map(card).get("id"), map(drawn).get("id"))));
        assertEquals(deck.size() - 1, list(g(result).get("deck")).size());
        assertHidden(g(result).get("deck"));
        assertHidden(map(list(g(result).get("players")).get(1)).get("hand"));
        assertEquals(before + 1, list(map(list(map(storedState().get("G")).get("players")).get(0)).get("hand")).size());
    }

    @Test void rejectedMovesCannotLeakRawPendingOrResponsePayloads() {
        Map<String, Object> state = storedState();
        map(state.get("G")).put("pending", Map.of("kind", "private_future_effect", "cards", List.of("secret-card")));
        map(state.get("G")).put("response", Map.of("kind", "private_future_response", "cards", List.of("secret-card")));
        save(state);
        Map<String, Object> result = service.applyMove(matchId, "0", hostCredential, "unknown", List.of());
        assertEquals(false, result.get("ok"));
        assertFalse(JsonUtils.stringify(result).contains("secret-card"));
    }

    @Test void arnoRevealsOnlySelectedHandOnlyWhileItsChoiceIsActive() {
        Map<String, Object> state = storedState();
        Map<String, Object> original = map(state.get("G"));
        original.put("pending", Map.of("kind", "persona_17_pick_persona_from_hand", "playerId", "0", "targetId", "1"));
        original.put("futureSecret", "not-public");
        String before = JsonUtils.stringify(state);
        Map<String, Object> view = map(MatchClientView.state(state, "0").get("G"));
        assertEquals(map(list(original.get("players")).get(1)).get("hand"), map(list(view.get("players")).get(1)).get("hand"));
        assertHidden(map(list(view.get("players")).get(2)).get("hand"));
        assertHidden(map(list(map(MatchClientView.state(state, "2").get("G")).get("players")).get(1)).get("hand"));
        assertHidden(map(list(map(MatchClientView.state(state, null).get("G")).get("players")).get(1)).get("hand"));
        assertFalse(view.containsKey("futureSecret"));
        assertEquals(before, JsonUtils.stringify(state), "Projection must not mutate server state");
        original.put("pending", null);
        assertHidden(map(list(map(MatchClientView.state(state, "0").get("G")).get("players")).get(1)).get("hand"));
    }

    @Test void historicalTournamentSeatsAreSanitizedOnRead() {
        // Old result_json records can contain the credentials that were formerly stored there.
        jdbc.update("INSERT INTO tournaments(id, name, type, status, table_size, created_at, config_json) VALUES ('t', 'Test', 'single_elim', 'open', 2, 1, '{}')");
        jdbc.update("INSERT INTO tournament_rounds(id, tournament_id, round_index, status, created_at) VALUES (1, 't', 1, 'open', 1)");
        String oldResult = JsonUtils.stringify(Map.of("seats", List.of(Map.of("id", "0", "name", "Alice",
            "credentials", hostCredential, "data", Map.of("playerId", "account0", "email", "alice@example.test")))));
        jdbc.update("INSERT INTO tournament_tables(id, tournament_id, round_id, table_index, status, result_json) VALUES (1, 't', 1, 0, 'finished', ?)", oldResult);
        for (Object response : List.of(repository.tournamentTablesList("t", 1), repository.tournamentBracketGet("t"))) {
            String json = JsonUtils.stringify(response);
            assertFalse(json.contains(hostCredential));
            assertFalse(json.contains("@example.test"));
            assertTrue(json.contains("account0"));
        }
    }

    Map<String, Object> storedState() {
        return JsonUtils.parseMap(jdbc.queryForObject("SELECT state_json FROM live_matches WHERE match_id = ?", String.class, matchId));
    }
    void save(Map<String, Object> state) { jdbc.update("UPDATE live_matches SET state_json = ? WHERE match_id = ?", JsonUtils.stringify(state), matchId); }
    static Map<String, Object> g(Map<String, Object> response) { return map(map(response.get("state")).get("G")); }
    static void assertHidden(Object cards) {
        assertFalse(list(cards).isEmpty());
        for (Object card : list(cards)) assertEquals(Map.of("hidden", true), card);
    }
    @SuppressWarnings("unchecked") static Map<String, Object> map(Object value) { return (Map<String, Object>) value; }
    static List<?> list(Object value) { return (List<?>) value; }
}
