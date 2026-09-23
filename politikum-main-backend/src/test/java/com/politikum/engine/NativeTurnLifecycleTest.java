package com.politikum.engine;

import com.fasterxml.jackson.core.type.TypeReference;
import com.politikum.util.JsonUtils;
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.proxy.ProxyExecutable;
import org.junit.jupiter.api.*;
import org.springframework.core.io.ClassPathResource;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import static com.politikum.engine.GameState.*;
import static org.junit.jupiter.api.Assertions.*;

class NativeTurnLifecycleTest {
    static Context guest;
    static List<Map<String, Object>> legacy;
    @BeforeAll static void setup() throws Exception {
        try (var in = new ClassPathResource("engine/turn-legacy.json").getInputStream()) {
            legacy = JsonUtils.mapper().readValue(in, new TypeReference<>() {});
        }
        guest = Context.newBuilder("js").build();
        guest.getBindings("js").putMember("__politikumCatalogJson", new CardCatalog().json());
        var scoring = new ScoringBridge();
        guest.getBindings("js").putMember("__politikumNativeScoring", (ProxyExecutable) args -> scoring.execute(args[0].asString(), args[1].asString()));
        GraalTurnBridge.install(guest, Clock.fixed(Instant.ofEpochMilli(100000), ZoneOffset.UTC));
        try (var in = new ClassPathResource("engine/politikum-engine-bridge.js").getInputStream()) { guest.eval("js", new String(in.readAllBytes(), StandardCharsets.UTF_8)); }
        guest.eval("js", "Date.now=()=>100000; Math.random=()=>.25;");
    }
    @AfterAll static void close() { if (guest != null) guest.close(); }

    @Test void allLegacyTransitionsMatchIncludingDeferredEffectsAndExpiryBoundary() throws Exception {
        for (var test : legacy) {
            Map<String, Object> result = move(map(test.get("input")), (String) test.get("actor"), (String) test.get("move"), list(test.get("args")));
            map(map(result.get("state")).get("G")).remove("trace");
            assertEquals(JsonUtils.mapper().valueToTree(test.get("expected")), LegacyParity.normalize(JsonUtils.mapper().valueToTree(result)), String.valueOf(test.get("name")));
        }
    }

    @Test void handLimitIsAnAcceptedChoiceAndCannotBeResolvedByAnotherSeat() {
        var state = base(); var g = map(state.get("G")); var hand = hand(g, 0);
        while (hand.size() < 8) hand.add(GameState.<Object>list(g.get("deck")).remove(0));
        g.put("hasDrawn", true); g.put("hasPlayed", true);
        var result = move(state, "0", "endTurn", List.of());
        assertEquals(true, result.get("ok"));
        var waiting = map(result.get("state"));
        var pending = map(map(waiting.get("G")).get("pending"));
        assertEquals("discard_down_to_7", pending.get("kind"));
        assertEquals("0", map(waiting.get("ctx")).get("currentPlayer"));
        assertEquals(number(state.get("_stateID")) + 1, number(waiting.get("_stateID")));
        String cardId = String.valueOf(map(hand.get(0)).get("id"));
        assertEquals(false, move(waiting, "1", "discardFromHandDownTo7", List.of(cardId)).get("ok"));
        var dropped = move(waiting, "0", "discardFromHandDownTo7", List.of(cardId));
        assertEquals(true, dropped.get("ok"));
        var next = map(dropped.get("state"));
        assertNull(map(next.get("G")).get("pending"));
        assertEquals(7, hand(map(next.get("G")), 0).size());
        assertEquals("1", map(next.get("ctx")).get("currentPlayer"));
    }

    @Test void handLimitCannotReplaceOrClearAnotherChoice() {
        var state = base(); var g = map(state.get("G"));
        while (hand(g, 0).size() < 8) hand(g, 0).add(GameState.<Object>list(g.get("deck")).remove(0));
        g.put("hasDrawn", true); g.put("hasPlayed", true);
        g.put("pending", object("kind", "persona_13_pick_target", "playerId", "1"));
        assertEquals(false, move(state, "0", "endTurn", List.of()).get("ok"));
        String cardId = String.valueOf(map(hand(g, 0).get(0)).get("id"));
        assertEquals(false, move(state, "0", "discardFromHandDownTo7", List.of(cardId)).get("ok"));
    }

    @Test void automaticExtraDrawAlsoStopsForHandLimit() {
        var state = base(); var g = map(state.get("G"));
        while (hand(g, 0).size() < 7) hand(g, 0).add(GameState.<Object>list(g.get("deck")).remove(0));
        g.put("hasDrawn", true); g.put("drawsThisTurn", 1);
        var result = move(state, "0", "drawCard", List.of());
        assertEquals(true, result.get("ok"));
        var next = map(result.get("state"));
        assertEquals("0", map(next.get("ctx")).get("currentPlayer"));
        assertEquals(8, hand(map(next.get("G")), 0).size());
        assertEquals("discard_down_to_7", map(map(next.get("G")).get("pending")).get("kind"));
    }

    @Test void sevenCardTriggerAndFinalRoundWaitForPendingChoices() {
        var state = base(); var g = map(state.get("G"));
        var coalition = new ArrayList<Object>();
        for (int i = 0; i < 7; i++) coalition.add(GameState.<Object>list(g.get("deck")).remove(0));
        map(GameState.<Object>list(g.get("players")).get(0)).put("coalition", coalition);
        guest.getBindings("js").putMember("stateJson", JsonUtils.stringify(state));
        var result = JsonUtils.parseMap(guest.eval("js", """
            (()=>{const s=JSON.parse(stateJson);maybeTriggerRoundEnd(s.G,s.ctx);
            const cutoff=s.G.roundEndTurn;s.ctx.turn=cutoff;s.G.pending={kind:'choice'};
            const blocked=maybeEndAfterRound(s.G,s.ctx,makeEvents(s));
            s.G.pending=null;const ended=maybeEndAfterRound(s.G,s.ctx,makeEvents(s));
            return JSON.stringify({cutoff,blocked,ended,state:s});})()
            """).asString());
        assertEquals(3, number(result.get("cutoff")));
        assertEquals(false, result.get("blocked")); assertEquals(true, result.get("ended"));
        assertNotNull(map(map(result.get("state")).get("ctx")).get("gameover"));
    }

    @Test void nativeCallbacksKeepLiveCardReferences() {
        guest.getBindings("js").putMember("stateJson", JsonUtils.stringify(base()));
        assertTrue(guest.eval("js", """
            (()=>{const s=JSON.parse(stateJson),g=s.G,p=g.players[0],hand=p.hand,deck=g.deck,card=deck[0];
            const drawn=drawTopCardForPlayer2(g,p);
            return drawn===card && p===g.players[0] && hand===p.hand && deck===g.deck && hand[hand.length-1]===card;})()
            """).asBoolean());
    }

    static Map<String, Object> base() { return JsonUtils.parseMap(JsonUtils.stringify(legacy.get(0).get("input"))); }
    static List<Object> hand(Map<String, Object> g, int player) { return list(map(GameState.<Object>list(g.get("players")).get(player)).get("hand")); }
    static Map<String, Object> move(Map<String, Object> state, String actor, String move, List<Object> args) {
        guest.getBindings("js").putMember("requestJson", JsonUtils.stringify(object("state", state, "actor", actor, "move", move, "args", args)));
        return JsonUtils.parseMap(guest.eval("js", """
            (()=>{const r=JSON.parse(requestJson),before=JSON.stringify(r.state);
            const result=applyMove(r.state,r.actor,r.move,r.args);
            if(JSON.stringify(r.state)!==before)throw Error('input snapshot mutated');
            return JSON.stringify(result);})()
            """).asString());
    }
}
