package com.politikum.engine;

import java.time.Clock;
import java.util.*;
import static com.politikum.engine.GameState.object;

/** Native turn state machine. Card effects are invoked through a narrow transitional interface. */
public final class JavaTurnRules {
    private final Clock clock;
    private final TurnEffects effects;
    public JavaTurnRules(Clock clock, TurnEffects effects) { this.clock = clock; this.effects = effects; }

    public Object invoke(String operation, RuleNode state, String actor, RuleNode args) {
        RuleNode g = state.get("G"), ctx = state.get("ctx");
        return switch (operation) {
            case "responseExpired" -> responseExpired(g);
            case "expire" -> { expire(g); yield true; }
            case "resolveDeferred" -> resolveDeferred(g);
            case "triggerRoundEnd" -> { triggerRoundEnd(g, ctx); yield true; }
            case "maybeEndAfterRound" -> maybeEndAfterRound(g, ctx);
            case "finish" -> { finish(g, ctx); yield true; }
            case "flush" -> { flush(state); yield true; }
            case "drawTop" -> drawTop(g, player(g, actor));
            case "beginTurnDraw" -> beginDraw(g, ctx, actor);
            case "drawCard" -> extraDraw(state, actor);
            case "endTurn" -> endTurn(state, actor);
            case "discardFromHandDownTo7" -> discardToLimit(state, actor, args.at(0).text());
            case "tick" -> {
                if (!ctx.get("phase").text().equals("action")) yield false;
                expire(g); yield true;
            }
            case "skipResponseWindow" -> skipResponse(state, actor);
            case "forceSkipTurn" -> forceSkip(state, actor);
            default -> throw new IllegalArgumentException("Unknown native turn operation: " + operation);
        };
    }

    public boolean responseExpired(RuleNode g) {
        return !g.get("response").truthy() || clock.millis() >= g.get("response").get("expiresAtMs").number() + 900;
    }
    private void expire(RuleNode g) {
        if (g.get("response").truthy() && responseExpired(g)) g.set("response", null);
        resolveDeferred(g);
        if (!g.get("pending").truthy() && !g.get("response").truthy() && g.get("persona16AfterEvents").truthy()) {
            RuleNode queue = g.get("persona16AfterEvents");
            if (queue.get("events").size() > 0) {
                RuleNode event = queue.get("events").removeAt(0);
                effects.queuedEvent(g, queue, event);
                array(g, "discard").add(event);
            } else {
                g.set("pending", object("kind", "persona_16_discard3_from_hand", "playerId", queue.get("playerId").text(), "sourceCardId", queue.get("sourceCardId").text()));
                g.set("persona16AfterEvents", null);
            }
        }
        if (!g.get("pending").truthy() && g.get("pendingDeferred").truthy()) {
            g.set("pending", g.get("pendingDeferred")); g.set("pendingDeferred", null);
        }
    }
    private boolean resolveDeferred(RuleNode g) {
        RuleNode pending = g.get("pending");
        if (!kind(pending, "resolve_persona_after_response") || !responseExpired(g)) return false;
        if (g.get("response").truthy()) g.set("response", null);
        effects.deferredPersona(g, pending);
        if (kind(g.get("pending"), "resolve_persona_after_response")) g.set("pending", null);
        effects.recalculate(g);
        return true;
    }

    private RuleNode drawTop(RuleNode g, RuleNode p) {
        if (p.missing() || g.get("deck").size() == 0) return null;
        RuleNode card = g.get("deck").removeAt(0);
        if (card.get("type").text().equals("event")) {
            JavaEventRules.markLastEvent(g, p, card);
            effects.drawnEvent(g, p, card);
            effects.recalculate(g);
            array(g, "discard").add(card);
        } else {
            array(p, "hand").add(card);
            log(g, p.get("name").text() + " берет карту");
        }
        return card;
    }
    private boolean beginDraw(RuleNode g, RuleNode ctx, String actor) {
        expire(g);
        if (!ctx.get("currentPlayer").text().equals(actor) || g.get("pending").truthy() || !responseExpired(g) || g.get("hasDrawn").truthy()) return false;
        if (drawTop(g, player(g, actor)) == null) return false;
        g.set("hasDrawn", true); g.set("drawsThisTurn", Math.max(1, g.get("drawsThisTurn").number() + 1));
        return true;
    }
    private boolean extraDraw(RuleNode state, String actor) {
        RuleNode g = state.get("G"), ctx = state.get("ctx");
        expire(g);
        double draws = g.get("drawsThisTurn").number();
        if (!ctx.get("currentPlayer").text().equals(actor) || g.get("pending").truthy() || !responseExpired(g)
            || !g.get("hasDrawn").truthy() || draws >= 2 || g.get("hasPlayed").truthy()) return false;
        if (drawTop(g, player(g, actor)) == null) return false;
        g.set("drawsThisTurn", draws + 1); g.set("hasDrawn", true); g.set("hasPlayed", true);
        if (!maybeEndAfterRound(g, ctx)) queueEnd(state);
        return true;
    }
    private boolean endTurn(RuleNode state, String actor) {
        RuleNode g = state.get("G"), ctx = state.get("ctx");
        expire(g);
        RuleNode pending = g.get("pending");
        if (kind(pending, "resolve_persona_after_response")) return false;
        if (!ctx.get("currentPlayer").text().equals(actor)) return rejectEnd(g, "not_current_player");
        if (pending.truthy()) {
            boolean otherChoice = kind(pending, "event_12b_discard_from_hand") && !contains(pending.get("targetIds"), actor)
                || kind(pending, "persona_13_pick_target") && !pending.get("playerId").text().equals(actor);
            if (!otherChoice) return rejectEnd(g, "pending:" + pending.get("kind").text());
        }
        if (!g.get("hasDrawn").truthy() || !g.get("hasPlayed").truthy()) {
            return rejectEnd(g, "need_draw_play (drawn=" + g.get("hasDrawn").truthy() + " played=" + g.get("hasPlayed").truthy() + ")");
        }
        g.set("debugLastEndTurnReject", null);
        if (pending.truthy() && player(g, actor).get("hand").size() > 7) return rejectEnd(g, "pending:" + pending.get("kind").text());
        // A choice is a successful state transition, not an INVALID_MOVE that discards the pending state.
        if (!enforceHandLimit(g, player(g, actor))) return true;
        if (!maybeEndAfterRound(g, ctx)) queueEnd(state);
        return true;
    }
    private static boolean rejectEnd(RuleNode g, String reason) { g.set("debugLastEndTurnReject", reason); return false; }
    private boolean enforceHandLimit(RuleNode g, RuleNode p) {
        if (p.missing() || p.get("hand").size() <= 7) return true;
        if (bot(p)) {
            while (p.get("hand").size() > 7) array(g, "discard").add(p.get("hand").removeAt(p.get("hand").size() - 1));
            return true;
        }
        g.set("pending", object("kind", "discard_down_to_7", "playerId", p.get("id").text(), "sourceCardId", "hand_limit"));
        g.set("debugLastEndTurnReject", "hand_limit");
        return false;
    }
    private boolean discardToLimit(RuleNode state, String actor, String cardId) {
        RuleNode g = state.get("G"), ctx = state.get("ctx");
        RuleNode p = player(g, actor), pending = g.get("pending");
        if (p.missing()) return false;
        boolean endingTurn = kind(pending, "discard_down_to_7")
            && pending.get("sourceCardId").text().equals("hand_limit");
        if (endingTurn) {
            if (!pending.get("playerId").text().equals(actor)) return false;
        } else if (pending.truthy() || !ctx.get("currentPlayer").text().equals(actor) || p.get("hand").size() <= 7) return false;
        int index = find(p.get("hand"), cardId);
        if (index < 0) return false;
        RuleNode dropped = p.get("hand").removeAt(index);
        array(g, "discard").add(dropped);
        if (dropped.get("type").text().equals("persona")) effects.personaDiscarded(g);
        if (p.get("hand").size() <= 7) g.set("pending", null);
        effects.recalculate(g);
        if (endingTurn && p.get("hand").size() <= 7) return endTurn(state, actor);
        return true;
    }
    private boolean skipResponse(RuleNode state, String actor) {
        RuleNode g = state.get("G"), ctx = state.get("ctx");
        if (!g.get("response").truthy()) return false;
        g.set("response", null); resolveDeferred(g); effects.recalculate(g);
        if (ctx.get("currentPlayer").text().equals(actor) && !g.get("pending").truthy() && !g.get("response").truthy()
            && g.get("hasDrawn").truthy() && g.get("hasPlayed").truthy() && !maybeEndAfterRound(g, ctx)) queueEnd(state);
        return true;
    }
    private boolean forceSkip(RuleNode state, String actor) {
        RuleNode g = state.get("G"), ctx = state.get("ctx"), current = player(g, ctx.get("currentPlayer").text());
        if (!ctx.get("phase").text().equals("action") || !bot(current)) return false;
        g.set("pending", null); g.set("response", null); g.set("botPauseUntilMs", 0);
        g.set("hasDrawn", true); g.set("hasPlayed", true);
        RuleNode author = player(g, actor);
        log(g, who(current.get("name").text()) + " turn force-skipped by " + who(author.missing() ? actor : author.get("name").text()) + ".");
        if (!maybeEndAfterRound(g, ctx)) queueEnd(state);
        return true;
    }

    private void flush(RuleNode state) {
        RuleNode queue = array(state, "__eventQueue");
        while (queue.size() > 0) {
            RuleNode event = queue.removeAt(0);
            switch (event.get("type").text()) {
                case "setPhase" -> state.get("ctx").set("phase", event.get("payload").truthy() ? event.get("payload").text() : state.get("ctx").get("phase").text());
                case "endTurn" -> advance(state, event.get("payload"));
                default -> { }
            }
        }
    }
    private void advance(RuleNode state, RuleNode payload) {
        RuleNode g = state.get("G"), ctx = state.get("ctx");
        // The automatic draw/play paths must also present the hand-limit choice.
        if (!g.get("pending").truthy() && !g.get("response").truthy() && !enforceHandLimit(g, player(g, ctx.get("currentPlayer").text()))) return;
        if (ctx.get("phase").text().equals("action")) {
            history(g, ctx);
            if (!g.get("gameOver").truthy() && g.get("deck").array() && g.get("deck").size() == 0) finish(g, ctx);
        }
        List<String> ids = activeIds(state);
        String next = payload.get("next").missing() ? ids.get((Math.max(-1, ids.indexOf(ctx.get("currentPlayer").text())) + 1) % ids.size()) : payload.get("next").text();
        ctx.set("currentPlayer", next.isEmpty() ? "0" : next);
        ctx.set("turn", ctx.get("turn").number() + 1);
        ctx.set("playOrderPos", Math.max(0, ids.indexOf(ctx.get("currentPlayer").text())));
        if (ctx.get("phase").text().equals("action")) begin(g, ctx);
    }
    private void begin(RuleNode g, RuleNode ctx) {
        if (g.get("roundEnding").truthy() && !g.get("roundEndTurn").missing() && g.get("roundEndTurn").number() >= 0
            && ctx.get("turn").number() >= g.get("roundEndTurn").number() && !g.get("pending").truthy() && !g.get("response").truthy()) {
            finish(g, ctx); return;
        }
        g.set("turnStartedAtMs", clock.millis()); g.set("turnN", ctx.get("turn").number());
        g.set("hasDrawn", false); g.set("hasPlayed", false); g.set("playsThisTurn", 0);
        g.set("maxPlaysThisTurn", 1); g.set("playVpDelta", 0); g.set("drawsThisTurn", 0);
        RuleNode p = player(g, ctx.get("currentPlayer").text());
        if (bot(p)) {
            RuleNode drawn = drawTop(g, p); g.set("hasDrawn", true); g.set("drawsThisTurn", drawn == null ? 0 : 1);
        } else if (!p.missing() && p.get("skipMandatoryDrawThisTurn").truthy()) {
            p.set("skipMandatoryDrawThisTurn", false); g.set("hasDrawn", true);
            log(g, who(p.get("name").text()) + " пропускает обязательный добор в начале хода.");
        }
        g.set("botNextActAtMs", bot(p) ? clock.millis() + 2000 : null);
        if (findBase(p.get("coalition"), "persona_11") >= 0 && hasPersona11Target(g, p.get("id").text())) {
            g.set("pending", object("kind", "persona_11_offer", "playerId", p.get("id").text(), "sourceCardId", "persona_11"));
        }
    }
    private static boolean hasPersona11Target(RuleNode g, String owner) {
        RuleNode players = g.get("players");
        for (int i = 0; i < players.size(); i++) {
            if (players.at(i).get("id").text().equals(owner)) continue;
            RuleNode coalition = players.at(i).get("coalition");
            for (int j = 0; j < coalition.size(); j++) {
                RuleNode c = coalition.at(j);
                if (c.get("type").text().equals("persona") && !base(c).equals("persona_31") && !c.get("shielded").truthy()) return true;
            }
        }
        return false;
    }

    private void triggerRoundEnd(RuleNode g, RuleNode ctx) {
        if (g.get("roundEnding").truthy()) return;
        boolean triggered = false;
        for (int i = 0; i < g.get("players").size(); i++) if (g.get("players").at(i).get("coalition").size() >= 7) triggered = true;
        if (!triggered) return;
        int active = 0;
        for (int i = 0; i < g.get("activePlayerIds").size(); i++) if (player(g, g.get("activePlayerIds").at(i).text()).get("active").truthy()) active++;
        int remaining = Math.max(0, active - 1);
        g.set("roundEnding", true); g.set("roundEndTurn", ctx.get("turn").number() + remaining);
        log(g, "Конец раунда: Кто-то собрал 7 карт. Осталось ходов: " + remaining + ".");
    }
    private boolean maybeEndAfterRound(RuleNode g, RuleNode ctx) {
        if (!g.get("roundEnding").truthy() || g.get("pending").truthy() || !responseExpired(g) || g.get("roundEndTurn").missing()
            || g.get("roundEndTurn").number() < 0 || ctx.get("turn").number() < g.get("roundEndTurn").number()) return false;
        finish(g, ctx); return true;
    }
    private void finish(RuleNode g, RuleNode ctx) {
        RuleNode best = null; double bestScore = -1;
        RuleNode players = g.get("players");
        for (int i = 0; i < players.size(); i++) {
            RuleNode p = players.at(i); double score = 0;
            for (int j = 0; j < p.get("coalition").size(); j++) {
                RuleNode c = p.get("coalition").at(j); score += c.get("vp").missing() ? c.get("baseVp").number() : c.get("vp").number();
            }
            if (score > bestScore) { bestScore = score; best = p; }
        }
        String id = best == null ? null : best.get("id").text();
        String name = best == null ? null : (best.get("name").truthy() ? best.get("name").text() : id);
        g.set("winnerId", id); history(g, ctx);
        log(g, "Игра окончена. Победитель: " + (name == null ? "undefined" : name) + " (" + JavaScoringRules.numeric(bestScore) + " vp).");
        Map<String, Object> result = object("winnerPlayerId", id, "winnerName", name);
        ctx.set("gameover", result); g.set("gameOver", result);
    }
    private static void history(RuleNode g, RuleNode ctx) {
        Map<String, Object> scores = new LinkedHashMap<>();
        for (int i = 0; i < g.get("players").size(); i++) {
            RuleNode p = g.get("players").at(i); double score = 0;
            for (int j = 0; j < p.get("coalition").size(); j++) score += p.get("coalition").at(j).get("vp").number();
            scores.put(p.get("id").text(), JavaScoringRules.numeric(score));
        }
        array(g, "history").add(object("turn", JavaScoringRules.numeric(ctx.get("turn").number()), "scores", scores));
    }
    private static List<String> activeIds(RuleNode state) {
        List<String> ids = new ArrayList<>();
        RuleNode source = state.get("G").get("activePlayerIds");
        for (int i = 0; i < source.size(); i++) ids.add(source.at(i).text());
        if (ids.isEmpty()) {
            int count = (int) state.get("ctx").get("numPlayers").number();
            if (count == 0) count = state.get("G").get("players").size();
            if (count == 0) count = 5;
            for (int i = 0; i < count; i++) ids.add(String.valueOf(i));
        }
        return ids;
    }
    private static void queueEnd(RuleNode state) { array(state, "__eventQueue").add(object("type", "endTurn", "payload", null)); }
    private static RuleNode array(RuleNode node, String key) { if (!node.get(key).array()) node.set(key, List.of()); return node.get(key); }
    private static void log(RuleNode g, String message) { array(g, "log").add(message); }
    private static RuleNode player(RuleNode g, String id) { return g.get("players").at(find(g.get("players"), id)); }
    private static int find(RuleNode array, String id) { for (int i = 0; i < array.size(); i++) if (array.at(i).get("id").text().equals(id)) return i; return -1; }
    private static int findBase(RuleNode array, String id) { for (int i = 0; i < array.size(); i++) if (base(array.at(i)).equals(id)) return i; return -1; }
    private static String base(RuleNode card) { return card.get("id").text().split("#", 2)[0]; }
    private static boolean kind(RuleNode node, String kind) { return node.get("kind").text().equals(kind); }
    private static boolean contains(RuleNode array, String id) { for (int i = 0; i < array.size(); i++) if (array.at(i).text().equals(id)) return true; return false; }
    private static boolean bot(RuleNode player) { return player.get("isBot").truthy() || player.get("name").text().startsWith("[B]"); }
    private static String who(String name) { return name.equals("You") ? "Вы" : name; }
}
