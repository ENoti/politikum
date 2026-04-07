package com.politikum.controller;

import com.politikum.service.PolitikumRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class PageController {
    private final PolitikumRepository repository;

    public PageController(PolitikumRepository repository) {
        this.repository = repository;
    }

    @GetMapping(value = "/profile/{playerId}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> profilePage(@PathVariable String playerId) {
        Map<String, Object> profile = repository.getPublicProfile(playerId);
        if (!(Boolean) profile.getOrDefault("ok", false)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("<h1>Profile not found</h1>");
        }
        String safeName = html(String.valueOf(profile.getOrDefault("name", profile.getOrDefault("username", playerId))));
        String safePid = html(String.valueOf(profile.get("playerId")));
        String safeBio = html(String.valueOf(profile.getOrDefault("bioText", "")));
        String imageUrl = "/public/profile_image/" + safePid + ".jpg";
        String html = "<!doctype html><html lang=\"ru\"><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/>" +
            "<title>Politikum · " + safeName + "</title><style>body{margin:0;background:#0b0f17;color:#f8e7b3;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial} .wrap{max-width:760px;margin:0 auto;padding:32px} .card{background:rgba(0,0,0,.45);border:1px solid rgba(217,119,6,.28);border-radius:24px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.35)} img{width:160px;height:160px;object-fit:cover;border-radius:18px;border:1px solid rgba(217,119,6,.28);background:#111827} .muted{opacity:.75} pre{white-space:pre-wrap;font:inherit}</style></head><body><div class=\"wrap\"><div class=\"card\"><div style=\"display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap\"><img src=\"" + imageUrl + "\" alt=\"avatar\" onerror=\"this.style.display='none'\"/><div><h1 style=\"margin:0 0 8px\">" + safeName + "</h1><div class=\"muted\">PlayerId: " + safePid + "</div><div style=\"margin-top:12px\">Рейтинг: " + profile.getOrDefault("rating", 1000) + "</div><div>Игр: " + profile.getOrDefault("games", 0) + "</div><div>Побед: " + profile.getOrDefault("wins", 0) + "</div></div></div><div style=\"margin-top:24px\"><div class=\"muted\" style=\"margin-bottom:8px\">Bio</div><pre>" + safeBio + "</pre></div></div></div></body></html>";
        return ResponseEntity.ok(html);
    }

    private String html(String s) {
        return s == null ? "" : s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
