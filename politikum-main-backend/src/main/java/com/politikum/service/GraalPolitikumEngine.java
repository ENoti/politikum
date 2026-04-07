
package com.politikum.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Source;
import org.graalvm.polyglot.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@Service
public class GraalPolitikumEngine {
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final Context context;
    private final Value bridge;

    public GraalPolitikumEngine() throws Exception {
        String script;
        try (InputStream in = new ClassPathResource("engine/politikum-engine-bridge.js").getInputStream()) {
            script = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
        this.context = Context.newBuilder("js")
            .allowExperimentalOptions(true)
            .option("js.ecmascript-version", "2023")
            .build();
        this.context.eval(Source.newBuilder("js", script, "politikum-engine-bridge.js").buildLiteral());
        this.bridge = this.context.getBindings("js").getMember("PolitikumBridge");
        if (this.bridge == null) throw new IllegalStateException("PolitikumBridge not initialized");
    }

    public synchronized Map<String, Object> createMatchState(int numPlayers) {
        try {
            String json = bridge.getMember("createMatchJson").execute(numPlayers).asString();
            return MAPPER.readValue(json, MAP_TYPE);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to create Politikum state", e);
        }
    }

    public synchronized Map<String, Object> applyMove(Map<String, Object> state,
                                                      String playerId,
                                                      String moveName,
                                                      List<Object> args) {
        try {
            String stateJson = MAPPER.writeValueAsString(state);
            String argsJson = MAPPER.writeValueAsString(args == null ? List.of() : args);
            String json = bridge.getMember("applyMoveJson").execute(stateJson, playerId, moveName, argsJson).asString();
            return MAPPER.readValue(json, MAP_TYPE);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to apply Politikum move " + moveName, e);
        }
    }
}
