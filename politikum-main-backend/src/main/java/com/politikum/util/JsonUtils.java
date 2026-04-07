package com.politikum.util;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Collections;
import java.util.List;
import java.util.Map;

public final class JsonUtils {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};
    private static final TypeReference<List<Map<String, Object>>> LIST_MAP_TYPE = new TypeReference<>() {};

    private JsonUtils() {}

    public static String stringify(Object value) {
        try {
            return value == null ? null : MAPPER.writeValueAsString(value);
        } catch (Exception e) {
            return null;
        }
    }

    public static Map<String, Object> parseMap(String json) {
        try {
            if (json == null || json.isBlank()) return Collections.emptyMap();
            return MAPPER.readValue(json, MAP_TYPE);
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }

    public static List<Map<String, Object>> parseListMap(String json) {
        try {
            if (json == null || json.isBlank()) return Collections.emptyList();
            return MAPPER.readValue(json, LIST_MAP_TYPE);
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    public static ObjectMapper mapper() {
        return MAPPER;
    }
}
