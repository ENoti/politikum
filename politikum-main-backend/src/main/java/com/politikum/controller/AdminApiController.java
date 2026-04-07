package com.politikum.controller;

import com.politikum.service.LiveMatchService;
import com.politikum.service.PolitikumRepository;
import com.politikum.util.HttpUtils;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class AdminApiController {
    private final PolitikumRepository repository;
    private final LiveMatchService liveMatchService;
    private final String adminToken;

    public AdminApiController(PolitikumRepository repository,
                              LiveMatchService liveMatchService,
                              @Value("${politikum.admin-token:12qw12}") String adminToken) {
        this.repository = repository;
        this.liveMatchService = liveMatchService;
        this.adminToken = adminToken;
    }

    @GetMapping("/admin/bugreports")
    public Map<String, Object> bugreports(HttpServletRequest request,
                                          @RequestParam(defaultValue = "50") int limit,
                                          @RequestParam(defaultValue = "0") int offset,
                                          @RequestParam(required = false) String status) {
        HttpUtils.requireAdmin(request, adminToken);
        int lim = Math.max(1, Math.min(200, limit));
        int off = Math.max(0, offset);
        return repository.bugreportsList(lim, off, status);
    }

    @PostMapping("/admin/bugreport/{id}/status")
    public ResponseEntity<?> bugreportStatus(HttpServletRequest request, @PathVariable long id, @RequestBody Map<String, Object> body) {
        HttpUtils.requireAdmin(request, adminToken);
        return ResponseEntity.ok(repository.bugreportSetStatus(id, String.valueOf(body.getOrDefault("status", ""))));
    }

    @PostMapping("/admin/lobby_chat/disable")
    public Map<String, Object> disableChat(HttpServletRequest request) {
        HttpUtils.requireAdmin(request, adminToken);
        return repository.lobbyChatSetEnabled(false);
    }

    @PostMapping("/admin/lobby_chat/enable")
    public Map<String, Object> enableChat(HttpServletRequest request) {
        HttpUtils.requireAdmin(request, adminToken);
        return repository.lobbyChatSetEnabled(true);
    }

    @PostMapping("/admin/lobby_chat/clear")
    public Map<String, Object> clearChat(HttpServletRequest request) {
        HttpUtils.requireAdmin(request, adminToken);
        return repository.lobbyChatClear();
    }

    @PostMapping("/admin/players/merge")
    public ResponseEntity<?> mergePlayers(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        HttpUtils.requireAdmin(request, adminToken);
        try {
            return ResponseEntity.ok(repository.adminMergePlayerIds(
                String.valueOf(body.getOrDefault("fromPlayerId", "")),
                String.valueOf(body.getOrDefault("intoPlayerId", ""))
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("ok", false, "error", e.getMessage()));
        }
    }

    @PostMapping("/admin/tournament/create")
    public ResponseEntity<?> createTournament(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        HttpUtils.requireAdmin(request, adminToken);
        return ResponseEntity.ok(repository.tournamentCreate(body));
    }

    @PostMapping("/admin/tournament/{id}/{action}")
    public ResponseEntity<?> tournamentAction(HttpServletRequest request, @PathVariable String id, @PathVariable String action) {
        HttpUtils.requireAdmin(request, adminToken);
        if (List.of("open_registration", "close_registration", "cancel").contains(action)) {
            String status = "open_registration".equals(action) ? "registering" : ("close_registration".equals(action) ? "running" : "canceled");
            Map<String, Object> res = repository.tournamentSetStatus(id, status);
            if (!(Boolean) res.getOrDefault("ok", false)) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(res);
            return ResponseEntity.ok(res);
        }
        if ("generate_round1".equals(action)) {
            Map<String, Object> res = repository.tournamentGenerateRound1(id);
            if (!(Boolean) res.getOrDefault("ok", false)) return ResponseEntity.status(HttpStatus.CONFLICT).body(res);
            return ResponseEntity.ok(res);
        }
        if ("generate_next_round".equals(action)) {
            Map<String, Object> res = repository.tournamentGenerateNextRound(id);
            if (!(Boolean) res.getOrDefault("ok", false)) return ResponseEntity.status(HttpStatus.CONFLICT).body(res);
            return ResponseEntity.ok(res);
        }
        return ResponseEntity.badRequest().body(Map.of("ok", false, "error", "unsupported_action"));
    }

    @PostMapping("/admin/tournament/{tournamentId}/table/{tableId}/set_winner")
    public ResponseEntity<?> setWinner(HttpServletRequest request,
                                       @PathVariable String tournamentId,
                                       @PathVariable long tableId,
                                       @RequestBody Map<String, Object> body) {
        HttpUtils.requireAdmin(request, adminToken);
        Map<String, Object> table = repository.tournamentTableGet(tournamentId, tableId);
        if (table == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("ok", false, "error", "Not found"));
        int seatIndex;
        try {
            seatIndex = Integer.parseInt(String.valueOf(body.getOrDefault("seat", body.getOrDefault("seatIndex", "-1"))));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("ok", false, "error", "bad_seat"));
        }
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> seats = (List<Map<String, Object>>) table.getOrDefault("seats", List.of());
        Map<String, Object> seat = seats.stream().filter(s -> Integer.parseInt(String.valueOf(s.get("seat"))) == seatIndex).findFirst().orElse(null);
        if (seat == null || seat.get("playerId") == null) return ResponseEntity.badRequest().body(Map.of("ok", false, "error", "seat_missing_player"));
        java.util.Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("matchId", table.get("matchId"));
        result.put("winnerPlayerId", seat.get("playerId"));
        result.put("winnerName", seat.get("name"));
        result.put("seats", seats);
        result.put("manualAdminOverride", true);
        result.put("finishedAt", repository.nowMs());
        return ResponseEntity.ok(repository.tournamentTableSetResult(tournamentId, tableId, String.valueOf(seat.get("playerId")), result));
    }

    @GetMapping("/admin/summary")
    public Map<String, Object> summary(HttpServletRequest request) {
        HttpUtils.requireAdmin(request, adminToken);
        return liveMatchService.getAdminSummary();
    }

    @PostMapping("/admin/sync")
    public Map<String, Object> sync(HttpServletRequest request) {
        HttpUtils.requireAdmin(request, adminToken);
        return liveMatchService.getAdminSummary();
    }

    @GetMapping("/admin/games")
    public Map<String, Object> games(HttpServletRequest request,
                                     @RequestParam(defaultValue = "50") int limit,
                                     @RequestParam(defaultValue = "0") int offset) {
        HttpUtils.requireAdmin(request, adminToken);
        return repository.getAdminGames(limit, offset);
    }

    @GetMapping("/admin/matches")
    public Map<String, Object> matches(HttpServletRequest request,
                                       @RequestParam(defaultValue = "20") int limit) {
        HttpUtils.requireAdmin(request, adminToken);
        return liveMatchService.getAdminMatches(limit);
    }

    @GetMapping("/admin/match/{matchId}/log")
    public ResponseEntity<?> matchLog(HttpServletRequest request,
                                      @PathVariable String matchId,
                                      @RequestParam(defaultValue = "200") int limit) {
        HttpUtils.requireAdmin(request, adminToken);
        return ResponseEntity.ok(liveMatchService.getAdminMatchLog(matchId, limit));
    }

    @PostMapping("/admin/match/{matchId}/kill")
    public ResponseEntity<?> killMatch(HttpServletRequest request, @PathVariable String matchId) {
        HttpUtils.requireAdmin(request, adminToken);
        return ResponseEntity.ok(liveMatchService.killMatch(matchId));
    }

    @PostMapping("/admin/tournament/{tournamentId}/table/{tableId}/create_match")
    public ResponseEntity<?> createTournamentMatch(HttpServletRequest request,
                                                   @PathVariable String tournamentId,
                                                   @PathVariable long tableId) {
        HttpUtils.requireAdmin(request, adminToken);
        Map<String, Object> res = liveMatchService.createTournamentMatch(tournamentId, tableId, null, false);
        if (!(Boolean) res.getOrDefault("ok", false)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(res);
        }
        return ResponseEntity.ok(res);
    }

}
