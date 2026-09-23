package com.politikum.engine;

import com.politikum.util.JsonUtils;
import org.graalvm.polyglot.*;
import org.graalvm.polyglot.proxy.ProxyExecutable;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import java.nio.charset.StandardCharsets;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;

class NativeRemainingPersonaTest {
    @Test void remainingPersonasMatchLegacy() throws Exception {
        try (Context guest = Context.newBuilder("js").build()) {
            guest.getBindings("js").putMember("__politikumCatalogJson", new CardCatalog().json());
            var scoring = new ScoringBridge();
            guest.getBindings("js").putMember("__politikumNativeScoring", (ProxyExecutable) a -> scoring.execute(a[0].asString(), a[1].asString()));
            GraalTurnBridge.install(guest, Clock.fixed(Instant.ofEpochMilli(100000), ZoneOffset.UTC));
            guest.eval("js", read("engine/politikum-engine-bridge.js"));
            String actual = guest.eval("js", read("engine/remaining-persona-scenarios.js")).asString();
            var expected=JsonUtils.mapper().readTree(read("engine/remaining-persona-legacy.json"));
            var result=JsonUtils.mapper().readTree(actual);
            assertEquals(expected.size(),result.size());
            for(int i=0;i<expected.size();i++) assertEquals(expected.get(i),LegacyParity.normalize(result.get(i)),expected.get(i).path("name").asText());
            assertEquals(12,guest.eval("js",read("engine/persona3-regressions.js")).asInt());
        }
    }
    private static String read(String path) throws Exception {
        try(var in=new ClassPathResource(path).getInputStream()) { return new String(in.readAllBytes(),StandardCharsets.UTF_8); }
    }
}
