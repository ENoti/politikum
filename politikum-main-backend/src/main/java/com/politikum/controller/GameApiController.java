
package com.politikum.controller;

import com.politikum.service.LiveMatchService;
import com.politikum.service.PolitikumRepository;
import com.politikum.util.HttpUtils;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@RestController
public class GameApiController {
    private final LiveMatchService liveMatchService;
    private final PolitikumRepository repository;

    public GameApiController(LiveMatchService liveMatchService, PolitikumRepository repository) {
        this.liveMatchService = liveMatchService;
        this.repository = repository;
    }

    @GetMapping("/games/politikum")
    public Map<String, Object> health() {
        return Map.of("ok", true, "backend", "java", "liveMatches", true);
    }

    @PostMapping("/games/politikum/create")
    public ResponseEntity<?> create(HttpServletRequest request, @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> session = repository.authGetSession(HttpUtils.bearerToken(request));
        int numPlayers = 5;
        String hostName = null;
        String lobbyTitle = null;
        if (body != null) {
            try { numPlayers = Integer.parseInt(String.valueOf(body.getOrDefault("numPlayers", "5"))); } catch (Exception ignored) {}
            Object setupData = body.get("setupData");
            if (setupData instanceof Map<?, ?> map) {
                Object hn = map.get("hostName");
                if (hn != null) hostName = String.valueOf(hn);
                Object lt = map.get("lobbyTitle");
                if (lt != null) lobbyTitle = String.valueOf(lt);
            }
        }
        return ResponseEntity.ok(liveMatchService.createMatch(numPlayers, session == null ? null : String.valueOf(session.get("playerId")), hostName, lobbyTitle));
    }

    @GetMapping("/games/politikum/{matchId}")
    public ResponseEntity<?> getMatch(@PathVariable String matchId) {
        Map<String, Object> match = liveMatchService.getMatch(matchId);
        if (match == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("ok", false, "error", "not_found"));
        return ResponseEntity.ok(match);
    }

    @GetMapping("/games/politikum/{matchId}/state")
    public ResponseEntity<?> getState(@PathVariable String matchId) {
        Map<String, Object> state = liveMatchService.getState(matchId);
        if (state == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("ok", false, "error", "not_found"));
        return ResponseEntity.ok(state);
    }

    @PostMapping("/games/politikum/{matchId}/join")
    public ResponseEntity<?> join(HttpServletRequest request,
                                  @PathVariable String matchId,
                                  @RequestBody Map<String, Object> body) {
        try {
            Map<String, Object> session = repository.authGetSession(HttpUtils.bearerToken(request));
            Map<String, Object> res = liveMatchService.joinMatch(
                matchId,
                String.valueOf(body.getOrDefault("playerID", body.getOrDefault("playerId", ""))),
                String.valueOf(body.getOrDefault("playerName", body.getOrDefault("name", ""))),
                session == null ? null : String.valueOf(session.get("playerId")),
                session == null ? null : (session.get("email") == null ? null : String.valueOf(session.get("email")))
            );
            if (!(Boolean) res.getOrDefault("ok", false)) return ResponseEntity.status(HttpStatus.CONFLICT).body(res);
            return ResponseEntity.ok(res);
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("ok", false, "error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("ok", false, "error", e.getMessage()));
        }
    }

    @PostMapping("/games/politikum/{matchId}/move/{moveName}")
    public ResponseEntity<?> move(@PathVariable String matchId,
                                  @PathVariable String moveName,
                                  @RequestBody(required = false) Map<String, Object> body) {
        try {
            String playerId = body == null ? "" : String.valueOf(body.getOrDefault("playerID", body.getOrDefault("playerId", "")));
            String credentials = body == null ? "" : String.valueOf(body.getOrDefault("credentials", ""));
            List<Object> args = new ArrayList<>();
            if (body != null && body.get("args") instanceof List<?> list) args.addAll(list);
            Map<String, Object> res = liveMatchService.applyMove(matchId, playerId, credentials, moveName, args);
            if (!(Boolean) res.getOrDefault("ok", false)) return ResponseEntity.status(HttpStatus.CONFLICT).body(res);
            return ResponseEntity.ok(res);
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("ok", false, "error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("ok", false, "error", e.getMessage()));
        }
    }



    @PostMapping("/match/{matchId}/rename_owner")
    public ResponseEntity<?> renameOwner(HttpServletRequest request, @PathVariable String matchId, @RequestBody Map<String, Object> body) {
        Map<String, Object> session = repository.authGetSession(HttpUtils.bearerToken(request));
        if (session == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("ok", false, "error", "Unauthorized"));
        String title = body == null ? null : String.valueOf(body.getOrDefault("lobbyTitle", body.getOrDefault("title", "")));
        Map<String, Object> res = liveMatchService.renameMatchOwner(matchId, String.valueOf(session.get("playerId")), title);
        if (!(Boolean) res.getOrDefault("ok", false)) return ResponseEntity.status(HttpStatus.CONFLICT).body(res);
        return ResponseEntity.ok(res);
    }

    @DeleteMapping("/match/{matchId}/delete_owner")
    public ResponseEntity<?> deleteOwner(HttpServletRequest request, @PathVariable String matchId) {
        Map<String, Object> session = repository.authGetSession(HttpUtils.bearerToken(request));
        if (session == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("ok", false, "error", "Unauthorized"));
        Map<String, Object> res = liveMatchService.deleteMatchOwner(matchId, String.valueOf(session.get("playerId")));
        if (!(Boolean) res.getOrDefault("ok", false)) return ResponseEntity.status(HttpStatus.CONFLICT).body(res);
        return ResponseEntity.ok(res);
    }


    @PostMapping("/games/politikum/{matchId}/surrender")
    public ResponseEntity<?> surrender(@PathVariable String matchId,
                                       @RequestBody(required = false) Map<String, Object> body) {
        try {
            String playerId = body == null ? "" : String.valueOf(body.getOrDefault("playerID", body.getOrDefault("playerId", "")));
            String credentials = body == null ? "" : String.valueOf(body.getOrDefault("credentials", ""));
            Map<String, Object> res = liveMatchService.surrender(matchId, playerId, credentials);
            if (!(Boolean) res.getOrDefault("ok", false)) return ResponseEntity.status(HttpStatus.CONFLICT).body(res);
            return ResponseEntity.ok(res);
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("ok", false, "error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("ok", false, "error", e.getMessage()));
        }
    }

    @PostMapping("/match/{matchId}/kill_owner")
    public ResponseEntity<?> killOwner(HttpServletRequest request, @PathVariable String matchId) {
        Map<String, Object> session = repository.authGetSession(HttpUtils.bearerToken(request));
        if (session == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("ok", false, "error", "Unauthorized"));
        Map<String, Object> res = liveMatchService.killMatchOwner(matchId, String.valueOf(session.get("playerId")));
        if (!(Boolean) res.getOrDefault("ok", false)) return ResponseEntity.status(HttpStatus.CONFLICT).body(res);
        return ResponseEntity.ok(res);
    }
}
