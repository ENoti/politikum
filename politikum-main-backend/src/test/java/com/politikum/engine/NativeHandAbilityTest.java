package com.politikum.engine;

import com.politikum.util.JsonUtils;
import org.graalvm.polyglot.*;
import org.graalvm.polyglot.proxy.ProxyExecutable;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import static org.junit.jupiter.api.Assertions.*;

class NativeHandAbilityTest {
    @Test void handAbilitiesMatchLegacy() throws Exception {
        try (Context guest = Context.newBuilder("js").build()) {
            guest.getBindings("js").putMember("__politikumCatalogJson", new CardCatalog().json());
            var scoring = new ScoringBridge();
            guest.getBindings("js").putMember("__politikumNativeScoring", (ProxyExecutable) args -> scoring.execute(args[0].asString(), args[1].asString()));
            GraalTurnBridge.install(guest, Clock.fixed(java.time.Instant.ofEpochMilli(100000), java.time.ZoneOffset.UTC));
            try (var in = new ClassPathResource("engine/politikum-engine-bridge.js").getInputStream()) {
                guest.eval("js", new String(in.readAllBytes(), StandardCharsets.UTF_8));
            }
            String actual;
            try (var in = new ClassPathResource("engine/hand-ability-scenarios.js").getInputStream()) {
                actual = guest.eval("js", new String(in.readAllBytes(), StandardCharsets.UTF_8)).asString();
            }
            try (var in = new ClassPathResource("engine/hand-ability-legacy.json").getInputStream()) {
                var expected = JsonUtils.mapper().readTree(in);
                var result = JsonUtils.mapper().readTree(actual);
                assertEquals(expected.size(), result.size());
                for (int i = 0; i < expected.size(); i++) {
                    String name=expected.get(i).path("name").asText();
                    if(name.equals("45 emptyOpponent")) {
                        assertEquals("move_exception",expected.get(i).path("result").path("error").asText());
                        assertEquals("invalid_move",result.get(i).path("result").path("error").asText());
                        assertFalse(result.get(i).path("result").path("ok").asBoolean());
                        assertEquals(expected.get(i).path("result").path("state"),LegacyParity.normalize(result.get(i).path("result").path("state")));
                    } else assertEquals(expected.get(i), LegacyParity.normalize(result.get(i)), name);
                }
            }
        }
    }
}
