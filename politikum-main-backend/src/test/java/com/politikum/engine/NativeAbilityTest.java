package com.politikum.engine;

import com.politikum.util.JsonUtils;
import org.graalvm.polyglot.*;
import org.graalvm.polyglot.proxy.ProxyExecutable;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import static org.junit.jupiter.api.Assertions.*;

class NativeAbilityTest {
    @Test void abilitiesAndChoicesMatchLegacy() throws Exception {
        try (Context guest = Context.newBuilder("js").build()) {
            guest.getBindings("js").putMember("__politikumCatalogJson", new CardCatalog().json());
            var scoring = new ScoringBridge();
            guest.getBindings("js").putMember("__politikumNativeScoring", (ProxyExecutable) args -> scoring.execute(args[0].asString(), args[1].asString()));
            GraalTurnBridge.install(guest, Clock.systemUTC());
            try (var in = new ClassPathResource("engine/politikum-engine-bridge.js").getInputStream()) {
                guest.eval("js", new String(in.readAllBytes(), StandardCharsets.UTF_8));
            }
            String actual;
            try (var in = new ClassPathResource("engine/ability-scenarios.js").getInputStream()) {
                actual = guest.eval("js", new String(in.readAllBytes(), StandardCharsets.UTF_8)).asString();
            }
            try (var in = new ClassPathResource("engine/ability-legacy.json").getInputStream()) {
                assertEquals(JsonUtils.mapper().readTree(in), JsonUtils.mapper().readTree(actual));
            }
        }
    }
}
