package com.politikum.engine;

import com.politikum.util.JsonUtils;
import java.util.*;

/** Mutable working copy; keeps unknown card fields intact during incremental migration. */
public final class GameState {
    private final Map<String, Object> value;
    public GameState(Map<String, Object> source) {
        value = JsonUtils.mapper().convertValue(source, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
        if (!(value.get("G") instanceof Map) || !(value.get("ctx") instanceof Map)) throw new IllegalArgumentException("bad_state");
    }
    public Map<String, Object> value() { return value; }
    public Map<String, Object> game() { return map(value.get("G")); }
    public Map<String, Object> context() { return map(value.get("ctx")); }
    public String phase() { return String.valueOf(context().get("phase")); }
    public long turn() { return number(context().get("turn")); }
    public boolean finished() { return truthy(context().get("gameover")) || truthy(game().get("gameOver")); }
    public List<Map<String, Object>> players() { return list(game().get("players")); }
    public Map<String, Object> player(String id) { return players().stream().filter(p -> id.equals(String.valueOf(p.get("id")))).findFirst().orElse(null); }
    public void advanceVersion() { value.put("_stateID", number(value.get("_stateID")) + 1); }
    public static long number(Object value) { return value instanceof Number n ? n.longValue() : 0; }
    public static boolean truthy(Object value) { return value != null && !Boolean.FALSE.equals(value) && !"".equals(value) && (!(value instanceof Number n) || n.doubleValue() != 0); }
    @SuppressWarnings("unchecked") public static Map<String, Object> map(Object value) { return value instanceof Map ? (Map<String, Object>) value : new LinkedHashMap<>(); }
    @SuppressWarnings("unchecked") public static <T> List<T> list(Object value) { return value instanceof List ? (List<T>) value : new ArrayList<>(); }
    public static Map<String, Object> object(Object... pairs) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) result.put((String) pairs[i], pairs[i + 1]);
        return result;
    }
}
