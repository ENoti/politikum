package com.politikum.util;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.Map;

public final class HttpUtils {
    private HttpUtils() {}

    public static String bearerToken(HttpServletRequest request) {
        String auth = String.valueOf(request.getHeader("Authorization"));
        if (auth == null) return "";
        String lower = auth.toLowerCase(Locale.ROOT);
        if (!lower.startsWith("bearer ")) return "";
        return auth.substring(7).trim();
    }

    public static void requireAdmin(HttpServletRequest request, String adminToken) {
        String header = String.valueOf(request.getHeader("X-Admin-Token"));
        if (adminToken == null || adminToken.isBlank() || !adminToken.equals(header)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }
    }

    public static String str(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    public static int intParam(String value, int defaultValue, int min, int max) {
        try {
            int n = Integer.parseInt(value == null ? String.valueOf(defaultValue) : value);
            return Math.max(min, Math.min(max, n));
        } catch (Exception e) {
            return defaultValue;
        }
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> map(Object value) {
        return value instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
    }
}
