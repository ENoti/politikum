package com.politikum.engine;

import com.politikum.util.JsonUtils;
import org.graalvm.polyglot.*;
import org.graalvm.polyglot.proxy.ProxyExecutable;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import java.nio.charset.StandardCharsets;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;

class NativeEventTest {
    @Test void eventsMatchLegacy() throws Exception {
        try(Context guest=Context.newBuilder("js").build()) {
            guest.getBindings("js").putMember("__politikumCatalogJson",new CardCatalog().json());
            var scoring=new ScoringBridge();
            guest.getBindings("js").putMember("__politikumNativeScoring",(ProxyExecutable) a->scoring.execute(a[0].asString(),a[1].asString()));
            GraalTurnBridge.install(guest,Clock.fixed(Instant.ofEpochMilli(100000),ZoneOffset.UTC));
            guest.eval("js",read("engine/politikum-engine-bridge.js"));
            String actual=guest.eval("js",read("engine/event-scenarios.js")).asString();
            var expected=JsonUtils.mapper().readTree(read("engine/event-legacy.json"));
            var result=JsonUtils.mapper().readTree(actual);
            assertEquals(expected.size(),result.size());
            for(int i=0;i<expected.size();i++)assertEquals(expected.get(i),LegacyParity.normalize(result.get(i)),expected.get(i).path("name").asText());
            int repeatedEvent = -1;
            for (int i = 0; i < result.size(); i++) {
                if (result.get(i).path("name").asText().equals("entry event_11 event next")) repeatedEvent = i;
            }
            assertTrue(repeatedEvent >= 0);
            assertEquals("0", result.get(repeatedEvent).path("state").path("G").path("lastEventOwnerId").asText());
            assertTrue(result.get(repeatedEvent).path("state").path("G").path("lastEventSequence").asInt() >= 1);
        }
    }
    private static String read(String name) throws Exception {
        try(var in=new ClassPathResource(name).getInputStream()) { return new String(in.readAllBytes(),StandardCharsets.UTF_8); }
    }
}
