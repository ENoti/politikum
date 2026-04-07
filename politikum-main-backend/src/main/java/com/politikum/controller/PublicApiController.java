package com.politikum.controller;

import com.politikum.service.LiveMatchService;
import com.politikum.service.NewsService;
import com.politikum.service.PolitikumRepository;
import com.politikum.util.HttpUtils;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
public class PublicApiController {
    private final PolitikumRepository repository;
    private final NewsService newsService;
    private final LiveMatchService liveMatchService;
    private final Path profileImgDir;
    private final String adminToken;
    private final ConcurrentHashMap<String, Long> lobbyChatRate = new ConcurrentHashMap<>();

    public PublicApiController(PolitikumRepository repository,
                               NewsService newsService,
                               LiveMatchService liveMatchService,
                               @Value("${politikum.profile-img-dir:var/profile_images}") String profileImgDir,
                               @Value("${politikum.admin-token:12qw12}") String adminToken) throws Exception {
        this.repository = repository;
        this.newsService = newsService;
        this.liveMatchService = liveMatchService;
        this.profileImgDir = Paths.get(profileImgDir).toAbsolutePath();
        this.adminToken = adminToken;
        Files.createDirectories(this.profileImgDir);
    }

    @GetMapping("/public/news")
    public Map<String, Object> news() {
        return Map.of("ok", true, "markdown", newsService.readNews());
    }

    @GetMapping("/public/leaderboard")
    public Map<String, Object> leaderboard(@RequestParam(defaultValue = "10") int limit) {
        int lim = Math.max(1, Math.min(50, limit));
        return repository.getLeaderboard(lim, true);
    }

    @GetMapping("/admin/leaderboard")
    public Map<String, Object> adminLeaderboard(@RequestParam(defaultValue = "20") int limit, HttpServletRequest request) {
        HttpUtils.requireAdmin(request, adminToken);
        int lim = Math.max(1, Math.min(200, limit));
        return repository.getLeaderboard(lim, true);
    }

    @GetMapping("/public/profile/{playerId}")
    public ResponseEntity<?> profile(@PathVariable String playerId) {
        Map<String, Object> profile = repository.getPublicProfile(playerId);
        if (!(Boolean) profile.getOrDefault("ok", false)) {
            return ResponseEntity.badRequest().body(profile);
        }
        return ResponseEntity.ok(profile);
    }

    @GetMapping("/public/profile_image/{playerId}.jpg")
    public ResponseEntity<?> profileImage(@PathVariable String playerId) {
        Path img = profileImgDir.resolve(playerId + ".jpg");
        if (!Files.exists(img)) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("ok", false, "error", "not_found"));
        return ResponseEntity.ok()
            .contentType(MediaType.IMAGE_JPEG)
            .header(HttpHeaders.CACHE_CONTROL, "public, max-age=300")
            .body(new FileSystemResource(img));
    }

    @GetMapping("/public/lobby_chat")
    public Map<String, Object> lobbyChat(@RequestParam(defaultValue = "50") int limit) {
        int lim = Math.max(1, Math.min(200, limit));
        return repository.lobbyChatList(lim);
    }

    @PostMapping("/public/lobby_chat/send")
    public ResponseEntity<?> sendLobbyChat(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        Map<String, Object> session = repository.authGetSession(HttpUtils.bearerToken(request));
        if (session == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("ok", false, "error", "Unauthorized"));
        if (!repository.lobbyChatIsEnabled()) return ResponseEntity.ok(Map.of("ok", false, "error", "disabled"));
        String key = String.valueOf(session.get("playerId"));
        long now = repository.nowMs();
        Long last = lobbyChatRate.get(key);
        if (last != null && (now - last) < 3000) return ResponseEntity.ok(Map.of("ok", false, "error", "rate_limited"));
        lobbyChatRate.put(key, now);
        String text = body.get("text") == null ? "" : String.valueOf(body.get("text"));
        String name = body.get("name") == null ? (body.get("playerName") == null ? null : String.valueOf(body.get("playerName"))) : String.valueOf(body.get("name"));
        return ResponseEntity.ok(repository.lobbyChatInsert(String.valueOf(session.get("playerId")), name, text));
    }

    @PostMapping("/public/bugreport")
    public ResponseEntity<?> bugreport(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        String text = body.get("text") == null ? "" : String.valueOf(body.get("text")).trim();
        if (text.isBlank()) return ResponseEntity.badRequest().body(Map.of("ok", false, "error", "Missing text"));
        String contact = body.get("contact") == null ? null : String.valueOf(body.get("contact"));
        String name = body.get("name") == null ? null : String.valueOf(body.get("name"));
        String playerId = body.get("playerId") == null ? null : String.valueOf(body.get("playerId"));
        String matchId = body.get("matchId") == null ? null : String.valueOf(body.get("matchId"));
        String contextJson = body.get("context") == null ? null : String.valueOf(body.get("context"));
        String userAgent = request.getHeader("User-Agent");
        String url = body.get("url") == null ? request.getHeader("Referer") : String.valueOf(body.get("url"));
        return ResponseEntity.ok(repository.bugreportInsert(matchId, playerId, name, contact, text, contextJson, userAgent, url));
    }

    @GetMapping("/public/bugreports/latest")
    public Map<String, Object> publicBugreports(@RequestParam(defaultValue = "10") int limit,
                                                @RequestParam(required = false, defaultValue = "new") String status,
                                                @RequestParam(required = false) String sinceId) {
        int lim = Math.max(1, Math.min(50, limit));
        return repository.bugreportsPublicLatest(lim, status, sinceId);
    }

    @GetMapping("/public/tournaments")
    public Map<String, Object> tournaments(@RequestParam(defaultValue = "0") String includeFinished) {
        return repository.tournamentsList("1".equals(includeFinished));
    }

    @GetMapping("/public/tournament/{id}")
    public ResponseEntity<?> tournament(@PathVariable String id) {
        Map<String, Object> res = repository.tournamentGet(id);
        if (res == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("ok", false, "error", "Not found"));
        return ResponseEntity.ok(Map.of("ok", true, "tournament", res));
    }

    @GetMapping("/public/tournament/{id}/tables")
    public ResponseEntity<?> tournamentTables(@PathVariable String id, @RequestParam(defaultValue = "1") int round) {
        Map<String, Object> res = repository.tournamentTablesList(id, round);
        if (!(Boolean) res.getOrDefault("ok", false)) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(res);
        return ResponseEntity.ok(res);
    }

    @GetMapping("/public/tournament/{id}/bracket")
    public ResponseEntity<?> tournamentBracket(@PathVariable String id) {
        Map<String, Object> res = repository.tournamentBracketGet(id);
        if (!(Boolean) res.getOrDefault("ok", false)) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(res);
        return ResponseEntity.ok(res);
    }

    @PostMapping("/public/tournament/{id}/join")
    public ResponseEntity<?> tournamentJoin(@PathVariable String id, HttpServletRequest request, @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> session = repository.authGetSession(HttpUtils.bearerToken(request));
        if (session == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("ok", false, "error", "Unauthorized"));
        Map<String, Object> res = repository.tournamentJoin(id, String.valueOf(session.get("playerId")), body == null ? null : (body.get("name") == null ? null : String.valueOf(body.get("name"))));
        if (!(Boolean) res.getOrDefault("ok", false)) return ResponseEntity.status(HttpStatus.CONFLICT).body(res);
        return ResponseEntity.ok(res);
    }

    @PostMapping("/public/tournament/{id}/leave")
    public ResponseEntity<?> tournamentLeave(@PathVariable String id, HttpServletRequest request) {
        Map<String, Object> session = repository.authGetSession(HttpUtils.bearerToken(request));
        if (session == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("ok", false, "error", "Unauthorized"));
        Map<String, Object> res = repository.tournamentLeave(id, String.valueOf(session.get("playerId")));
        if (!(Boolean) res.getOrDefault("ok", false)) return ResponseEntity.status(HttpStatus.CONFLICT).body(res);
        return ResponseEntity.ok(res);
    }

    

@GetMapping("/public/my_matches")
public ResponseEntity<?> myMatches(HttpServletRequest request, @RequestParam(defaultValue = "20") int limit) {
    Map<String, Object> session = repository.authGetSession(HttpUtils.bearerToken(request));
    int lim = Math.max(1, Math.min(100, limit));
    if (session == null) {
        return ResponseEntity.ok(Map.of("ok", true, "matches", java.util.List.of(), "total", 0));
    }
    return ResponseEntity.ok(liveMatchService.getOwnedMatches(String.valueOf(session.get("playerId")), lim));
}

@GetMapping("/public/matches_open")
public Map<String, Object> matchesOpen(@RequestParam(defaultValue = "50") int limit) {
    int lim = Math.max(1, Math.min(100, limit));
    return liveMatchService.getPublicOpenMatches(lim);
}

@PostMapping("/public/tournament/{id}/table/{tableId}/create_match")
    public ResponseEntity<?> tournamentCreateMatchPublic(@PathVariable String id,
                                                         @PathVariable long tableId,
                                                         @RequestBody(required = false) Map<String, Object> body) {
        String actorName = body == null || body.get("name") == null ? null : String.valueOf(body.get("name"));
        Map<String, Object> res = liveMatchService.createTournamentMatch(id, tableId, actorName, true);
        if (!(Boolean) res.getOrDefault("ok", false)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(res);
        }
        return ResponseEntity.ok(res);
    }

    @PostMapping("/public/tournament/{id}/table/{tableId}/sync_result")
    public ResponseEntity<?> tournamentSyncResult(@PathVariable String id, @PathVariable long tableId) {
        Map<String, Object> res = liveMatchService.syncTournamentResult(id, tableId);
        if (!(Boolean) res.getOrDefault("ok", false)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(res);
        }
        return ResponseEntity.ok(res);
    }

}
