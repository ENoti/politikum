package com.politikum;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.annotation.DirtiesContext;

import java.nio.file.Path;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class BackendHttpTest {
    @TempDir static Path data;
    @Autowired TestRestTemplate http;

    @DynamicPropertySource
    static void isolatedConfiguration(DynamicPropertyRegistry properties) {
        properties.add("politikum.admin-token", () -> "integration-test-only-token");
        properties.add("politikum.db.path", () -> data.resolve("test.sqlite").toString());
        properties.add("politikum.news.path", () -> data.resolve("NEWS.md").toString());
        properties.add("politikum.profile-img-dir", () -> data.resolve("profiles").toString());
    }

    @Test
    void applicationStartsAndServesPublicApi() {
        JsonNode health = get("/games/politikum");
        assertThat(health.path("ok").asBoolean()).isTrue();
        assertThat(health.path("backend").asText()).isEqualTo("java");
        for (String endpoint : new String[]{"/public/news", "/public/lobby_chat", "/public/matches_open"}) {
            assertThat(get(endpoint).path("ok").asBoolean()).as(endpoint).isTrue();
        }
        assertThat(http.getForEntity("/admin/leaderboard", JsonNode.class).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(http.getForEntity("/games/politikum/does-not-exist", JsonNode.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void createJoinAndReadStateOverRealHttp() {
        JsonNode created = post("/games/politikum/create", Map.of("numPlayers", 3,
                "setupData", Map.of("hostName", "HTTP test", "lobbyTitle", "Isolated test")));
        String id = created.path("matchID").asText();
        assertThat(id).isNotBlank();
        String base = "/games/politikum/" + id;
        assertThat(get(base).path("players").size()).isEqualTo(3);
        String credentials = post(base + "/join", Map.of("playerID", "0", "playerName", "HTTP test"))
                .path("playerCredentials").asText();
        assertThat(credentials).isNotBlank();
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Player-ID", "0");
        headers.set("X-Player-Credentials", credentials);
        var state = http.exchange(base + "/state", HttpMethod.GET, new HttpEntity<>(headers), JsonNode.class);
        assertThat(state.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(state.getHeaders().getCacheControl()).contains("no-store");
        assertThat(state.getBody().path("state").path("G").isObject()).isTrue();
        assertThat(state.getBody().path("state").path("ctx").isObject()).isTrue();
        headers.set("X-Player-Credentials", "invalid");
        assertThat(http.exchange(base + "/state", HttpMethod.GET, new HttpEntity<>(headers), JsonNode.class)
                .getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    private JsonNode get(String path) {
        var response = http.getForEntity(path, JsonNode.class);
        assertThat(response.getStatusCode()).as(path).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        return response.getBody();
    }

    private JsonNode post(String path, Object body) {
        var response = http.postForEntity(path, body, JsonNode.class);
        assertThat(response.getStatusCode()).as(path).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        return response.getBody();
    }
}
