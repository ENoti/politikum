package com.politikum.service;

import com.politikum.util.CryptoUtils;
import com.politikum.util.JsonUtils;
import jakarta.annotation.PostConstruct;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.SecureRandom;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PolitikumRepository {
    private final JdbcTemplate jdbc;
    private final SecureRandom random = new SecureRandom();

    public PolitikumRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PostConstruct
    public void init() {
        jdbc.execute("PRAGMA journal_mode = WAL");
        jdbc.execute("PRAGMA foreign_keys = ON");
        jdbc.execute("CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY, email TEXT UNIQUE, created_at INTEGER NOT NULL)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS devices (device_id TEXT PRIMARY KEY, player_id TEXT NOT NULL, created_at INTEGER NOT NULL)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL, device_id TEXT, player_id TEXT NOT NULL, username TEXT, created_at INTEGER NOT NULL, last_seen_at INTEGER)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_sessions_account_id ON sessions(account_id)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions(device_id)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_sessions_username ON sessions(username)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, player_id TEXT UNIQUE NOT NULL, token_hash TEXT NOT NULL, created_at INTEGER NOT NULL)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_users_player_id ON users(player_id)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS player_profiles (player_id TEXT PRIMARY KEY, bio_text TEXT, updated_at INTEGER NOT NULL)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_player_profiles_updated_at ON player_profiles(updated_at)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS games (id INTEGER PRIMARY KEY, match_id TEXT UNIQUE NOT NULL, created_at INTEGER NOT NULL, finished_at INTEGER, duration_ms INTEGER, app_version TEXT, engine_version TEXT, num_players INTEGER, num_bots INTEGER, winner_player_id TEXT, winner_name TEXT, result_json TEXT, elo_applied INTEGER NOT NULL DEFAULT 0)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_games_finished_at ON games(finished_at)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_games_elo_applied ON games(elo_applied)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS ratings (player_id TEXT PRIMARY KEY, rating INTEGER NOT NULL, rd REAL NOT NULL DEFAULT 350, vol REAL NOT NULL DEFAULT 0.06, games_played INTEGER NOT NULL, wins INTEGER NOT NULL, updated_at INTEGER NOT NULL)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_ratings_updated_at ON ratings(updated_at)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS game_players (id INTEGER PRIMARY KEY, game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE, player_id TEXT NOT NULL, name TEXT, is_bot INTEGER NOT NULL DEFAULT 0)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players(game_id)");
        jdbc.execute("CREATE UNIQUE INDEX IF NOT EXISTS uniq_game_players_game_player ON game_players(game_id, player_id)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS tournaments (id TEXT PRIMARY KEY, name TEXT, type TEXT NOT NULL, table_size INTEGER NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL, started_at INTEGER, finished_at INTEGER, config_json TEXT)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_tournaments_created_at ON tournaments(created_at)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS tournament_players (tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE, player_id TEXT NOT NULL, name TEXT, joined_at INTEGER NOT NULL, dropped_at INTEGER, UNIQUE(tournament_id, player_id))");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_tournament_players_tid ON tournament_players(tournament_id)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_tournament_players_player_id ON tournament_players(player_id)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS tournament_rounds (id INTEGER PRIMARY KEY, tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE, round_index INTEGER NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_tournament_rounds_tid ON tournament_rounds(tournament_id)");
        jdbc.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_rounds_tid_round ON tournament_rounds(tournament_id, round_index)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS tournament_tables (id INTEGER PRIMARY KEY, tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE, round_id INTEGER REFERENCES tournament_rounds(id) ON DELETE CASCADE, table_index INTEGER NOT NULL, match_id TEXT, status TEXT NOT NULL, winner_player_id TEXT, result_json TEXT)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_tournament_tables_tid ON tournament_tables(tournament_id)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_tournament_tables_round_id ON tournament_tables(round_id)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_tournament_tables_tid_round_id ON tournament_tables(tournament_id, round_id)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_tournament_tables_match_id ON tournament_tables(match_id)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS lobby_chat_settings (key TEXT PRIMARY KEY, value TEXT)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS lobby_chat_messages (id INTEGER PRIMARY KEY, created_at INTEGER NOT NULL, player_id TEXT, name TEXT, text TEXT NOT NULL)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_lobby_chat_messages_created_at ON lobby_chat_messages(created_at)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS bugreports (id INTEGER PRIMARY KEY, created_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'new', match_id TEXT, player_id TEXT, name TEXT, contact TEXT, text TEXT NOT NULL, context_json TEXT, user_agent TEXT, url TEXT)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_bugreports_created_at ON bugreports(created_at)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_bugreports_status ON bugreports(status)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_bugreports_match_id ON bugreports(match_id)");
    }

    public long nowMs() {
        return System.currentTimeMillis();
    }

    public List<Map<String, Object>> query(String sql, Object... args) {
        return jdbc.query(sql, rowMapper(), args);
    }

    public Map<String, Object> queryOne(String sql, Object... args) {
        List<Map<String, Object>> list = query(sql, args);
        return list.isEmpty() ? null : list.get(0);
    }

    private RowMapper<Map<String, Object>> rowMapper() {
        return (rs, rowNum) -> {
            Map<String, Object> map = new LinkedHashMap<>();
            int cols = rs.getMetaData().getColumnCount();
            for (int i = 1; i <= cols; i++) {
                map.put(rs.getMetaData().getColumnLabel(i), rs.getObject(i));
            }
            return map;
        };
    }

    @Transactional
    public Map<String, Object> authCreateSessionForPlayer(String playerId, String username, String deviceId) {
        long now = nowMs();
        String token = CryptoUtils.randToken();
        jdbc.update("INSERT INTO sessions (token, account_id, device_id, player_id, username, created_at, last_seen_at) VALUES (?, NULL, ?, ?, ?, ?, ?)",
            token,
            blankToNull(deviceId),
            playerId,
            blankToNull(lower(username)),
            now,
            now);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("token", token);
        out.put("playerId", playerId);
        out.put("username", blankToNull(lower(username)));
        out.put("createdAt", now);
        return out;
    }

    @Transactional
    public Map<String, Object> authCreateSession(String email, String deviceId) {
        long now = nowMs();
        String token = CryptoUtils.randToken();
        String devId = blankToNull(deviceId);
        String playerId = CryptoUtils.randToken();
        if (devId != null) {
            Map<String, Object> row = queryOne("SELECT player_id AS playerId FROM devices WHERE device_id = ?", devId);
            if (row != null && row.get("playerId") != null) {
                playerId = String.valueOf(row.get("playerId"));
            } else {
                jdbc.update("INSERT INTO devices (device_id, player_id, created_at) VALUES (?, ?, ?)", devId, playerId, now);
            }
        }
        Long accountId = null;
        String em = blankToNull(lower(email));
        if (em != null) {
            jdbc.update("INSERT OR IGNORE INTO accounts (email, created_at) VALUES (?, ?)", em, now);
            Map<String, Object> row = queryOne("SELECT id FROM accounts WHERE email = ?", em);
            if (row != null && row.get("id") != null) accountId = ((Number) row.get("id")).longValue();
        }
        jdbc.update("INSERT INTO sessions (token, account_id, device_id, player_id, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)",
            token, accountId, devId, playerId, now, now);
        return Map.of("token", token, "playerId", playerId, "createdAt", now);
    }

    public Map<String, Object> authGetSession(String token) {
        if (token == null || token.isBlank()) return null;
        Map<String, Object> row = queryOne(
            "SELECT s.token, s.player_id AS playerId, s.username AS username, s.created_at AS createdAt, s.last_seen_at AS lastSeenAt, a.email AS email FROM sessions s LEFT JOIN accounts a ON a.id = s.account_id WHERE s.token = ?",
            token
        );
        if (row == null) return null;
        jdbc.update("UPDATE sessions SET last_seen_at = ? WHERE token = ?", nowMs(), token);
        return row;
    }

    @Transactional
    public Map<String, Object> authRegisterOrLogin(String username, String token, String deviceId) {
        String unameRaw = Objects.toString(username, "").trim();
        String uname = lower(unameRaw);
        String tok = Objects.toString(token, "");
        if (uname.length() < 2) throw new IllegalArgumentException("username_too_short");
        if (!uname.matches("^[a-z0-9_\\-.]{2,32}$")) throw new IllegalArgumentException("username_invalid");
        if (tok.length() < 4) throw new IllegalArgumentException("token_too_short");

        Map<String, Object> row = queryOne("SELECT username, player_id AS playerId, token_hash AS tokenHash FROM users WHERE username = ?", uname);
        String canonicalPlayerId = uname;
        if (row == null) {
            jdbc.update("INSERT INTO users (username, player_id, token_hash, created_at) VALUES (?, ?, ?, ?)",
                uname,
                canonicalPlayerId,
                CryptoUtils.hashUserToken(tok),
                nowMs());
            return authCreateSessionForPlayer(canonicalPlayerId, uname, deviceId);
        }

        if (!CryptoUtils.verifyUserToken(tok, String.valueOf(row.get("tokenHash")))) {
            throw new UnauthorizedException("invalid_token");
        }

        String rowPlayerId = Objects.toString(row.get("playerId"), "");
        if (!canonicalPlayerId.equals(rowPlayerId)) {
            try {
                adminMergePlayerIds(rowPlayerId, canonicalPlayerId);
                jdbc.update("UPDATE users SET player_id = ? WHERE username = ?", canonicalPlayerId, uname);
                rowPlayerId = canonicalPlayerId;
            } catch (Exception ignored) {
            }
        }
        return authCreateSessionForPlayer(rowPlayerId, uname, deviceId);
    }

    @Transactional
    public Map<String, Object> authChangeToken(String sessionToken, String oldToken, String newToken) {
        Map<String, Object> session = authGetSession(sessionToken);
        if (session == null) throw new UnauthorizedException("unauthorized");
        String username = lower(Objects.toString(session.get("username"), ""));
        if (username.isBlank()) throw new IllegalArgumentException("no_username");
        if (Objects.toString(newToken, "").length() < 4) throw new IllegalArgumentException("token_too_short");
        Map<String, Object> row = queryOne("SELECT token_hash AS tokenHash FROM users WHERE username = ?", username);
        if (row == null) throw new IllegalArgumentException("user_not_found");
        if (!CryptoUtils.verifyUserToken(oldToken, String.valueOf(row.get("tokenHash")))) {
            throw new UnauthorizedException("invalid_token");
        }
        jdbc.update("UPDATE users SET token_hash = ? WHERE username = ?", CryptoUtils.hashUserToken(newToken), username);
        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> adminMergePlayerIds(String fromPlayerId, String intoPlayerId) {
        String fromId = blankToNull(fromPlayerId);
        String intoId = blankToNull(intoPlayerId);
        if (fromId == null || intoId == null) throw new IllegalArgumentException("fromPlayerId and intoPlayerId are required");
        if (fromId.equals(intoId)) throw new IllegalArgumentException("fromPlayerId and intoPlayerId must differ");
        jdbc.update("UPDATE game_players SET player_id = ? WHERE player_id = ?", intoId, fromId);
        jdbc.update("UPDATE games SET winner_player_id = ? WHERE winner_player_id = ?", intoId, fromId);
        jdbc.update("UPDATE sessions SET player_id = ? WHERE player_id = ?", intoId, fromId);
        jdbc.update("UPDATE devices SET player_id = ? WHERE player_id = ?", intoId, fromId);
        jdbc.update("UPDATE tournament_players SET player_id = ? WHERE player_id = ?", intoId, fromId);
        jdbc.update("UPDATE tournament_tables SET winner_player_id = ? WHERE winner_player_id = ?", intoId, fromId);
        Map<String, Object> rating = queryOne("SELECT rating, rd, vol, games_played AS gamesPlayed, wins, updated_at AS updatedAt FROM ratings WHERE player_id = ?", fromId);
        Map<String, Object> targetRating = queryOne("SELECT rating, rd, vol, games_played AS gamesPlayed, wins, updated_at AS updatedAt FROM ratings WHERE player_id = ?", intoId);
        if (rating != null) {
            if (targetRating == null) {
                jdbc.update("INSERT INTO ratings (player_id, rating, rd, vol, games_played, wins, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    intoId,
                    number(rating.get("rating"), 1500),
                    decimal(rating.get("rd"), 350d),
                    decimal(rating.get("vol"), 0.06d),
                    number(rating.get("gamesPlayed"), 0),
                    number(rating.get("wins"), 0),
                    number(rating.get("updatedAt"), (int) nowMs()));
            } else {
                jdbc.update("UPDATE ratings SET games_played = games_played + ?, wins = wins + ?, updated_at = ? WHERE player_id = ?",
                    number(rating.get("gamesPlayed"), 0), number(rating.get("wins"), 0), nowMs(), intoId);
            }
            jdbc.update("DELETE FROM ratings WHERE player_id = ?", fromId);
        }
        return Map.of("ok", true, "fromPlayerId", fromId, "intoPlayerId", intoId);
    }

    public Map<String, Object> getLeaderboard(int limit, boolean registeredOnly) {
        String sql = "SELECT r.player_id AS playerId, r.rating AS rating, r.games_played AS games, r.wins AS wins, r.updated_at AS updatedAt, " +
            "(SELECT u.username FROM users u WHERE u.player_id = r.player_id LIMIT 1) AS username, " +
            "(SELECT gp.name FROM game_players gp WHERE gp.player_id = r.player_id AND gp.name IS NOT NULL AND TRIM(gp.name) <> '' ORDER BY gp.id DESC LIMIT 1) AS name, " +
            "(SELECT MAX(g.finished_at) FROM games g WHERE g.winner_player_id = r.player_id) AS lastFinishedAt " +
            "FROM ratings r " +
            (registeredOnly ? "WHERE EXISTS (SELECT 1 FROM users u WHERE u.player_id = r.player_id) " : "") +
            "ORDER BY r.rating DESC, r.wins DESC, r.games_played DESC LIMIT ?";
        List<Map<String, Object>> rows = query(sql, limit);
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("playerId", r.get("playerId"));
            item.put("name", firstNonBlank(r.get("username"), r.get("name")));
            item.put("rating", number(r.get("rating"), 1000));
            item.put("games", number(r.get("games"), 0));
            item.put("wins", number(r.get("wins"), 0));
            item.put("updatedAt", r.get("updatedAt"));
            item.put("lastFinishedAt", r.get("lastFinishedAt"));
            items.add(item);
        }
        return Map.of("items", items);
    }

    public Map<String, Object> getPublicProfile(String playerId) {
        String pid = blankToNull(playerId);
        if (pid == null) return Map.of("ok", false, "error", "bad_args");
        Map<String, Object> ratingRow = queryOne("SELECT rating, games_played AS games, wins FROM ratings WHERE player_id = ?", pid);
        int rating = ratingRow != null ? number(ratingRow.get("rating"), 1000) : 1000;
        int games = ratingRow != null ? number(ratingRow.get("games"), 0) : 0;
        int wins = ratingRow != null ? number(ratingRow.get("wins"), 0) : 0;
        Map<String, Object> nameRow = queryOne("SELECT gp.name AS name FROM game_players gp WHERE gp.player_id = ? AND gp.name IS NOT NULL AND TRIM(gp.name) <> '' ORDER BY gp.id DESC LIMIT 1", pid);
        Map<String, Object> userRow = queryOne("SELECT username FROM users WHERE player_id = ?", pid);
        Map<String, Object> profRow = queryOne("SELECT bio_text AS bioText FROM player_profiles WHERE player_id = ?", pid);
        String username = userRow == null ? null : blankToNull(Objects.toString(userRow.get("username"), null));
        String displayName = firstNonBlank(username, nameRow == null ? null : nameRow.get("name"));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("playerId", pid);
        out.put("username", username);
        out.put("name", displayName);
        out.put("rating", rating);
        out.put("games", games);
        out.put("wins", wins);
        out.put("winRate", games > 0 ? ((double) wins / (double) games) : 0d);
        out.put("bioText", profRow == null ? null : profRow.get("bioText"));
        return out;
    }

    @Transactional
    public Map<String, Object> setUserBio(String playerId, String bioText) {
        String pid = blankToNull(playerId);
        if (pid == null) return Map.of("ok", false, "error", "bad_args");
        String clean = Objects.toString(bioText, "").replace("\r", "").trim();
        if (clean.length() > 800) clean = clean.substring(0, 800);
        long now = nowMs();
        jdbc.update("INSERT INTO player_profiles (player_id, bio_text, updated_at) VALUES (?, ?, ?) ON CONFLICT(player_id) DO UPDATE SET bio_text=excluded.bio_text, updated_at=excluded.updated_at", pid, clean.isBlank() ? null : clean, now);
        return Map.of("ok", true, "bioText", clean);
    }

    public boolean lobbyChatIsEnabled() {
        Map<String, Object> row = queryOne("SELECT value FROM lobby_chat_settings WHERE key='enabled'");
        if (row == null || row.get("value") == null) return true;
        String value = String.valueOf(row.get("value")).trim().toLowerCase(Locale.ROOT);
        return !value.equals("0") && !value.equals("false");
    }

    @Transactional
    public Map<String, Object> lobbyChatSetEnabled(boolean enabled) {
        jdbc.update("INSERT INTO lobby_chat_settings(key,value) VALUES('enabled',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", enabled ? "1" : "0");
        return Map.of("ok", true, "enabled", lobbyChatIsEnabled());
    }

    @Transactional
    public Map<String, Object> lobbyChatClear() {
        jdbc.update("DELETE FROM lobby_chat_messages");
        return Map.of("ok", true);
    }

    public Map<String, Object> lobbyChatList(int limit) {
        List<Map<String, Object>> rows = query("SELECT id, created_at AS createdAt, player_id AS playerId, name, text FROM lobby_chat_messages ORDER BY id DESC LIMIT ?", limit);
        Collections.reverse(rows);
        return Map.of("ok", true, "enabled", lobbyChatIsEnabled(), "items", rows);
    }

    @Transactional
    public Map<String, Object> lobbyChatInsert(String playerId, String name, String text) {
        String t = Objects.toString(text, "").trim();
        if (t.isBlank()) return Map.of("ok", false, "error", "empty");
        if (t.length() > 400) return Map.of("ok", false, "error", "too_long");
        jdbc.update("INSERT INTO lobby_chat_messages(created_at, player_id, name, text) VALUES(?,?,?,?)",
            nowMs(), blankToNull(playerId), blankToNull(name), t);
        jdbc.update("DELETE FROM lobby_chat_messages WHERE id NOT IN (SELECT id FROM lobby_chat_messages ORDER BY id DESC LIMIT 500)");
        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> bugreportInsert(String matchId, String playerId, String name, String contact, String text, String contextJson, String userAgent, String url) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.update(con -> {
            PreparedStatement ps = con.prepareStatement("INSERT INTO bugreports (created_at, status, match_id, player_id, name, contact, text, context_json, user_agent, url) VALUES (?, 'new', ?, ?, ?, ?, ?, ?, ?, ?)", Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1, nowMs());
            ps.setString(2, blankToNull(matchId));
            ps.setString(3, blankToNull(playerId));
            ps.setString(4, blankToNull(name));
            ps.setString(5, blankToNull(contact));
            ps.setString(6, substring(text, 4000));
            ps.setString(7, substring(contextJson, 20000));
            ps.setString(8, substring(userAgent, 512));
            ps.setString(9, substring(url, 512));
            return ps;
        }, keyHolder);
        Number key = keyHolder.getKey();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("id", key == null ? null : key.longValue());
        return out;
    }

    public Map<String, Object> bugreportsList(int limit, int offset, String status) {
        String st = blankToNull(status);
        String where = st == null ? "" : " WHERE status = ? ";
        List<Map<String, Object>> rows = st == null
            ? query("SELECT * FROM bugreports ORDER BY created_at DESC LIMIT ? OFFSET ?", limit, offset)
            : query("SELECT * FROM bugreports WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?", st, limit, offset);
        Map<String, Object> total = st == null
            ? queryOne("SELECT COUNT(*) AS n FROM bugreports")
            : queryOne("SELECT COUNT(*) AS n FROM bugreports WHERE status = ?", st);
        return Map.of("ok", true, "total", number(total == null ? null : total.get("n"), 0), "rows", rows);
    }

    public Map<String, Object> bugreportsPublicLatest(int limit, String status, String sinceId) {
        String st = blankToNull(status);
        Integer sid = null;
        try { sid = sinceId == null ? null : Integer.parseInt(sinceId); } catch (Exception ignored) {}
        StringBuilder sql = new StringBuilder("SELECT id, created_at, status, match_id, player_id, name, text FROM bugreports");
        List<Object> args = new ArrayList<>();
        List<String> clauses = new ArrayList<>();
        if (st != null) { clauses.add("status = ?"); args.add(st); }
        if (sid != null) { clauses.add("id > ?"); args.add(sid); }
        if (!clauses.isEmpty()) sql.append(" WHERE ").append(String.join(" AND ", clauses));
        sql.append(" ORDER BY id DESC LIMIT ?");
        args.add(limit);
        List<Map<String, Object>> rows = query(sql.toString(), args.toArray());
        List<Map<String, Object>> safe = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> copy = new LinkedHashMap<>(row);
            String t = Objects.toString(row.get("text"), "").replaceAll("\\s+", " ").trim();
            copy.put("text_preview", t.length() > 100 ? t.substring(0, 100) : t);
            safe.add(copy);
        }
        return Map.of("ok", true, "rows", safe);
    }

    @Transactional
    public Map<String, Object> bugreportSetStatus(long id, String status) {
        if (!List.of("new", "seen", "done").contains(status)) return Map.of("ok", false, "error", "bad_status");
        jdbc.update("UPDATE bugreports SET status = ? WHERE id = ?", status, id);
        return Map.of("ok", true);
    }

    public Map<String, Object> tournamentsList(boolean includeFinished) {
        String sql = "SELECT id, name, type, table_size AS tableSize, status, created_at AS createdAt, started_at AS startedAt, finished_at AS finishedAt, config_json AS configJson FROM tournaments " +
            (includeFinished ? "" : "WHERE status IN ('registering','running') ") +
            "ORDER BY created_at DESC LIMIT 100";
        List<Map<String, Object>> rows = query(sql);
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            String tid = String.valueOf(r.get("id"));
            Map<String, Object> countRow = queryOne("SELECT COUNT(1) AS n FROM tournament_players WHERE tournament_id = ? AND dropped_at IS NULL", tid);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", r.get("id"));
            item.put("name", r.get("name"));
            item.put("type", r.get("type"));
            item.put("tableSize", number(r.get("tableSize"), 2));
            item.put("status", r.get("status"));
            item.put("createdAt", r.get("createdAt"));
            item.put("startedAt", r.get("startedAt"));
            item.put("finishedAt", r.get("finishedAt"));
            item.put("config", JsonUtils.parseMap((String) r.get("configJson")));
            item.put("playersCount", number(countRow == null ? null : countRow.get("n"), 0));
            items.add(item);
        }
        return Map.of("items", items);
    }

    public Map<String, Object> tournamentGet(String id) {
        String tid = blankToNull(id);
        if (tid == null) return null;
        Map<String, Object> t = queryOne("SELECT id, name, type, table_size AS tableSize, status, created_at AS createdAt, started_at AS startedAt, finished_at AS finishedAt, config_json AS configJson FROM tournaments WHERE id = ?", tid);
        if (t == null) return null;
        List<Map<String, Object>> players = query("SELECT player_id AS playerId, name, joined_at AS joinedAt, dropped_at AS droppedAt FROM tournament_players WHERE tournament_id = ? AND dropped_at IS NULL ORDER BY joined_at ASC", tid);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", t.get("id"));
        out.put("name", t.get("name"));
        out.put("type", t.get("type"));
        out.put("tableSize", number(t.get("tableSize"), 2));
        out.put("status", t.get("status"));
        out.put("createdAt", t.get("createdAt"));
        out.put("startedAt", t.get("startedAt"));
        out.put("finishedAt", t.get("finishedAt"));
        out.put("config", JsonUtils.parseMap((String) t.get("configJson")));
        out.put("players", players);
        out.put("rounds", List.of());
        out.put("tables", List.of());
        return out;
    }

    public Map<String, Object> tournamentTablesList(String id, int roundIndex) {
        String tid = blankToNull(id);
        if (tid == null || roundIndex < 1) return Map.of("ok", false, "error", "bad_args");
        Map<String, Object> round = queryOne("SELECT id, round_index AS roundIndex, status FROM tournament_rounds WHERE tournament_id = ? AND round_index = ?", tid, roundIndex);
        if (round == null) return Map.of("ok", false, "error", "round_not_found");
        List<Map<String, Object>> rows = query("SELECT id, table_index AS tableIndex, match_id AS matchId, status, winner_player_id AS winnerPlayerId, result_json AS resultJson FROM tournament_tables WHERE tournament_id = ? AND round_id = ? ORDER BY table_index ASC", tid, round.get("id"));
        List<Map<String, Object>> tables = rows.stream().map(this::tableRowToDto).collect(Collectors.toList());
        return Map.of("ok", true, "tournamentId", tid, "round", round, "tables", tables);
    }

    public Map<String, Object> tournamentBracketGet(String id) {
        String tid = blankToNull(id);
        if (tid == null) return Map.of("ok", false, "error", "bad_args");
        List<Map<String, Object>> rounds = query("SELECT id, round_index AS roundIndex, status, created_at AS createdAt FROM tournament_rounds WHERE tournament_id = ? ORDER BY round_index ASC", tid);
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> r : rounds) {
            List<Map<String, Object>> tables = query("SELECT id, table_index AS tableIndex, match_id AS matchId, status, winner_player_id AS winnerPlayerId, result_json AS resultJson FROM tournament_tables WHERE tournament_id = ? AND round_id = ? ORDER BY table_index ASC", tid, r.get("id"))
                .stream().map(this::tableRowToDto).collect(Collectors.toList());
            Map<String, Object> round = new LinkedHashMap<>(r);
            round.put("tables", tables);
            result.add(round);
        }
        return Map.of("ok", true, "tournamentId", tid, "rounds", result);
    }

    public Map<String, Object> tournamentTableGet(String tournamentId, long tableId) {
        String tid = blankToNull(tournamentId);
        if (tid == null) return null;
        Map<String, Object> row = queryOne("SELECT id, tournament_id AS tournamentId, table_index AS tableIndex, match_id AS matchId, status, result_json AS resultJson FROM tournament_tables WHERE tournament_id = ? AND id = ?", tid, tableId);
        if (row == null) return null;
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", row.get("id"));
        dto.put("tournamentId", row.get("tournamentId"));
        dto.put("tableIndex", number(row.get("tableIndex"), 0));
        dto.put("matchId", row.get("matchId"));
        dto.put("status", row.get("status"));
        dto.put("seats", tableSeats((String) row.get("resultJson")));
        return dto;
    }

    @Transactional
    public Map<String, Object> tournamentTableSetResult(String tournamentId, long tableId, String winnerPlayerId, Map<String, Object> result) {
        String tid = blankToNull(tournamentId);
        if (tid == null) return Map.of("ok", false, "error", "bad_args");
        String winner = blankToNull(winnerPlayerId);
        jdbc.update("UPDATE tournament_tables SET status = 'finished', winner_player_id = ?, result_json = ? WHERE tournament_id = ? AND id = ?",
            winner,
            JsonUtils.stringify(result),
            tid,
            tableId);
        Map<String, Object> rid = queryOne("SELECT round_id AS roundId FROM tournament_tables WHERE tournament_id = ? AND id = ?", tid, tableId);
        if (rid != null && rid.get("roundId") != null) {
            Map<String, Object> unfinished = queryOne("SELECT COUNT(1) AS n FROM tournament_tables WHERE tournament_id = ? AND round_id = ? AND status <> 'finished'", tid, rid.get("roundId"));
            if (number(unfinished == null ? null : unfinished.get("n"), 0) <= 0) {
                jdbc.update("UPDATE tournament_rounds SET status = 'done' WHERE id = ?", rid.get("roundId"));
            }
        }
        maybeFinishTournament(tid, winner);
        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> tournamentCreate(Map<String, Object> body) {
        String id = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String type = lower(Objects.toString(body.getOrDefault("type", "single_elim"), "single_elim"));
        if (!List.of("single_elim", "double_elim").contains(type)) type = "single_elim";
        int tableSize = Math.max(2, Math.min(5, number(body.get("tableSize"), 2)));
        Map<String, Object> cfg = new LinkedHashMap<>();
        cfg.put("name", blankToNull(Objects.toString(body.get("name"), "")));
        cfg.put("type", type);
        cfg.put("tableSize", tableSize);
        cfg.put("maxPlayers", body.get("maxPlayers"));
        long createdAt = nowMs();
        jdbc.update("INSERT INTO tournaments (id, name, type, table_size, status, created_at, started_at, finished_at, config_json) VALUES (?, ?, ?, ?, 'registering', ?, NULL, NULL, ?)",
            id,
            cfg.get("name"),
            type,
            tableSize,
            createdAt,
            JsonUtils.stringify(cfg));
        return Map.of("ok", true, "tournament", tournamentGet(id));
    }

    @Transactional
    public Map<String, Object> tournamentSetStatus(String id, String status) {
        String tid = blankToNull(id);
        if (tid == null) return Map.of("ok", false, "error", "bad_args");
        if (queryOne("SELECT id FROM tournaments WHERE id = ?", tid) == null) return Map.of("ok", false, "error", "not_found");
        String next = switch (Objects.toString(status, "")) {
            case "open_registration" -> "registering";
            case "close_registration", "start" -> "running";
            case "cancel" -> "cancelled";
            default -> blankToNull(status);
        };
        if (next == null) return Map.of("ok", false, "error", "bad_status");
        Long started = "running".equals(next) ? nowMs() : null;
        Long finished = List.of("finished", "cancelled").contains(next) ? nowMs() : null;
        jdbc.update("UPDATE tournaments SET status = ?, started_at = COALESCE(started_at, ?), finished_at = CASE WHEN ? IS NULL THEN finished_at ELSE ? END WHERE id = ?",
            next, started, finished, finished, tid);
        return Map.of("ok", true, "tournament", tournamentGet(tid));
    }

    @Transactional
    public Map<String, Object> tournamentJoin(String id, String playerId, String name) {
        String tid = blankToNull(id);
        String pid = blankToNull(playerId);
        if (tid == null || pid == null) return Map.of("ok", false, "error", "bad_args");
        Map<String, Object> tournament = queryOne("SELECT status FROM tournaments WHERE id = ?", tid);
        if (tournament == null) return Map.of("ok", false, "error", "not_found");
        if (!"registering".equals(String.valueOf(tournament.get("status")))) return Map.of("ok", false, "error", "not_registering");
        jdbc.update("INSERT INTO tournament_players (tournament_id, player_id, name, joined_at, dropped_at) VALUES (?, ?, ?, ?, NULL) ON CONFLICT(tournament_id,player_id) DO UPDATE SET dropped_at = NULL, name = COALESCE(excluded.name, tournament_players.name)",
            tid, pid, blankToNull(name), nowMs());
        return Map.of("ok", true, "tournament", tournamentGet(tid));
    }

    @Transactional
    public Map<String, Object> tournamentLeave(String id, String playerId) {
        String tid = blankToNull(id);
        String pid = blankToNull(playerId);
        if (tid == null || pid == null) return Map.of("ok", false, "error", "bad_args");
        Map<String, Object> tournament = queryOne("SELECT status FROM tournaments WHERE id = ?", tid);
        if (tournament == null) return Map.of("ok", false, "error", "not_found");
        if (!"registering".equals(String.valueOf(tournament.get("status")))) return Map.of("ok", false, "error", "not_registering");
        jdbc.update("UPDATE tournament_players SET dropped_at = ? WHERE tournament_id = ? AND player_id = ?", nowMs(), tid, pid);
        return Map.of("ok", true, "tournament", tournamentGet(tid));
    }

    @Transactional
    public Map<String, Object> tournamentGenerateRound1(String id) {
        String tid = blankToNull(id);
        if (tid == null) return Map.of("ok", false, "error", "bad_args");
        Map<String, Object> t = queryOne("SELECT id, table_size AS tableSize, status FROM tournaments WHERE id = ?", tid);
        if (t == null) return Map.of("ok", false, "error", "not_found");
        if (!"registering".equals(String.valueOf(t.get("status")))) return Map.of("ok", false, "error", "not_registering");
        if (queryOne("SELECT id FROM tournament_rounds WHERE tournament_id = ? AND round_index = 1", tid) != null) return Map.of("ok", false, "error", "round_exists");
        int tableSize = Math.max(2, Math.min(5, number(t.get("tableSize"), 2)));
        List<Map<String, Object>> players = query("SELECT player_id AS playerId, name FROM tournament_players WHERE tournament_id = ? AND dropped_at IS NULL ORDER BY joined_at ASC", tid);
        if (players.size() < 2) return Map.of("ok", false, "error", "not_enough_players");
        shuffle(players);
        long now = nowMs();
        jdbc.update("UPDATE tournaments SET status = 'running', started_at = COALESCE(started_at, ?) WHERE id = ?", now, tid);
        long roundId = insertRound(tid, 1, "in_progress", now);
        List<Map<String, Object>> tables = new ArrayList<>();
        int tableIndex = 1;
        for (int i = 0; i < players.size();) {
            int remaining = players.size() - i;
            if (remaining == 1) break;
            int size = Math.min(tableSize, remaining);
            List<Map<String, Object>> slice = new ArrayList<>(players.subList(i, i + size));
            long tableId = insertTable(tid, roundId, tableIndex, "pending", Map.of("seats", seatify(slice)));
            tables.add(Map.of("id", tableId, "tableIndex", tableIndex, "seats", slice));
            tableIndex++;
            i += size;
        }
        return Map.of("ok", true, "round", Map.of("id", roundId, "roundIndex", 1), "tables", tables, "tournament", tournamentGet(tid));
    }

    @Transactional
    public Map<String, Object> tournamentGenerateNextRound(String id) {
        String tid = blankToNull(id);
        if (tid == null) return Map.of("ok", false, "error", "bad_args");
        Map<String, Object> t = queryOne("SELECT id, type, table_size AS tableSize, status FROM tournaments WHERE id = ?", tid);
        if (t == null) return Map.of("ok", false, "error", "not_found");
        if (!"running".equals(String.valueOf(t.get("status")))) return Map.of("ok", false, "error", "not_running");
        int tableSize = Math.max(2, Math.min(5, number(t.get("tableSize"), 2)));
        Map<String, Object> lastRoundRow = queryOne("SELECT MAX(round_index) AS maxRound FROM tournament_rounds WHERE tournament_id = ?", tid);
        int lastRoundIndex = number(lastRoundRow == null ? null : lastRoundRow.get("maxRound"), 0);
        if (lastRoundIndex <= 0) return Map.of("ok", false, "error", "no_rounds");
        Map<String, Object> lastRound = queryOne("SELECT id FROM tournament_rounds WHERE tournament_id = ? AND round_index = ?", tid, lastRoundIndex);
        if (lastRound == null) return Map.of("ok", false, "error", "round_not_found");
        Map<String, Object> unfinished = queryOne("SELECT COUNT(1) AS n FROM tournament_tables WHERE tournament_id = ? AND round_id = ? AND status <> 'finished'", tid, lastRound.get("id"));
        if (number(unfinished == null ? null : unfinished.get("n"), 0) > 0) return Map.of("ok", false, "error", "round_not_finished");
        String type = String.valueOf(t.get("type"));
        if (!"double_elim".equals(type)) {
            List<Map<String, Object>> rows = query("SELECT winner_player_id AS winnerPlayerId FROM tournament_tables WHERE tournament_id = ? AND round_id = ? ORDER BY table_index ASC", tid, lastRound.get("id"));
            List<String> winners = rows.stream().map(r -> blankToNull(Objects.toString(r.get("winnerPlayerId"), null))).filter(Objects::nonNull).toList();
            if (winners.size() <= 1) return Map.of("ok", false, "error", "tournament_finished");
            Map<String, String> nameById = playerNamesById(tid);
            int nextRoundIndex = lastRoundIndex + 1;
            long roundId = insertRound(tid, nextRoundIndex, "in_progress", nowMs());
            List<Map<String, Object>> tables = new ArrayList<>();
            int tableIndex = 1;
            for (int i = 0; i < winners.size();) {
                int remaining = winners.size() - i;
                if (remaining == 1) break;
                int size = Math.min(tableSize, remaining);
                List<Map<String, Object>> seats = new ArrayList<>();
                for (int j = i; j < i + size; j++) {
                    String pid = winners.get(j);
                    Map<String, Object> seat = new LinkedHashMap<>();
                    seat.put("playerId", pid);
                    seat.put("name", nameById.get(pid));
                    seat.put("seat", j - i);
                    seats.add(seat);
                }
                long tableId = insertTable(tid, roundId, tableIndex, "pending", Map.of("seats", seats));
                tables.add(Map.of("id", tableId, "tableIndex", tableIndex, "seats", seats));
                tableIndex++;
                i += size;
            }
            return Map.of("ok", true, "round", Map.of("id", roundId, "roundIndex", nextRoundIndex), "tables", tables, "tournament", tournamentGet(tid));
        }

        List<Map<String, Object>> players = query("SELECT player_id AS playerId, name FROM tournament_players WHERE tournament_id = ? AND dropped_at IS NULL ORDER BY joined_at ASC", tid);
        if (players.size() < 2) return Map.of("ok", false, "error", "not_enough_players");
        Map<String, String> nameById = new LinkedHashMap<>();
        Map<String, Integer> losses = new LinkedHashMap<>();
        for (Map<String, Object> p : players) {
            String pid = String.valueOf(p.get("playerId"));
            nameById.put(pid, Objects.toString(p.get("name"), null));
            losses.put(pid, 0);
        }
        List<Map<String, Object>> rows = query("SELECT tt.winner_player_id AS winnerPlayerId, tt.result_json AS resultJson FROM tournament_tables tt JOIN tournament_rounds tr ON tr.id = tt.round_id WHERE tr.tournament_id = ? AND tt.status = 'finished' ORDER BY tr.round_index ASC, tt.table_index ASC", tid);
        for (Map<String, Object> row : rows) {
            String winner = blankToNull(Objects.toString(row.get("winnerPlayerId"), null));
            for (Map<String, Object> seat : tableSeats((String) row.get("resultJson"))) {
                String pid = blankToNull(Objects.toString(seat.get("playerId"), null));
                if (pid == null || !losses.containsKey(pid)) continue;
                if (winner != null && winner.equals(pid)) continue;
                losses.put(pid, losses.get(pid) + 1);
            }
        }
        List<String> survivors0 = losses.entrySet().stream().filter(e -> e.getValue() == 0).map(Map.Entry::getKey).collect(Collectors.toCollection(ArrayList::new));
        List<String> survivors1 = losses.entrySet().stream().filter(e -> e.getValue() == 1).map(Map.Entry::getKey).collect(Collectors.toCollection(ArrayList::new));
        int total = survivors0.size() + survivors1.size();
        if (total <= 1) return Map.of("ok", false, "error", "tournament_finished");
        int nextRoundIndex = lastRoundIndex + 1;
        long roundId = insertRound(tid, nextRoundIndex, "in_progress", nowMs());
        List<Map<String, Object>> tables = new ArrayList<>();
        int[] tableIndex = {1};
        if (survivors0.size() == 1 && survivors1.size() == 1) {
            List<String> pair = List.of(survivors0.get(0), survivors1.get(0));
            List<Map<String, Object>> seats = toSeats(pair, nameById);
            long tableId = insertTable(tid, roundId, 1, "pending", Map.of("seats", seats));
            tables.add(Map.of("id", tableId, "tableIndex", 1, "seats", seats));
        } else {
            scheduleGroup(tid, roundId, tableSize, survivors0, nameById, tables, tableIndex);
            scheduleGroup(tid, roundId, tableSize, survivors1, nameById, tables, tableIndex);
            if (tables.isEmpty()) return Map.of("ok", false, "error", "no_tables");
        }
        return Map.of("ok", true, "round", Map.of("id", roundId, "roundIndex", nextRoundIndex), "tables", tables, "tournament", tournamentGet(tid));
    }


    public Map<String, Object> getPublicOpenMatches(int limit) {
        int lim = Math.max(1, Math.min(100, limit));
        List<Map<String, Object>> items = new ArrayList<>();
        return Map.of("ok", true, "matches", items, "items", items, "total", items.size(), "backend", "java");
    }

    public Map<String, Object> getAdminSummary() {
        Map<String, Object> games = queryOne("SELECT COUNT(1) AS n FROM games");
        Map<String, Object> players = queryOne("SELECT COUNT(1) AS n FROM users");
        Map<String, Object> bugreports = queryOne("SELECT COUNT(1) AS n FROM bugreports WHERE status = 'new'");
        Map<String, Object> tournaments = queryOne("SELECT COUNT(1) AS n FROM tournaments WHERE status <> 'finished'");
        Map<String, Object> lobbyChat = queryOne("SELECT COUNT(1) AS n FROM lobby_chat_messages");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("backend", "java");
        out.put("gamesFinished", number(games == null ? null : games.get("n"), 0));
        out.put("registeredPlayers", number(players == null ? null : players.get("n"), 0));
        out.put("newBugreports", number(bugreports == null ? null : bugreports.get("n"), 0));
        out.put("activeTournaments", number(tournaments == null ? null : tournaments.get("n"), 0));
        out.put("lobbyChatMessages", number(lobbyChat == null ? null : lobbyChat.get("n"), 0));
        out.put("liveInProgressTotal", 0);
        out.put("supportsLiveMatches", false);
        out.put("lastAdminSyncAt", nowMs());
        return out;
    }

    public Map<String, Object> getAdminGames(int limit, int offset) {
        int lim = Math.max(1, Math.min(200, limit));
        int off = Math.max(0, offset);
        List<Map<String, Object>> rows = query(
            "SELECT id, match_id AS matchId, created_at AS createdAt, finished_at AS finishedAt, duration_ms AS durationMs, app_version AS appVersion, engine_version AS engineVersion, num_players AS numPlayers, num_bots AS numBots, winner_player_id AS winnerPlayerId, winner_name AS winnerName, result_json AS resultJson FROM games ORDER BY COALESCE(finished_at, created_at) DESC LIMIT ? OFFSET ?",
            lim, off
        );
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", row.get("id"));
            item.put("matchId", row.get("matchId"));
            item.put("createdAt", row.get("createdAt"));
            item.put("finishedAt", row.get("finishedAt"));
            item.put("durationMs", row.get("durationMs"));
            item.put("appVersion", row.get("appVersion"));
            item.put("engineVersion", row.get("engineVersion"));
            item.put("numPlayers", row.get("numPlayers"));
            item.put("numBots", row.get("numBots"));
            item.put("winnerPlayerId", row.get("winnerPlayerId"));
            item.put("winnerName", row.get("winnerName"));
            item.put("hasResult", row.get("resultJson") != null);
            items.add(item);
        }
        int total = number(queryOne("SELECT COUNT(1) AS n FROM games").get("n"), 0);
        return Map.of("ok", true, "items", items, "total", total, "limit", lim, "offset", off);
    }

    public Map<String, Object> getAdminMatches(int limit) {
        int lim = Math.max(1, Math.min(100, limit));
        List<Map<String, Object>> rows = query(
            "SELECT tt.match_id AS matchId, tt.status AS status, tt.tournament_id AS tournamentId, tt.id AS tableId, tr.round_index AS roundIndex, tt.result_json AS resultJson " +
                "FROM tournament_tables tt JOIN tournament_rounds tr ON tr.id = tt.round_id " +
                "WHERE tt.match_id IS NOT NULL AND tt.status <> 'finished' ORDER BY tr.round_index DESC, tt.id DESC LIMIT ?",
            lim
        );
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("matchID", row.get("matchId"));
            item.put("matchId", row.get("matchId"));
            item.put("status", row.get("status"));
            item.put("tournamentId", row.get("tournamentId"));
            item.put("tableId", row.get("tableId"));
            item.put("roundIndex", row.get("roundIndex"));
            item.put("players", tableSeats((String) row.get("resultJson")));
            items.add(item);
        }
        return Map.of("ok", true, "items", items, "total", items.size(), "supportsLiveMatches", false);
    }

    public Map<String, Object> getAdminMatchLog(String matchId, int limit) {
        String mid = blankToNull(matchId);
        if (mid == null) return Map.of("ok", false, "error", "matchId_required");
        Map<String, Object> game = queryOne("SELECT match_id AS matchId, created_at AS createdAt, finished_at AS finishedAt, duration_ms AS durationMs, winner_player_id AS winnerPlayerId, winner_name AS winnerName, result_json AS resultJson FROM games WHERE match_id = ?", mid);
        Map<String, Object> table = queryOne("SELECT tournament_id AS tournamentId, id AS tableId, status, result_json AS resultJson FROM tournament_tables WHERE match_id = ?", mid);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("matchId", mid);
        out.put("foundInStorage", false);
        out.put("supportsLiveMatches", false);
        out.put("limit", Math.max(1, Math.min(1000, limit)));
        out.put("fetchError", game == null ? "java_backend_has_no_boardgame_storage" : null);
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("createdAt", game == null ? null : game.get("createdAt"));
        meta.put("updatedAt", game == null ? null : firstNonNull(game.get("finishedAt"), game.get("createdAt")));
        if (game != null && game.get("finishedAt") != null) {
            Map<String, Object> gameover = new LinkedHashMap<>();
            gameover.put("finishedAt", game.get("finishedAt"));
            gameover.put("winnerPlayerId", game.get("winnerPlayerId"));
            gameover.put("winnerName", game.get("winnerName"));
            meta.put("gameover", gameover);
        } else {
            meta.put("gameover", null);
        }
        out.put("meta", meta);
        out.put("ctx", null);
        out.put("pending", null);
        out.put("response", null);
        out.put("log", List.of());
        out.put("logTotal", 0);
        out.put("trace", List.of());
        out.put("traceTotal", 0);
        Map<String, Object> db = new LinkedHashMap<>();
        db.put("hasRecord", game != null || table != null);
        db.put("winnerName", game == null ? null : game.get("winnerName"));
        db.put("finishedAt", game == null ? null : game.get("finishedAt"));
        db.put("tournamentId", table == null ? null : table.get("tournamentId"));
        db.put("tableId", table == null ? null : table.get("tableId"));
        db.put("status", table == null ? null : table.get("status"));
        out.put("db", db);
        return out;
    }

    @Transactional
    public Map<String, Object> killMatch(String matchId) {
        String mid = blankToNull(matchId);
        if (mid == null) return Map.of("ok", false, "error", "matchId_required");
        int tables = jdbc.update("UPDATE tournament_tables SET status = CASE WHEN status = 'finished' THEN status ELSE 'canceled' END, match_id = NULL WHERE match_id = ?", mid);
        int games = jdbc.update("DELETE FROM games WHERE match_id = ?", mid);
        return Map.of("ok", true, "matchId", mid, "deletedGames", games, "updatedTables", tables, "supportsLiveMatches", false);
    }

    @Transactional
    public Map<String, Object> tournamentTableCreateJavaPlaceholderMatch(String tournamentId, long tableId, String actorName) {
        String tid = blankToNull(tournamentId);
        if (tid == null) return Map.of("ok", false, "error", "tournament_required");
        Map<String, Object> table = tournamentTableGet(tid, tableId);
        if (table == null) return Map.of("ok", false, "error", "not_found");
        if (table.get("matchId") != null) return Map.of("ok", true, "matchId", table.get("matchId"), "alreadyExists", true, "backend", "java");
        String base = "t_" + tid + "_" + tableId + "_" + Long.toString(nowMs(), 36);
        jdbc.update("UPDATE tournament_tables SET match_id = ?, status = 'ready' WHERE tournament_id = ? AND id = ?", base, tid, tableId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("matchId", base);
        out.put("backend", "java");
        out.put("placeholder", true);
        out.put("warning", "java_backend_created_placeholder_match_only");
        if (actorName != null && !actorName.isBlank()) out.put("requestedBy", actorName.trim());
        return out;
    }

    @Transactional
    public Map<String, Object> tournamentTableSyncResult(String tournamentId, long tableId) {
        String tid = blankToNull(tournamentId);
        if (tid == null) return Map.of("ok", false, "error", "tournament_required");
        Map<String, Object> table = tournamentTableGet(tid, tableId);
        if (table == null) return Map.of("ok", false, "error", "not_found");
        if ("finished".equals(String.valueOf(table.get("status")))) {
            return Map.of("ok", true, "alreadyFinished", true, "table", table);
        }
        return Map.of("ok", false, "error", "java_backend_has_no_live_match_state");
    }

    private void scheduleGroup(String tid, long roundId, int tableSize, List<String> ids, Map<String, String> nameById, List<Map<String, Object>> tables, int[] tableIndex) {
        List<String> shuffled = new ArrayList<>(ids);
        Collections.shuffle(shuffled, random);
        for (int i = 0; i < shuffled.size();) {
            int remaining = shuffled.size() - i;
            if (remaining == 1) break;
            int size = Math.min(tableSize, remaining);
            List<String> slice = new ArrayList<>(shuffled.subList(i, i + size));
            List<Map<String, Object>> seats = toSeats(slice, nameById);
            long tableId = insertTable(tid, roundId, tableIndex[0], "pending", Map.of("seats", seats));
            tables.add(Map.of("id", tableId, "tableIndex", tableIndex[0], "seats", seats));
            tableIndex[0]++;
            i += size;
        }
    }

    private List<Map<String, Object>> toSeats(List<String> playerIds, Map<String, String> nameById) {
        List<Map<String, Object>> seats = new ArrayList<>();
        for (int i = 0; i < playerIds.size(); i++) {
            String pid = playerIds.get(i);
            Map<String, Object> seat = new LinkedHashMap<>();
            seat.put("seat", i);
            seat.put("playerId", pid);
            seat.put("name", nameById.get(pid));
            seats.add(seat);
        }
        return seats;
    }

    private void maybeFinishTournament(String tournamentId, String winnerPlayerId) {
        Map<String, Object> t = queryOne("SELECT type, table_size AS tableSize, status, config_json AS cfg FROM tournaments WHERE id = ?", tournamentId);
        if (t == null || "finished".equals(String.valueOf(t.get("status")))) return;
        String type = String.valueOf(t.get("type"));
        int tableSize = number(t.get("tableSize"), 2);
        int activePlayers = number(queryOne("SELECT COUNT(1) AS n FROM tournament_players WHERE tournament_id = ? AND dropped_at IS NULL", tournamentId).get("n"), 0);
        int finishedTablesR1 = number(queryOne("SELECT COUNT(1) AS n FROM tournament_tables tt JOIN tournament_rounds tr ON tr.id = tt.round_id WHERE tr.tournament_id = ? AND tr.round_index = 1 AND tt.status = 'finished'", tournamentId).get("n"), 0);
        if ("single_elim".equals(type) && tableSize == 2 && activePlayers == 2 && finishedTablesR1 >= 1) {
            finishTournament(tournamentId, winnerPlayerId, t.get("cfg"));
            return;
        }
        if ("single_elim".equals(type)) {
            Map<String, Object> lastRound = queryOne("SELECT MAX(round_index) AS maxRound FROM tournament_rounds WHERE tournament_id = ?", tournamentId);
            int roundIndex = number(lastRound == null ? null : lastRound.get("maxRound"), 0);
            if (roundIndex <= 0) return;
            List<Map<String, Object>> winners = query("SELECT winner_player_id AS winnerPlayerId FROM tournament_tables tt JOIN tournament_rounds tr ON tr.id = tt.round_id WHERE tr.tournament_id = ? AND tr.round_index = ? AND tt.status = 'finished'", tournamentId, roundIndex);
            Set<String> distinct = winners.stream().map(r -> blankToNull(Objects.toString(r.get("winnerPlayerId"), null))).filter(Objects::nonNull).collect(Collectors.toSet());
            if (distinct.size() == 1 && winners.size() == 1) {
                finishTournament(tournamentId, distinct.iterator().next(), t.get("cfg"));
            }
        }
    }

    private void finishTournament(String tournamentId, String winnerPlayerId, Object cfgJson) {
        String winnerName = null;
        if (winnerPlayerId != null) {
            Map<String, Object> row = queryOne("SELECT name FROM tournament_players WHERE tournament_id = ? AND player_id = ?", tournamentId, winnerPlayerId);
            winnerName = row == null ? null : blankToNull(Objects.toString(row.get("name"), null));
        }
        jdbc.update("UPDATE tournaments SET status = 'finished', finished_at = ? WHERE id = ?", nowMs(), tournamentId);
        Map<String, Object> cfg = JsonUtils.parseMap((String) cfgJson);
        cfg = new LinkedHashMap<>(cfg);
        Map<String, Object> winner = new LinkedHashMap<>();
        winner.put("playerId", winnerPlayerId);
        winner.put("name", winnerName);
        cfg.put("winner", winner);
        jdbc.update("UPDATE tournaments SET config_json = ? WHERE id = ?", JsonUtils.stringify(cfg), tournamentId);
    }

    private long insertRound(String tournamentId, int roundIndex, String status, long createdAt) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.update(con -> {
            PreparedStatement ps = con.prepareStatement("INSERT INTO tournament_rounds (tournament_id, round_index, status, created_at) VALUES (?, ?, ?, ?)", Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, tournamentId);
            ps.setInt(2, roundIndex);
            ps.setString(3, status);
            ps.setLong(4, createdAt);
            return ps;
        }, keyHolder);
        return Objects.requireNonNull(keyHolder.getKey()).longValue();
    }

    private long insertTable(String tournamentId, long roundId, int tableIndex, String status, Map<String, Object> payload) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.update(con -> {
            PreparedStatement ps = con.prepareStatement("INSERT INTO tournament_tables (tournament_id, round_id, table_index, match_id, status, winner_player_id, result_json) VALUES (?, ?, ?, NULL, ?, NULL, ?)", Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, tournamentId);
            ps.setLong(2, roundId);
            ps.setInt(3, tableIndex);
            ps.setString(4, status);
            ps.setString(5, JsonUtils.stringify(payload));
            return ps;
        }, keyHolder);
        return Objects.requireNonNull(keyHolder.getKey()).longValue();
    }

    private Map<String, Object> tableRowToDto(Map<String, Object> row) {
        Map<String, Object> res = JsonUtils.parseMap((String) row.get("resultJson"));
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", row.get("id"));
        dto.put("tableIndex", number(row.get("tableIndex"), 0));
        dto.put("matchId", row.get("matchId"));
        dto.put("status", row.get("status"));
        dto.put("winnerPlayerId", row.get("winnerPlayerId"));
        dto.put("seats", res.getOrDefault("seats", List.of()));
        dto.put("result", res.get("result"));
        return dto;
    }

    private List<Map<String, Object>> tableSeats(String resultJson) {
        Object seats = JsonUtils.parseMap(resultJson).get("seats");
        if (seats instanceof List<?> list) {
            List<Map<String, Object>> out = new ArrayList<>();
            for (Object item : list) {
                if (item instanceof Map<?, ?> m) {
                    Map<String, Object> copy = new LinkedHashMap<>();
                    for (Map.Entry<?, ?> e : m.entrySet()) copy.put(String.valueOf(e.getKey()), e.getValue());
                    out.add(copy);
                }
            }
            return out;
        }
        return List.of();
    }

    private Map<String, String> playerNamesById(String tournamentId) {
        return query("SELECT player_id AS playerId, name FROM tournament_players WHERE tournament_id = ? AND dropped_at IS NULL ORDER BY joined_at ASC", tournamentId)
            .stream().collect(Collectors.toMap(r -> String.valueOf(r.get("playerId")), r -> Objects.toString(r.get("name"), null), (a, b) -> a, LinkedHashMap::new));
    }

    private List<Map<String, Object>> seatify(List<Map<String, Object>> players) {
        List<Map<String, Object>> seats = new ArrayList<>();
        for (int i = 0; i < players.size(); i++) {
            Map<String, Object> p = players.get(i);
            Map<String, Object> seat = new LinkedHashMap<>();
            seat.put("seat", i);
            seat.put("playerId", p.get("playerId"));
            seat.put("name", p.get("name"));
            seats.add(seat);
        }
        return seats;
    }

    private void shuffle(List<Map<String, Object>> list) {
        Collections.shuffle(list, random);
    }

    private String lower(String value) {
        return value == null ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    private String blankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }

    private String substring(String value, int maxLen) {
        if (value == null) return null;
        return value.length() <= maxLen ? value : value.substring(0, maxLen);
    }

    private int number(Object value, int defaultValue) {
        if (value == null) return defaultValue;
        if (value instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(value)); } catch (Exception e) { return defaultValue; }
    }

    private double decimal(Object value, double defaultValue) {
        if (value == null) return defaultValue;
        if (value instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(String.valueOf(value)); } catch (Exception e) { return defaultValue; }
    }


    private Object firstNonNull(Object... values) {
        for (Object v : values) {
            if (v != null) return v;
        }
        return null;
    }

    private String firstNonBlank(Object... values) {
        for (Object v : values) {
            String s = v == null ? null : String.valueOf(v).trim();
            if (s != null && !s.isBlank()) return s;
        }
        return null;
    }

    public static class UnauthorizedException extends RuntimeException {
        public UnauthorizedException(String message) {
            super(message);
        }
    }
}
