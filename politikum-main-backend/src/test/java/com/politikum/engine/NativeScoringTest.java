package com.politikum.engine;

import com.fasterxml.jackson.core.type.TypeReference;
import com.politikum.service.PolitikumEngine;
import com.politikum.util.JsonUtils;
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.proxy.ProxyExecutable;
import org.junit.jupiter.api.*;
import org.springframework.core.io.ClassPathResource;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static com.politikum.engine.GameState.*;
import static org.junit.jupiter.api.Assertions.*;

class NativeScoringTest {
    static List<Map<String, Object>> cases;
    static Context guest;
    @BeforeAll static void setup() throws Exception {
        try (var in = new ClassPathResource("engine/scoring-legacy.json").getInputStream()) {
            cases = JsonUtils.mapper().readValue(in, new TypeReference<>() {});
        }
        guest = Context.newBuilder("js").option("js.ecmascript-version", "2023").build();
        guest.getBindings("js").putMember("__politikumCatalogJson", new CardCatalog().json());
        var bridge = new ScoringBridge();
        guest.getBindings("js").putMember("__politikumNativeScoring", (ProxyExecutable) args -> bridge.execute(args[0].asString(), args[1].asString()));
        GraalTurnBridge.install(guest, java.time.Clock.systemUTC());
        try (var in = new ClassPathResource("engine/politikum-engine-bridge.js").getInputStream()) {
            guest.eval("js", new String(in.readAllBytes(), StandardCharsets.UTF_8));
        }
    }
    @AfterAll static void closeGuest() { if (guest != null) guest.close(); }

    @Test void nativeRulesMatchAll45LegacyCases() throws Exception {
        var rules = new JavaScoringRules();
        for (var test : cases) {
            Map<String, Object> g = JsonUtils.parseMap(JsonUtils.stringify(test.get("G")));
            Map<String, Object> card = map(GameState.<Object>list(map(GameState.<Object>list(g.get("players")).get(0)).get("coalition")).get(0));
            Object score = null;
            switch ((String) test.get("operation")) {
                case "recalculate" -> rules.recalculate(g);
                case "simpleTokens" -> rules.applySimpleTokens(card, JavaScoringRules.number(test.get("delta")));
                case "tokens" -> rules.applyTokens(g, card, JavaScoringRules.number(test.get("delta")), truthy(test.get("mirrored")));
                case "personaDiscarded" -> rules.personaDiscarded(g);
                case "score" -> score = JavaScoringRules.numeric(rules.scorePlayer(map(GameState.<Object>list(g.get("players")).get(0))));
                default -> fail("Unexpected fixture operation");
            }
            assertJson(test.get("expected"), object("G", g, "score", score), test);
        }
    }

    @Test void guestCallbacksMatchLegacyAndPreserveCardReferences() throws Exception {
        for (var test : cases) {
            guest.getBindings("js").putMember("probeJson", JsonUtils.stringify(test));
            String actual = guest.eval("js", """
                (() => {
                  const r = JSON.parse(probeJson), G = r.G;
                  const card = G.players[0].coalition[0];
                  const player = G.players[0], coalition = player.coalition;
                  let score = null;
                  switch (r.operation) {
                    case 'recalculate': recalcPassives(G); break;
                    case 'simpleTokens': applyTokenDelta(card, r.delta); break;
                    case 'tokens': applyTokenDelta2(G, card, r.delta, !!r.mirrored); break;
                    case 'personaDiscarded': persona44OnPersonaDiscarded(G); break;
                    case 'score': score = scorePlayer(player); break;
                  }
                  if (player !== G.players[0] || coalition !== player.coalition || card !== coalition[0]) throw Error('replaced live reference');
                  return JSON.stringify({G, score});
                })()
                """).asString();
            assertJson(test.get("expected"), JsonUtils.parseMap(actual), test);
        }
    }

    @Test void realMoveInvokesNativeMirrorAndPersistsTheUpdatedTarget() throws Exception {
        var engine = new PolitikumEngine();
        try {
            var state = engine.createMatchState(2);
            state = map(engine.applyMove(state, "0", "addBot", List.of()).get("state"));
            state = map(engine.applyMove(state, "0", "startGame", List.of()).get("state"));
            var g = map(state.get("G"));
            var definitions = new CardCatalog().materialize("persona");
            var target = definitions.stream().filter(c -> "persona_22".equals(c.get("id"))).findFirst().orElseThrow();
            var mirror = definitions.stream().filter(c -> "persona_15".equals(c.get("id"))).findFirst().orElseThrow();
            map(GameState.<Object>list(g.get("players")).get(1)).put("coalition", new ArrayList<>(List.of(target, mirror)));
            g.put("pending", object("kind", "persona_13_pick_target", "playerId", "0", "attackerId", "1"));
            String original = JsonUtils.stringify(state);
            var result = engine.applyMove(state, "0", "persona13PickTarget", List.of("1", "persona_22"));
            assertEquals(true, result.get("ok"));
            assertEquals(original, JsonUtils.stringify(state));
            var next = map(map(result.get("state")).get("G"));
            List<Map<String, Object>> coalition = list(map(GameState.<Object>list(next.get("players")).get(1)).get("coalition"));
            assertEquals(-1, number(coalition.get(0).get("vpDelta")));
            assertEquals(-2, number(coalition.get(1).get("vpDelta")));
            assertNull(next.get("pending"));
        } finally { engine.close(); }
    }
    static void assertJson(Object expected, Object actual, Map<String, Object> test) throws Exception {
        assertEquals(JsonUtils.mapper().readTree(JsonUtils.stringify(expected)), JsonUtils.mapper().readTree(JsonUtils.stringify(actual)),
            "Legacy case " + cases.indexOf(test) + " / " + test.get("operation"));
    }
}
