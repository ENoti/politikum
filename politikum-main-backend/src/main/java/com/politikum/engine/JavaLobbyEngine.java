package com.politikum.engine;

import com.politikum.util.JsonUtils;
import java.time.Clock;
import java.util.*;
import java.util.function.DoubleSupplier;
import static com.politikum.engine.GameState.*;

/** Native match setup, seat management, chat and initial deal. No Graal dependency. */
public final class JavaLobbyEngine implements GameEngine {
    private static final Set<String> MOVES = Set.of("setPlayerIdentity", "setPlayerName", "addBot", "removePlayer", "submitChat", "startGame");
    private final CardCatalog catalog;
    private final Clock clock;
    private final DoubleSupplier random;
    public JavaLobbyEngine(CardCatalog catalog, Clock clock, DoubleSupplier random) {
        this.catalog = catalog; this.clock = clock; this.random = random;
    }
    public boolean supports(String move) { return MOVES.contains(move); }
    private <T> List<T> shuffle(List<T> source) {
        List<T> shuffled = new ArrayList<>(source);
        for (int i = shuffled.size() - 1; i > 0; i--) Collections.swap(shuffled, i, (int) (random.getAsDouble() * (i + 1)));
        return shuffled;
    }
    @Override public Map<String, Object> createMatchState(int count) {
        if (count < 2 || count > 5) throw new IllegalArgumentException("numPlayers must be between 2 and 5");
        List<Map<String, Object>> players = new ArrayList<>();
        Map<String, Object> scores = new LinkedHashMap<>();
        for (int i = 0; i < count; i++) {
            String id = String.valueOf(i);
            players.add(object("id", id, "name", i == 0 ? "You" : "[H] Seat " + id, "hand", new ArrayList<>(),
                "coalition", new ArrayList<>(), "isBot", false, "active", i == 0));
            scores.put(id, 0);
        }
        List<Map<String, Object>> pre = catalog.materialize("persona"); pre.addAll(catalog.materialize("action"));
        Map<String, Object> g = object("players", players, "deck", new ArrayList<>(), "discard", new ArrayList<>(),
            "preDealDeck", shuffle(pre), "eventDeck", shuffle(catalog.materialize("event")),
            "activePlayerIds", new ArrayList<>(List.of("0")), "log", new ArrayList<>(List.of("Politikum: lobby opened.")),
            "chat", new ArrayList<>(), "history", new ArrayList<>(List.of(object("turn", 0, "scores", scores))),
            "pending", null, "response", null, "botNextActAtMs", null, "botPauseUntilMs", null);
        resetTurn(g);
        return object("G", g, "ctx", object("numPlayers", count, "phase", "lobby", "currentPlayer", "0", "playOrderPos", 0, "turn", 0, "gameover", null), "_stateID", 0);
    }
    @Override public Map<String, Object> applyMove(Map<String, Object> input, String actor, String move, List<Object> arguments) {
        GameState s = new GameState(input);
        if (s.finished()) return object("ok", false, "error", "gameover", "state", input);
        if (!supports(move)) return object("ok", false, "error", "unknown_move", "state", input);
        List<Object> args = arguments == null ? List.of() : arguments;
        if ((!move.equals("submitChat") && !s.phase().equals("lobby")) || !execute(s, actor, move, args)) {
            return object("ok", false, "error", "invalid_move", "state", input);
        }
        Map<String, Object> previous = map(input.get("ctx"));
        String summary = JsonUtils.stringify(args);
        List<Object> trace = list(s.game().get("trace"));
        trace.add(object("ts", clock.millis(), "turn", previous.get("turn"), "phase", previous.get("phase"),
            "currentPlayer", previous.get("currentPlayer"), "playerID", actor, "move", move,
            "args", summary.length() > 180 ? summary.substring(0, 180) + "…" : summary, "result", "ok",
            "pending", map(map(input.get("G")).get("pending")).getOrDefault("kind", ""),
            "response", map(map(input.get("G")).get("response")).getOrDefault("kind", "")));
        if (trace.size() > 300) trace = new ArrayList<>(trace.subList(trace.size() - 300, trace.size()));
        s.game().put("trace", trace);
        s.advanceVersion();
        return object("ok", true, "state", s.value());
    }
    private boolean execute(GameState s, String actor, String move, List<Object> args) {
        Map<String, Object> g = s.game(), player = s.player(actor);
        Object arg = args.isEmpty() ? null : args.get(0);
        switch (move) {
            case "setPlayerIdentity" -> {
                String id = text(map(arg).get("playerId")).trim();
                if (player == null || id.isEmpty()) return false;
                Object email = map(arg).get("email");
                player.put("identity", object("playerId", id, "email", email == null ? null : text(email).trim().toLowerCase(Locale.ROOT)));
            }
            case "setPlayerName" -> {
                String name = text(arg).trim(); if (player == null || name.isEmpty()) return false;
                player.put("name", name); player.put("isBot", false); player.put("active", true);
                updateActive(g, actor, true); log(g, who(name) + " готов.");
            }
            case "addBot" -> {
                if (!actor.equals("0")) return false;
                Map<String, Object> seat = s.players().stream().filter(p -> !"0".equals(p.get("id")) && !truthy(p.get("active"))).findFirst().orElse(null);
                if (seat == null) return false;
                String name = "[B] " + catalog.botNames().get((int) (random.getAsDouble() * catalog.botNames().size()));
                seat.put("isBot", true); seat.put("active", true); seat.put("name", name);
                updateActive(g, String.valueOf(seat.get("id")), true); log(g, name + " присоединился.");
            }
            case "removePlayer" -> {
                String target = text(arg); Map<String, Object> seat = s.player(target);
                if (!actor.equals("0") || target.equals("0") || seat == null) return false;
                seat.put("isBot", false); seat.put("active", false); seat.put("name", "[H] Seat " + target);
                updateActive(g, target, false); log(g, "Место " + target + " освобождено.");
            }
            case "submitChat" -> {
                String message = text(arg).trim(); if (message.isEmpty()) return false;
                List<Object> chat = list(g.get("chat"));
                String sender = args.size() > 1 ? text(args.get(1)) : "";
                chat.add(object("sender", sender.isEmpty() ? "Anon" : sender, "text", message));
                g.put("chat", new ArrayList<>(chat.subList(Math.max(0, chat.size() - 80), chat.size())));
            }
            case "startGame" -> { return start(s, actor); }
            default -> { return false; }
        }
        return true;
    }
    private boolean start(GameState s, String actor) {
        if (!actor.equals("0")) return false;
        Map<String, Object> g = s.game();
        List<String> active = GameState.<String>list(g.get("activePlayerIds")).stream().filter(id -> s.player(id) != null && truthy(s.player(id).get("active"))).toList();
        if (active.size() < 2) return false;
        GameState.<Object>list(g.get("chat")).add(object("sender", "System", "text", "Game starting: " + String.join(", ", active.stream().map(id -> String.valueOf(s.player(id).get("name"))).toList())));
        for (Map<String, Object> p : s.players()) { p.put("hand", new ArrayList<>()); p.put("coalition", new ArrayList<>()); }
        List<Object> pre = shuffle(list(g.get("preDealDeck"))), events = shuffle(list(g.get("eventDeck")));
        for (int k = 0; k < 5; k++) for (String id : active) {
            if (pre.isEmpty()) break;
            GameState.<Object>list(s.player(id).get("hand")).add(pre.remove(0));
        }
        pre.addAll(events); g.put("deck", shuffle(pre)); g.put("discard", new ArrayList<>());
        for (String key : List.of("pending", "response", "winnerId", "roundEndTurn", "lastEvent", "lastEventOwnerId", "lastAction")) g.put(key, null);
        g.put("lastEventSequence", 0);
        g.put("gameOver", false); g.put("roundEnding", false); resetTurn(g);
        g.put("activePlayerIds", ordered(active));
        Map<String, Object> scores = new LinkedHashMap<>(); s.players().forEach(p -> scores.put(String.valueOf(p.get("id")), 0));
        // The legacy setPhase + endTurn records the initial empty-coalition score twice.
        g.put("history", new ArrayList<>(List.of(object("turn", 0, "scores", scores), object("turn", s.turn(), "scores", new LinkedHashMap<>(scores)))));
        log(g, "Politikum: старт игры — игроков: " + active.size() + ".");
        long turn = s.turn() + 1;
        s.context().put("phase", "action"); s.context().put("currentPlayer", "0");
        s.context().put("playOrderPos", 0); s.context().put("turn", turn);
        g.put("turnStartedAtMs", clock.millis()); g.put("turnN", turn); g.put("botNextActAtMs", null);
        Map<String, Object> host = s.player("0");
        if (truthy(host.get("skipMandatoryDrawThisTurn"))) {
            host.put("skipMandatoryDrawThisTurn", false); g.put("hasDrawn", true);
            log(g, who(text(host.get("name"))) + " пропускает обязательный добор в начале хода.");
        }
        return true;
    }
    private static void resetTurn(Map<String, Object> g) {
        g.put("hasDrawn", false); g.put("hasPlayed", false); g.put("playsThisTurn", 0);
        g.put("maxPlaysThisTurn", 1); g.put("playVpDelta", 0); g.put("drawsThisTurn", 0);
    }
    private static void updateActive(Map<String, Object> g, String id, boolean add) {
        Set<String> ids = new HashSet<>(list(g.get("activePlayerIds")));
        if (add) ids.add(id); else ids.remove(id);
        g.put("activePlayerIds", ordered(ids));
    }
    private static List<String> ordered(Collection<String> ids) {
        List<String> result = new ArrayList<>(); result.add("0");
        ids.stream().filter(id -> !id.equals("0")).distinct().sorted(Comparator.comparingInt(Integer::parseInt)).forEach(result::add);
        return result;
    }
    private static void log(Map<String, Object> g, String text) { GameState.<String>list(g.get("log")).add(text); }
    private static String text(Object value) { return truthy(value) ? String.valueOf(value) : ""; }
    private static String who(String name) { return name.equals("You") ? "Вы" : name; }
}
