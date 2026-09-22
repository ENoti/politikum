package com.politikum.controller;

import com.politikum.service.LiveMatchService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

/** Available only in the disposable Playwright backend, never in production. */
@RestController
@RequestMapping("/internal/e2e")
@ConditionalOnProperty(name = "politikum.e2e.fixture.enabled", havingValue = "true")
public final class E2eFixtureController {
    private final LiveMatchService matches;
    private final String token;

    public E2eFixtureController(LiveMatchService matches,
                                @Value("${politikum.e2e.fixture-token:}") String token) {
        this.matches = matches;
        this.token = token;
    }

    @PostMapping("/matches/{matchId}/state")
    public ResponseEntity<?> replace(@PathVariable String matchId,
                                     @RequestHeader(value = "X-Politikum-E2E-Token", required = false) String supplied,
                                     @RequestBody Map<String, Object> state) {
        if (token.isBlank() || !token.equals(supplied)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("ok", false));
        }
        if (!matches.replaceStateForE2e(matchId, state)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("ok", false, "error", "not_found"));
        }
        return ResponseEntity.ok(Map.of("ok", true));
    }
}
