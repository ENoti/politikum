package com.politikum.controller;

import com.politikum.service.PolitikumRepository;
import com.politikum.util.HttpUtils;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Base64;
import java.util.Map;

@RestController
public class AuthApiController {
    private final PolitikumRepository repository;
    private final Path profileImgDir;

    public AuthApiController(PolitikumRepository repository, @org.springframework.beans.factory.annotation.Value("${politikum.profile-img-dir:var/profile_images}") String profileImgDir) throws Exception {
        this.repository = repository;
        this.profileImgDir = Paths.get(profileImgDir).toAbsolutePath();
        Files.createDirectories(this.profileImgDir);
    }

    @PostMapping("/auth/register_or_login")
    public ResponseEntity<?> registerOrLogin(@RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(repository.authRegisterOrLogin(
                String.valueOf(body.getOrDefault("username", "")),
                String.valueOf(body.getOrDefault("token", "")),
                body.get("deviceId") == null ? null : String.valueOf(body.get("deviceId"))
            ));
        } catch (PolitikumRepository.UnauthorizedException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("ok", false, "error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("ok", false, "error", e.getMessage()));
        }
    }

    @PostMapping("/auth/change_token")
    public ResponseEntity<?> changeToken(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(repository.authChangeToken(
                HttpUtils.bearerToken(request),
                String.valueOf(body.getOrDefault("oldToken", body.getOrDefault("old", ""))),
                String.valueOf(body.getOrDefault("newToken", body.getOrDefault("new", "")))
            ));
        } catch (PolitikumRepository.UnauthorizedException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("ok", false, "error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("ok", false, "error", e.getMessage()));
        }
    }

    @GetMapping("/auth/me")
    public ResponseEntity<?> me(HttpServletRequest request) {
        Map<String, Object> session = repository.authGetSession(HttpUtils.bearerToken(request));
        if (session == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("ok", false, "error", "Unauthorized"));
        return ResponseEntity.ok(Map.of("ok", true, "session", session));
    }

    @PostMapping("/auth/profile/bio")
    public ResponseEntity<?> setBio(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        Map<String, Object> session = repository.authGetSession(HttpUtils.bearerToken(request));
        if (session == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("ok", false, "error", "Unauthorized"));
        return ResponseEntity.ok(repository.setUserBio(String.valueOf(session.get("playerId")), body.get("bioText") == null ? "" : String.valueOf(body.get("bioText"))));
    }

    @PostMapping("/auth/profile/image")
    public ResponseEntity<?> uploadProfileImage(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        Map<String, Object> session = repository.authGetSession(HttpUtils.bearerToken(request));
        if (session == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("ok", false, "error", "Unauthorized"));
        try {
            String dataUrl = String.valueOf(body.getOrDefault("imageBase64", body.getOrDefault("image", "")));
            if (dataUrl.isBlank()) return ResponseEntity.badRequest().body(Map.of("ok", false, "error", "no_image"));
            String raw = dataUrl.contains(",") ? dataUrl.substring(dataUrl.indexOf(',') + 1) : dataUrl;
            byte[] bytes = Base64.getDecoder().decode(raw);
            if (bytes.length == 0) return ResponseEntity.badRequest().body(Map.of("ok", false, "error", "bad_image"));
            if (bytes.length > 1_000_000) return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(Map.of("ok", false, "error", "too_large"));
            boolean isJpeg = bytes.length >= 3 && (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8 && (bytes[2] & 0xFF) == 0xFF;
            if (!isJpeg) return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).body(Map.of("ok", false, "error", "jpeg_only"));
            Path out = profileImgDir.resolve(String.valueOf(session.get("playerId")) + ".jpg");
            Files.write(out, bytes);
            return ResponseEntity.ok(Map.of("ok", true, "bytes", bytes.length));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("ok", false, "error", "bad_base64"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("ok", false, "error", "write_failed"));
        }
    }
}
