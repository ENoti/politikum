
package com.politikum.service;

import com.politikum.util.JsonUtils;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class LiveMatchService {
    private final JdbcTemplate jdbc;
    private final GraalPolitikumEngine engine;
    private final PolitikumRepository repository;

    public LiveMatchService(JdbcTemplate jdbc, GraalPolitikumEngine engine, PolitikumRepository repository) {
        this.jdbc = jdbc;
        this.engine = engine;
        this.repository = repository;
        this.jdbc.execute("CREATE TABLE IF NOT EXISTS live_matches (match_id TEXT PRIMARY KEY, game_name TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, owner_player_id TEXT, tournament_id TEXT, table_id INTEGER, status TEXT NOT NULL, state_json TEXT NOT NULL, metadata_json TEXT NOT NULL)");
        this.jdbc.execute("CREATE INDEX IF NOT EXISTS idx_live_matches_status ON live_matches(status)");
        this.jdbc.execute("CREATE INDEX IF NOT EXISTS idx_live_matches_tournament ON live_matches(tournament_id, table_id)");
        this.jdbc.execute("CREATE INDEX IF NOT EXISTS idx_live_matches_updated_at ON live_matches(updated_at)");
    }

    public Map<String, Object> createMatch(int numPlayers, String ownerPlayerId, String hostName, String lobbyTitle) {
        int seats = Math.max(2, Math.min(5, numPlayers));
        String matchId = "m_" + Long.toString(repository.nowMs(), 36) + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        Map<String, Object> state = ensureState(engine.createMatchState(seats));
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("matchID", matchId);
        metadata.put("gameName", "politikum");
        Map<String, Object> setupData = new LinkedHashMap<>();
        if (hostName != null && !hostName.isBlank()) setupData.put("hostName", hostName.trim());
        if (lobbyTitle != null && !lobbyTitle.isBlank()) setupData.put("lobbyTitle", lobbyTitle.trim());
        metadata.put("setupData", setupData);
        metadata.put("players", buildInitialPlayers(state));
        metadata.put("ownerPlayerId", blankToNull(ownerPlayerId));
        metadata.put("createdAt", repository.nowMs());
        metadata.put("updatedAt", repository.nowMs());
        syncMetadataFromState(state, metadata);
        upsert(matchId, blankToNull(ownerPlayerId), null, null, statusOf(state), state, metadata, repository.nowMs(), repository.nowMs());
        return clientMatchView(loadRow(matchId));
    }

    public Map<String, Object> getMatch(String matchId) {
        Map<String, Object> row = loadRow(matchId);
        return row == null ? null : clientMatchView(row);
    }

    public Map<String, Object> getState(String matchId) {
        Map<String, Object> row = loadRow(matchId);
        if (row == null) return null;
        Map<String, Object> state = parseMap(row.get("state_json"));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("matchID", row.get("match_id"));
        out.put("state", state);
        out.put("metadata", clientMatchView(row));
        return out;
    }

    @Transactional
    public Map<String, Object> joinMatch(String matchId,
                                         String playerId,
                                         String playerName,
                                         String sessionPlayerId,
                                         String sessionEmail) {
        Map<String, Object> row = requireRow(matchId);
        Map<String, Object> state = ensureState(parseMap(row.get("state_json")));
        Map<String, Object> metadata = parseMap(row.get("metadata_json"));
        Map<String, Object> players = playersMap(metadata);
        String seatId = String.valueOf(playerId == null ? "" : playerId).trim();
        if (seatId.isBlank()) return error("playerID_required");
        Map<String, Object> seat = map(players.get(seatId));
        if (seat.isEmpty()) return error("seat_not_found");
        if (bool(seat.get("isBot"))) return error("seat_is_bot");
        Map<String, Object> seatData = map(seat.computeIfAbsent("data", k -> new LinkedHashMap<>()));
        String reservedPlayerId = blankToNull(string(seatData.get("playerId")));
        String stablePlayerId = blankToNull(sessionPlayerId);
        if (reservedPlayerId != null && stablePlayerId != null && !reservedPlayerId.equals(stablePlayerId)) return error("seat_reserved");
        if (reservedPlayerId != null && stablePlayerId == null) return error("seat_reserved_login_required");
        String desiredName = blankToNull(playerName);
        if (desiredName == null) desiredName = blankToNull(string(seat.get("reservedName")));
        if (desiredName == null) desiredName = blankToNull(string(seat.get("name")));
        if (desiredName == null) return error("playerName_required");

        String existingCredentials = blankToNull(string(seat.get("credentials")));
        boolean sameStableIdentity = stablePlayerId != null && stablePlayerId.equals(blankToNull(string(seatData.get("playerId"))));
        if (bool(seat.get("isConnected")) && existingCredentials != null && !sameStableIdentity) return error("seat_taken");

        boolean shouldSetName = true;
        try {
            List<Map<String, Object>> statePlayers = listMap(map(state.get("G")).get("players"));
            for (Map<String, Object> sp : statePlayers) {
                if (seatId.equals(string(sp.get("id"))) && desiredName.equals(blankToNull(string(sp.get("name")))) && bool(sp.get("active"))) {
                    shouldSetName = false;
                    break;
                }
            }
        } catch (Exception ignored) {}
        if (shouldSetName) {
            state = applyMoveOrThrow(state, seatId, "setPlayerName", List.of(desiredName));
        }
        if (stablePlayerId != null) {
            Map<String, Object> ident = new LinkedHashMap<>();
            ident.put("playerId", stablePlayerId);
            if (blankToNull(sessionEmail) != null) ident.put("email", sessionEmail.trim().toLowerCase(Locale.ROOT));
            state = applyMoveOrThrow(state, seatId, "setPlayerIdentity", List.of(ident));
            seatData.put("playerId", stablePlayerId);
            if (blankToNull(sessionEmail) != null) seatData.put("email", sessionEmail.trim().toLowerCase(Locale.ROOT));
        }

        String credentials = existingCredentials != null ? existingCredentials : UUID.randomUUID().toString().replace("-", "");
        seat.put("id", seatId);
        seat.put("name", desiredName);
        seat.put("isConnected", true);
        seat.put("credentials", credentials);
        seat.put("lastJoinedAt", repository.nowMs());
        metadata.put("players", players);
        syncMetadataFromState(state, metadata);
        String ownerPlayerId = blankToNull(string(metadata.get("ownerPlayerId")));
        upsert(matchId, ownerPlayerId, blankToNull(string(row.get("tournament_id"))), longOrNull(row.get("table_id")), statusOf(state), state, metadata, longNumber(row.get("created_at"), repository.nowMs()), repository.nowMs());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("matchID", matchId);
        out.put("playerID", seatId);
        out.put("playerCredentials", credentials);
        out.put("match", clientMatchView(loadRow(matchId)));
        return out;
    }

    @Transactional
    public Map<String, Object> applyMove(String matchId,
                                         String playerId,
                                         String credentials,
                                         String moveName,
                                         List<Object> args) {
        Map<String, Object> row = requireRow(matchId);
        Map<String, Object> metadata = parseMap(row.get("metadata_json"));
        Map<String, Object> players = playersMap(metadata);
        String move = string(moveName);
        String seatId = string(playerId);
        if (!isTickMove(move)) {
            Map<String, Object> seat = map(players.get(seatId));
            String expected = blankToNull(string(seat.get("credentials")));
            if (expected == null || !expected.equals(blankToNull(credentials))) return error("bad_credentials");
        } else {
            if (!hasAnyCredential(players, credentials)) return error("bad_credentials");
        }

        Map<String, Object> state = ensureState(parseMap(row.get("state_json")));
        Map<String, Object> engineRes = engine.applyMove(state, seatId, move, args == null ? List.of() : args);
        if (!bool(engineRes.get("ok"))) {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("ok", false);
            out.put("error", blankToNull(string(engineRes.get("error"))) == null ? "invalid_move" : string(engineRes.get("error")));
            out.put("message", engineRes.get("message"));
            out.put("currentPlayer", map(map(engineRes.get("state")).get("ctx")).get("currentPlayer"));
            out.put("pending", map(map(engineRes.get("state")).get("G")).get("pending"));
            out.put("response", map(map(engineRes.get("state")).get("G")).get("response"));
            return out;
        }
        Map<String, Object> nextState = ensureState(map(engineRes.get("state")));
        syncMetadataFromState(nextState, metadata);
        String status = statusOf(nextState);
        upsert(matchId, blankToNull(string(metadata.get("ownerPlayerId"))), blankToNull(string(row.get("tournament_id"))), longOrNull(row.get("table_id")), status, nextState, metadata, longNumber(row.get("created_at"), repository.nowMs()), repository.nowMs());
        if ("finished".equals(status)) {
            maybeFinalizeMatch(matchId, nextState, metadata, loadRow(matchId));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("state", nextState);
        return out;
    }



    public Map<String, Object> getOwnedMatches(String ownerPlayerId, int limit) {
        String owner = blankToNull(ownerPlayerId);
        if (owner == null) return Map.of("ok", true, "matches", List.of());
        int lim = Math.max(1, Math.min(100, limit));
        List<Map<String, Object>> rows = query(
            "SELECT * FROM live_matches WHERE owner_player_id = ? ORDER BY updated_at DESC LIMIT ?",
            owner, lim
        );
        List<Map<String, Object>> matches = rows.stream().map(this::clientMatchView).toList();
        return Map.of("ok", true, "matches", matches);
    }

    @Transactional
    public Map<String, Object> renameMatchOwner(String matchId, String ownerPlayerId, String lobbyTitle) {
        String owner = blankToNull(ownerPlayerId);
        String title = blankToNull(lobbyTitle);
        if (owner == null) return error("not_owner");
        if (title == null) return error("title_required");
        Map<String, Object> row = requireRow(matchId);
        Map<String, Object> metadata = parseMap(row.get("metadata_json"));
        String actualOwner = blankToNull(string(metadata.get("ownerPlayerId")));
        if (actualOwner == null) actualOwner = blankToNull(string(row.get("owner_player_id")));
        if (!owner.equals(actualOwner)) return error("not_owner");
        Map<String, Object> setupData = map(metadata.get("setupData"));
        setupData.put("lobbyTitle", title);
        metadata.put("setupData", setupData);
        upsert(
            matchId,
            actualOwner,
            blankToNull(string(row.get("tournament_id"))),
            longOrNull(row.get("table_id")),
            String.valueOf(row.get("status")),
            parseMap(row.get("state_json")),
            metadata,
            longNumber(row.get("created_at"), repository.nowMs()),
            repository.nowMs()
        );
        return Map.of("ok", true, "match", clientMatchView(loadRow(matchId)));
    }

    @Transactional
    public Map<String, Object> deleteMatchOwner(String matchId, String ownerPlayerId) {
        String owner = blankToNull(ownerPlayerId);
        if (owner == null) return error("not_owner");
        Map<String, Object> row = requireRow(matchId);
        Map<String, Object> metadata = parseMap(row.get("metadata_json"));
        String actualOwner = blankToNull(string(metadata.get("ownerPlayerId")));
        if (actualOwner == null) actualOwner = blankToNull(string(row.get("owner_player_id")));
        if (!owner.equals(actualOwner)) return error("not_owner");
        jdbc.update("UPDATE tournament_tables SET match_id = NULL WHERE match_id = ?", matchId);
        jdbc.update("DELETE FROM live_matches WHERE match_id = ?", matchId);
        return Map.of("ok", true, "deleted", true, "matchId", matchId);
    }

    public Map<String, Object> surrender(String matchId, String playerId, String credentials) {
        Map<String, Object> row = requireRow(matchId);
        Map<String, Object> metadata = parseMap(row.get("metadata_json"));
        Map<String, Object> players = playersMap(metadata);
        String seatId = string(playerId);
        Map<String, Object> seat = map(players.get(seatId));
        String expected = blankToNull(string(seat.get("credentials")));
        if (expected == null || !expected.equals(blankToNull(credentials))) return error("bad_credentials");

        Map<String, Object> state = ensureState(parseMap(row.get("state_json")));
        Map<String, Object> g = map(state.get("G"));
        Map<String, Object> ctx = map(state.get("ctx"));
        if (ctx.get("gameover") != null || bool(g.get("gameOver"))) return error("game_already_finished");

        String loserName = blankToNull(string(seat.get("name")));
        if (loserName == null) loserName = "Player " + seatId;
        seat.put("isActive", false);
        seat.put("isConnected", false);
        players.put(seatId, seat);

        List<Object> gPlayers = list(g.get("players"));
        for (Object obj : gPlayers) {
            Map<String, Object> gp = map(obj);
            if (seatId.equals(string(gp.get("id")))) {
                gp.put("active", false);
                gp.put("surrendered", true);
            }
        }
        g.put("players", gPlayers);

        List<Object> activeIds = list(g.get("activePlayerIds"));
        List<Object> filteredActive = new ArrayList<>();
        for (Object idObj : activeIds) {
            String id = string(idObj);
            if (seatId.equals(id)) continue;
            if (id == null || id.isBlank()) continue;
            Map<String, Object> otherSeat = map(players.get(id));
            if (bool(otherSeat.get("isActive")) || bool(otherSeat.get("isConnected")) || bool(otherSeat.get("isBot"))) {
                filteredActive.add(id);
            }
        }
        g.put("activePlayerIds", filteredActive);

        List<Object> log = list(g.get("log"));
        log.add(loserName + " сдался, но партия продолжается.");
        g.put("log", log);

        String winnerSeatId = null;
        String winnerName = null;
        if (filteredActive.size() <= 1) {
            if (!filteredActive.isEmpty()) {
                winnerSeatId = string(filteredActive.get(0));
                Map<String, Object> otherSeat = map(players.get(winnerSeatId));
                winnerName = blankToNull(string(otherSeat.get("name")));
                if (winnerName == null) winnerName = "Player " + winnerSeatId;
            }
            g.put("gameOver", true);
            Map<String, Object> gameover = new LinkedHashMap<>();
            gameover.put("reason", "surrender");
            gameover.put("loserPlayerId", seatId);
            gameover.put("loserName", loserName);
            if (winnerSeatId != null) gameover.put("winnerPlayerId", winnerSeatId);
            if (winnerName != null) gameover.put("winnerName", winnerName);
            ctx.put("gameover", gameover);
        } else {
            g.put("gameOver", false);
            if (seatId.equals(string(ctx.get("currentPlayer")))) {
                int pos = -1;
                for (int i = 0; i < filteredActive.size(); i++) {
                    if (seatId.equals(string(filteredActive.get(i)))) { pos = i; break; }
                }
                String nextId = string(filteredActive.get(0));
                ctx.put("currentPlayer", nextId);
                try {
                    ctx.put("playOrderPos", Integer.parseInt(nextId));
                } catch (Exception ignored) {}
            }
        }

        state.put("G", g);
        state.put("ctx", ctx);

        syncMetadataFromState(state, metadata);
        upsert(matchId,
                blankToNull(string(metadata.get("ownerPlayerId"))),
                blankToNull(string(row.get("tournament_id"))),
                longOrNull(row.get("table_id")),
                bool(g.get("gameOver")) ? "finished" : "in_progress",
                state,
                metadata,
                longNumber(row.get("created_at"), repository.nowMs()),
                repository.nowMs());
        if (bool(g.get("gameOver"))) {
            maybeFinalizeMatch(matchId, state, metadata, loadRow(matchId));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("state", state);
        out.put("surrendered", true);
        out.put("gameContinues", !bool(g.get("gameOver")));
        return out;
    }

    public Map<String, Object> getPublicOpenMatches(int limit) {
        int lim = Math.max(1, Math.min(100, limit));
        List<Map<String, Object>> rows = query("SELECT * FROM live_matches WHERE status IN ('lobby','in_progress') ORDER BY updated_at DESC LIMIT ?", lim);
        List<Map<String, Object>> matches = rows.stream().map(this::clientMatchView).collect(Collectors.toList());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("matches", matches);
        return out;
    }

    public Map<String, Object> getAdminSummary() {
        Map<String, Object> base = new LinkedHashMap<>(repository.getAdminSummary());
        base.put("liveInProgressTotal", number(queryOne("SELECT COUNT(1) AS n FROM live_matches WHERE status = 'in_progress'").get("n"), 0));
        base.put("liveLobbyTotal", number(queryOne("SELECT COUNT(1) AS n FROM live_matches WHERE status = 'lobby'").get("n"), 0));
        base.put("supportsLiveMatches", true);
        return base;
    }

    public Map<String, Object> getAdminMatches(int limit) {
        int lim = Math.max(1, Math.min(100, limit));
        List<Map<String, Object>> rows = query("SELECT * FROM live_matches WHERE status <> 'killed' ORDER BY updated_at DESC LIMIT ?", lim);
        List<Map<String, Object>> items = rows.stream().map(row -> {
            Map<String, Object> view = clientMatchView(row);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("matchID", view.get("matchID"));
            item.put("matchId", view.get("matchID"));
            item.put("status", view.get("status"));
            item.put("tournamentId", row.get("tournament_id"));
            item.put("tableId", row.get("table_id"));
            item.put("players", view.get("players"));
            item.put("createdAt", view.get("createdAt"));
            item.put("updatedAt", view.get("updatedAt"));
            return item;
        }).collect(Collectors.toList());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("items", items);
        out.put("total", items.size());
        out.put("supportsLiveMatches", true);
        return out;
    }

    public Map<String, Object> getAdminMatchLog(String matchId, int limit) {
        Map<String, Object> row = requireRow(matchId);
        Map<String, Object> state = ensureState(parseMap(row.get("state_json")));
        Map<String, Object> g = map(state.get("G"));
        Map<String, Object> ctx = map(state.get("ctx"));
        List<Object> log = list(g.get("log"));
        List<Object> trace = list(g.get("trace"));
        int lim = Math.max(1, Math.min(1000, limit));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("matchId", matchId);
        out.put("foundInStorage", true);
        out.put("supportsLiveMatches", true);
        out.put("limit", lim);
        out.put("fetchError", null);
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("createdAt", row.get("created_at"));
        meta.put("updatedAt", row.get("updated_at"));
        meta.put("gameover", ctx.get("gameover"));
        out.put("meta", meta);
        out.put("ctx", ctx);
        out.put("pending", g.get("pending"));
        out.put("response", g.get("response"));
        out.put("log", log.size() <= lim ? log : log.subList(Math.max(0, log.size() - lim), log.size()));
        out.put("logTotal", log.size());
        out.put("trace", trace.size() <= lim ? trace : trace.subList(Math.max(0, trace.size() - lim), trace.size()));
        out.put("traceTotal", trace.size());
        return out;
    }

    @Transactional
    public Map<String, Object> killMatch(String matchId) {
        Map<String, Object> row = requireRow(matchId);
        jdbc.update("UPDATE live_matches SET status = 'killed', updated_at = ? WHERE match_id = ?", repository.nowMs(), matchId);
        jdbc.update("UPDATE tournament_tables SET status = CASE WHEN status = 'finished' THEN status ELSE 'canceled' END, match_id = NULL WHERE match_id = ?", matchId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("matchId", matchId);
        out.put("deletedGames", 0);
        out.put("updatedTables", 0);
        out.put("supportsLiveMatches", true);
        out.put("previousStatus", row.get("status"));
        return out;
    }

    @Transactional
    public Map<String, Object> killMatchOwner(String matchId, String sessionPlayerId) {
        Map<String, Object> row = requireRow(matchId);
        Map<String, Object> metadata = parseMap(row.get("metadata_json"));
        String owner = blankToNull(string(metadata.get("ownerPlayerId")));
        if (owner == null) owner = blankToNull(string(row.get("owner_player_id")));
        if (owner == null) {
            Map<String, Object> seat0 = map(playersMap(metadata).get("0"));
            owner = blankToNull(string(map(seat0.get("data")).get("playerId")));
        }
        if (owner == null || !owner.equals(blankToNull(sessionPlayerId))) return error("not_owner");
        return killMatch(matchId);
    }

    @Transactional
    public Map<String, Object> createTournamentMatch(String tournamentId, long tableId, String actorName, boolean publicCheck) {
        Map<String, Object> table = repository.tournamentTableGet(tournamentId, tableId);
        if (table == null) return error("not_found");
        if (blankToNull(string(table.get("matchId"))) != null) {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("ok", true);
            out.put("matchId", table.get("matchId"));
            out.put("alreadyExists", true);
            return out;
        }
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> seats = (List<Map<String, Object>>) table.getOrDefault("seats", List.of());
        int numPlayers = Math.max(2, seats.isEmpty() ? 2 : seats.size());
        String matchId = "t_" + tournamentId + "_" + tableId + "_" + Long.toString(repository.nowMs(), 36);
        Map<String, Object> state = ensureState(engine.createMatchState(numPlayers));
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("matchID", matchId);
        metadata.put("gameName", "politikum");
        metadata.put("createdAt", repository.nowMs());
        metadata.put("updatedAt", repository.nowMs());
        metadata.put("setupData", actorName == null || actorName.isBlank() ? new LinkedHashMap<>() : mapOfNonNull("hostName", actorName.trim()));
        metadata.put("ownerPlayerId", null);
        metadata.put("tournament", mapOfTournament(tournamentId, tableId));
        Map<String, Object> players = buildInitialPlayers(state);
        for (int i = 0; i < seats.size(); i++) {
            Map<String, Object> seatInfo = seats.get(i);
            Map<String, Object> seat = map(players.computeIfAbsent(String.valueOf(i), k -> new LinkedHashMap<>()));
            Map<String, Object> data = map(seat.computeIfAbsent("data", k -> new LinkedHashMap<>()));
            if (blankToNull(string(seatInfo.get("playerId"))) != null) data.put("playerId", String.valueOf(seatInfo.get("playerId")));
            if (blankToNull(string(seatInfo.get("name"))) != null) seat.put("reservedName", String.valueOf(seatInfo.get("name")));
        }
        metadata.put("players", players);
        syncMetadataFromState(state, metadata);
        upsert(matchId, null, tournamentId, tableId, statusOf(state), state, metadata, repository.nowMs(), repository.nowMs());
        jdbc.update("UPDATE tournament_tables SET match_id = ?, status = 'ready' WHERE tournament_id = ? AND id = ?", matchId, tournamentId, tableId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("matchId", matchId);
        out.put("backend", "java");
        out.put("placeholder", false);
        return out;
    }

    @Transactional
    public Map<String, Object> syncTournamentResult(String tournamentId, long tableId) {
        Map<String, Object> table = repository.tournamentTableGet(tournamentId, tableId);
        if (table == null) return error("not_found");
        String matchId = blankToNull(string(table.get("matchId")));
        if (matchId == null) return error("match_missing");
        Map<String, Object> row = requireRow(matchId);
        if (!"finished".equals(String.valueOf(row.get("status")))) return error("match_not_finished");
        Map<String, Object> state = ensureState(parseMap(row.get("state_json")));
        Map<String, Object> metadata = parseMap(row.get("metadata_json"));
        Map<String, Object> ctx = map(state.get("ctx"));
        String winnerSeat = blankToNull(string(map(ctx.get("gameover")).get("winnerPlayerId")));
        String winnerName = blankToNull(string(map(ctx.get("gameover")).get("winnerName")));
        String winnerPlayerId = winnerSeat;
        if (winnerSeat != null) {
            Map<String, Object> seat = map(playersMap(metadata).get(winnerSeat));
            winnerPlayerId = blankToNull(string(map(seat.get("data")).get("playerId")));
            if (winnerPlayerId == null) winnerPlayerId = winnerSeat;
            if (winnerName == null) winnerName = blankToNull(string(seat.get("name")));
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("matchId", matchId);
        result.put("finishedAt", row.get("updated_at"));
        result.put("winnerPlayerId", winnerPlayerId);
        result.put("winnerName", winnerName);
        result.put("seats", clientPlayersList(metadata));
        result.put("syncedFromLiveMatch", true);
        Map<String, Object> out = repository.tournamentTableSetResult(tournamentId, tableId, winnerPlayerId, result);
        try { repository.tournamentGenerateNextRound(tournamentId); } catch (Exception ignored) {}
        return out;
    }

    private Map<String, Object> applyMoveOrThrow(Map<String, Object> state, String playerId, String move, List<Object> args) {
        Map<String, Object> res = engine.applyMove(state, playerId, move, args);
        if (!bool(res.get("ok"))) throw new IllegalStateException(string(res.get("error")) + (blankToNull(string(res.get("message"))) == null ? "" : (": " + string(res.get("message")))));
        return ensureState(map(res.get("state")));
    }

    private void maybeFinalizeMatch(String matchId, Map<String, Object> state, Map<String, Object> metadata, Map<String, Object> row) {
        if (queryOne("SELECT id FROM games WHERE match_id = ?", matchId) != null) return;
        Map<String, Object> ctx = map(state.get("ctx"));
        Map<String, Object> gameover = map(ctx.get("gameover"));
        String winnerSeat = blankToNull(string(gameover.get("winnerPlayerId")));
        String winnerName = blankToNull(string(gameover.get("winnerName")));
        String winnerPlayerId = winnerSeat;
        if (winnerSeat != null) {
            Map<String, Object> seat = map(playersMap(metadata).get(winnerSeat));
            winnerPlayerId = blankToNull(string(map(seat.get("data")).get("playerId")));
            if (winnerPlayerId == null) winnerPlayerId = winnerSeat;
            if (winnerName == null) winnerName = blankToNull(string(seat.get("name")));
        }

        List<Map<String, Object>> players = clientPlayersList(metadata).stream()
            .filter(p -> bool(p.get("isActive")) || bool(p.get("isBot")) || blankToNull(string(map(p.get("data")).get("playerId"))) != null)
            .collect(Collectors.toList());
        int numPlayers = players.size();
        int numBots = (int) players.stream().filter(p -> bool(p.get("isBot"))).count();
        String resultJson = JsonUtils.stringify(mapOfStateResult(state, metadata));
        long createdAt = longNumber(row.get("created_at"), repository.nowMs());
        long finishedAt = longNumber(row.get("updated_at"), repository.nowMs());
        KeyHolder keyHolder = new GeneratedKeyHolder();
        String finalWinnerPlayerId = winnerPlayerId;
        String finalWinnerName = winnerName;
        jdbc.update(con -> {
            PreparedStatement ps = con.prepareStatement("INSERT INTO games (match_id, created_at, finished_at, duration_ms, app_version, engine_version, num_players, num_bots, winner_player_id, winner_name, result_json, elo_applied) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)", Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, matchId);
            ps.setLong(2, createdAt);
            ps.setLong(3, finishedAt);
            ps.setLong(4, Math.max(0, finishedAt - createdAt));
            ps.setString(5, null);
            ps.setString(6, "graaljs");
            ps.setInt(7, numPlayers);
            ps.setInt(8, numBots);
            ps.setString(9, finalWinnerPlayerId);
            ps.setString(10, finalWinnerName);
            ps.setString(11, resultJson);
            return ps;
        }, keyHolder);
        Number gameId = keyHolder.getKey();
        if (gameId == null) return;
        for (Map<String, Object> p : players) {
            String stableId = blankToNull(string(map(p.get("data")).get("playerId")));
            if (stableId == null) stableId = string(p.get("id"));
            String name = blankToNull(string(p.get("name")));
            boolean isBot = bool(p.get("isBot"));
            jdbc.update("INSERT OR IGNORE INTO game_players (game_id, player_id, name, is_bot) VALUES (?, ?, ?, ?)", gameId.longValue(), stableId, name, isBot ? 1 : 0);
            if (!isBot && blankToNull(stableId) != null) {
                jdbc.update("INSERT INTO ratings (player_id, rating, rd, vol, games_played, wins, updated_at) VALUES (?, 1000, 350, 0.06, 0, 0, ?) ON CONFLICT(player_id) DO NOTHING", stableId, finishedAt);
                jdbc.update("UPDATE ratings SET games_played = games_played + 1, wins = wins + ?, updated_at = ? WHERE player_id = ?", Objects.equals(stableId, winnerPlayerId) ? 1 : 0, finishedAt, stableId);
            }
        }
        String tournamentId = blankToNull(string(row.get("tournament_id")));
        Long tableId = longOrNull(row.get("table_id"));
        if (tournamentId != null && tableId != null) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("matchId", matchId);
            result.put("finishedAt", finishedAt);
            result.put("winnerPlayerId", winnerPlayerId);
            result.put("winnerName", winnerName);
            result.put("seats", clientPlayersList(metadata));
            result.put("syncedFromLiveMatch", true);
            repository.tournamentTableSetResult(tournamentId, tableId, winnerPlayerId, result);
            try { repository.tournamentGenerateNextRound(tournamentId); } catch (Exception ignored) {}
        }
    }

    private Map<String, Object> mapOfStateResult(Map<String, Object> state, Map<String, Object> metadata) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("state", state);
        out.put("metadata", clientMatchView(metadata, null));
        return out;
    }

    private void upsert(String matchId,
                        String ownerPlayerId,
                        String tournamentId,
                        Long tableId,
                        String status,
                        Map<String, Object> state,
                        Map<String, Object> metadata,
                        long createdAt,
                        long updatedAt) {
        metadata.put("updatedAt", updatedAt);
        jdbc.update("INSERT INTO live_matches (match_id, game_name, created_at, updated_at, owner_player_id, tournament_id, table_id, status, state_json, metadata_json) VALUES (?, 'politikum', ?, ?, ?, ?, ?, ?, ?, ?) " +
                "ON CONFLICT(match_id) DO UPDATE SET updated_at = excluded.updated_at, owner_player_id = excluded.owner_player_id, tournament_id = excluded.tournament_id, table_id = excluded.table_id, status = excluded.status, state_json = excluded.state_json, metadata_json = excluded.metadata_json",
            matchId, createdAt, updatedAt, ownerPlayerId, tournamentId, tableId, status, JsonUtils.stringify(state), JsonUtils.stringify(metadata));
    }

    private String statusOf(Map<String, Object> state) {
        Map<String, Object> ctx = map(state.get("ctx"));
        Map<String, Object> g = map(state.get("G"));
        if (ctx.get("gameover") != null || bool(g.get("gameOver"))) return "finished";
        return "lobby".equals(String.valueOf(ctx.getOrDefault("phase", "lobby"))) ? "lobby" : "in_progress";
    }

    private Map<String, Object> clientMatchView(Map<String, Object> row) {
        if (row == null) return null;
        return clientMatchView(parseMap(row.get("metadata_json")), row);
    }

    private Map<String, Object> clientMatchView(Map<String, Object> metadata, Map<String, Object> row) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("matchID", metadata.get("matchID"));
        out.put("matchId", metadata.get("matchID"));
        out.put("gameName", metadata.getOrDefault("gameName", "politikum"));
        out.put("setupData", map(metadata.get("setupData")));
        out.put("ownerPlayerId", blankToNull(string(metadata.get("ownerPlayerId"))));
        out.put("players", clientPlayersList(metadata));
        out.put("createdAt", row == null ? metadata.get("createdAt") : row.get("created_at"));
        out.put("updatedAt", row == null ? metadata.get("updatedAt") : row.get("updated_at"));
        out.put("status", row == null ? metadata.get("status") : row.get("status"));
        out.put("gameover", "finished".equals(String.valueOf(row == null ? metadata.get("status") : row.get("status"))));
        return out;
    }

    private List<Map<String, Object>> clientPlayersList(Map<String, Object> metadata) {
        return playersMap(metadata).values().stream()
            .map(this::map)
            .sorted(Comparator.comparingInt(m -> number(m.get("id"), 0)))
            .collect(Collectors.toList());
    }

    private Map<String, Object> buildInitialPlayers(Map<String, Object> state) {
        Map<String, Object> players = new LinkedHashMap<>();
        for (Map<String, Object> sp : listMap(map(state.get("G")).get("players"))) {
            String id = string(sp.get("id"));
            Map<String, Object> seat = new LinkedHashMap<>();
            seat.put("id", id);
            seat.put("name", null);
            seat.put("isConnected", false);
            seat.put("isBot", bool(sp.get("isBot")));
            seat.put("isActive", bool(sp.get("active")));
            seat.put("data", new LinkedHashMap<>());
            players.put(id, seat);
        }
        return players;
    }

    private void syncMetadataFromState(Map<String, Object> state, Map<String, Object> metadata) {
        Map<String, Object> players = playersMap(metadata);
        for (Map<String, Object> sp : listMap(map(state.get("G")).get("players"))) {
            String id = string(sp.get("id"));
            Map<String, Object> seat = map(players.computeIfAbsent(id, k -> new LinkedHashMap<>()));
            seat.put("id", id);
            seat.put("isBot", bool(sp.get("isBot")));
            seat.put("isActive", bool(sp.get("active")));
            seat.putIfAbsent("isConnected", false);
            seat.computeIfAbsent("data", k -> new LinkedHashMap<>());
            String stateName = blankToNull(string(sp.get("name")));
            if (stateName != null) {
                boolean connected = bool(seat.get("isConnected"));
                boolean bot = bool(sp.get("isBot"));
                boolean defaultHumanPlaceholder = stateName.startsWith("[H] Seat") || "You".equals(stateName);
                if (bot || (connected && !defaultHumanPlaceholder)) {
                    seat.put("name", stateName);
                }
            }
            Map<String, Object> ident = map(sp.get("identity"));
            if (!ident.isEmpty()) {
                Map<String, Object> data = map(seat.get("data"));
                if (blankToNull(string(ident.get("playerId"))) != null) data.put("playerId", ident.get("playerId"));
                if (blankToNull(string(ident.get("email"))) != null) data.put("email", ident.get("email"));
            }
        }
        metadata.put("players", players);
        metadata.put("status", statusOf(state));
    }

    private boolean isTickMove(String move) {
        return "tick".equals(move) || "tickBot".equals(move);
    }

    private boolean hasAnyCredential(Map<String, Object> players, String credentials) {
        String cred = blankToNull(credentials);
        if (cred == null) return false;
        return players.values().stream().map(this::map).anyMatch(p -> cred.equals(blankToNull(string(p.get("credentials")))));
    }

    private Map<String, Object> requireRow(String matchId) {
        Map<String, Object> row = loadRow(matchId);
        if (row == null) throw new NoSuchElementException("match_not_found");
        return row;
    }

    private Map<String, Object> loadRow(String matchId) {
        return queryOne("SELECT match_id, game_name, created_at, updated_at, owner_player_id, tournament_id, table_id, status, state_json, metadata_json FROM live_matches WHERE match_id = ?", matchId);
    }

    private Map<String, Object> queryOne(String sql, Object... args) {
        List<Map<String, Object>> rows = query(sql, args);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private List<Map<String, Object>> query(String sql, Object... args) {
        return jdbc.queryForList(sql, args).stream().map(LinkedHashMap::new).collect(Collectors.toList());
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> map(Object raw) {
        if (raw instanceof Map<?, ?>) {
            @SuppressWarnings("unchecked")
            Map<String, Object> cast = (Map<String, Object>) raw;
            return cast;
        }
        return new LinkedHashMap<>();
    }

    private Map<String, Object> ensureState(Map<String, Object> state) {
        Map<String, Object> out = new LinkedHashMap<>(state == null ? Map.of() : state);
        out.computeIfAbsent("G", k -> new LinkedHashMap<>());
        out.computeIfAbsent("ctx", k -> new LinkedHashMap<>());
        Map<String, Object> ctx = map(out.get("ctx"));
        ctx.putIfAbsent("phase", "lobby");
        ctx.putIfAbsent("currentPlayer", "0");
        ctx.putIfAbsent("turn", 0);
        out.put("ctx", ctx);
        return out;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> listMap(Object raw) {
        if (!(raw instanceof List<?> list)) return new ArrayList<>();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object item : list) out.add(map(item));
        return out;
    }

    @SuppressWarnings("unchecked")
    private List<Object> list(Object raw) {
        if (raw instanceof List<?> list) return new ArrayList<>(list);
        return new ArrayList<>();
    }

    private Map<String, Object> playersMap(Map<String, Object> metadata) {
        Map<String, Object> out = map(metadata.get("players"));
        metadata.put("players", out);
        return out;
    }

    private Map<String, Object> parseMap(Object json) {
        return json == null ? new LinkedHashMap<>() : new LinkedHashMap<>(JsonUtils.parseMap(String.valueOf(json)));
    }

    private String string(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private String blankToNull(String value) {
        if (value == null) return null;
        String s = value.trim();
        return s.isEmpty() ? null : s;
    }

    private boolean bool(Object value) {
        if (value instanceof Boolean b) return b;
        return "true".equalsIgnoreCase(String.valueOf(value)) || "1".equals(String.valueOf(value));
    }

    private int number(Object value, int dflt) {
        if (value instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(value)); } catch (Exception ignored) { return dflt; }
    }

    private long longNumber(Object value, long dflt) {
        if (value instanceof Number n) return n.longValue();
        try { return Long.parseLong(String.valueOf(value)); } catch (Exception ignored) { return dflt; }
    }

    private Long longOrNull(Object value) {
        try {
            if (value == null) return null;
            return Long.parseLong(String.valueOf(value));
        } catch (Exception ignored) {
            return null;
        }
    }

    private Map<String, Object> error(String code) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", false);
        out.put("error", code);
        return out;
    }

    private Map<String, Object> mapOfNonNull(String key, Object value) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (value != null) out.put(key, value);
        return out;
    }

    private Map<String, Object> mapOfTournament(String tournamentId, long tableId) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", tournamentId);
        out.put("tableId", tableId);
        return out;
    }
}
