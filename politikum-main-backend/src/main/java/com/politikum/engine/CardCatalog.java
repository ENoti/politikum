package com.politikum.engine;

import com.fasterxml.jackson.core.type.TypeReference;
import com.politikum.util.JsonUtils;
import org.springframework.core.io.ClassPathResource;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static com.politikum.engine.GameState.object;

/** Card definitions shared by the Java engine and test-only legacy comparisons. */
public final class CardCatalog {
    public record Definition(String id, String type, int vp, Integer count, List<String> tags,
                             String text, String timing, String abilityKey, Map<String, Object> params) {}
    private final String json;
    private final List<Definition> definitions;
    private final List<String> botNames;
    public CardCatalog() throws IOException {
        try (var in = new ClassPathResource("engine/cards.json").getInputStream()) {
            json = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
        definitions = List.copyOf(JsonUtils.mapper().readValue(json, new TypeReference<List<Definition>>() {}));
        try (var in = new ClassPathResource("engine/bot-names.json").getInputStream()) {
            botNames = List.copyOf(JsonUtils.mapper().readValue(in, new TypeReference<List<String>>() {}));
        }
        Set<String> ids = new HashSet<>();
        for (Definition d : definitions) {
            if (!ids.add(d.id()) || !Set.of("persona", "action", "event").contains(d.type()) || (d.count() != null && d.count() < 1)) {
                throw new IllegalArgumentException("Invalid card definition: " + d.id());
            }
        }
    }
    public String json() { return json; }
    public List<String> botNames() { return botNames; }
    public List<Map<String, Object>> materialize(String type) {
        List<Map<String, Object>> cards = new ArrayList<>();
        for (Definition d : definitions) {
            if (!type.equals(d.type())) continue;
            int count = d.count() == null ? 1 : d.count();
            for (int i = 1; i <= count; i++) {
                Map<String, Object> c = object("id", count == 1 ? d.id() : d.id() + "#" + i,
                    "type", d.type(), "img", "/cards/" + d.id() + ".webp", "name", d.text() == null || d.text().isEmpty() ? d.id() : d.text(),
                    "baseVp", d.vp(), "vp", d.vp(), "vpDelta", 0, "passiveVpDelta", 0);
                if (d.tags() != null) c.put("tags", new ArrayList<>(d.tags()));
                if (d.abilityKey() != null) c.put("abilityKey", d.abilityKey());
                if (d.params() != null) c.put("params", JsonUtils.mapper().convertValue(d.params(), Map.class));
                cards.add(c);
            }
        }
        return cards;
    }
}
