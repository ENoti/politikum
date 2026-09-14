package com.politikum.service;

import org.junit.jupiter.api.Test;
import java.util.*;
import static com.politikum.engine.GameState.*;
import static org.junit.jupiter.api.Assertions.*;

class MatchChoicesTest {
    private Map<String,Object> card(String id, boolean shielded) {
        return object("id",id,"type",id.startsWith("action_")?"action":"persona","shielded",shielded);
    }
    private Map<String,Object> state() {
        return object("G",object("hasDrawn",true,"players",List.of(
            object("id","0","hand",List.of(card("persona_2",false),card("action_6",false)),"coalition",List.of(card("persona_21",false))),
            object("id","1","hand",List.of(card("persona_9",false)),"coalition",List.of(card("persona_31",true),card("persona_5",false)))),
            "deck",List.of(card("persona_4",false)),"discard",List.of()),"ctx",object("phase","action","currentPlayer","0"));
    }
    private Map<String,Object> choices(Map<String,Object> state, String viewer) {
        return map(map(MatchClientView.state(state,viewer).get("G")).get("choices"));
    }
    @Test void hiddenCardsDoNotAffectGuessesOrLeakThroughChoices() {
        var state=state();var g=map(state.get("G"));g.put("pending",object("kind","persona_34_guess_topdeck","playerId","0"));
        var before=choices(state,"0");
        assertTrue(list(before.get("guessIds")).contains("persona_9"));
        assertTrue(list(before.get("guessIds")).contains("persona_4"));
        assertFalse(list(before.get("guessIds")).contains("persona_2"));
        map(list(g.get("players")).get(1)).put("hand",List.of(card("persona_40",false)));
        g.put("deck",List.of(card("persona_45",false)));
        assertEquals(before,choices(state,"0"));
        assertTrue(map(choices(state,null).get("hand")).isEmpty());
        assertTrue(list(choices(state,null).get("guessIds")).isEmpty());
        assertFalse(g.containsKey("choices"));
    }
    @Test void targetsRespectOwnershipAndTheSpecificShieldRule() {
        var state=state();var g=map(state.get("G"));
        g.put("pending",object("kind","persona_21_pick_target_invert","playerId","0"));
        assertEquals(3,list(map(choices(state,"0").get("targets")).get("persona21InvertTokens")).size());
        assertTrue(map(choices(state,"1").get("targets")).isEmpty());
        g.put("pending",object("kind","action_17_choose_opponent_persona","attackerId","0"));
        assertEquals(List.of(object("ownerId","1","cardId","persona_5")),map(choices(state,"0").get("targets")).get("applyAction17ToPersona"));
    }
    @Test void normalPlayStopsDuringResponseAndOnlyOtherPlayerCanCancel() {
        var state=state();var g=map(state.get("G"));
        assertEquals(true,map(map(choices(state,"0").get("hand")).get("persona_2")).get("playPersona"));
        g.put("response",object("kind","cancel_action","playedBy","1"));
        assertEquals(false,map(map(choices(state,"0").get("hand")).get("persona_2")).get("playPersona"));
        map(state.get("ctx")).put("currentPlayer","1");
        assertEquals(true,map(map(choices(state,"0").get("hand")).get("action_6")).get("cancelAction"));
        g.put("gameOver",object("winnerPlayerId","1"));
        assertTrue(map(choices(state,"0").get("hand")).isEmpty());
    }
    @Test void persona33CannotBeCancelledAndHiddenResponseCardsAreNotExposed() {
        var state=state();var g=map(state.get("G"));
        map(list(g.get("players")).get(0)).put("hand",List.of(card("action_8#2",false)));
        g.put("response",object("kind","cancel_persona","playedBy","1","personaCard",card("persona_33",false)));
        assertFalse(map(choices(state,"0").get("reactions")).containsKey("cancelPersonaCardId"));
        map(g.get("response")).put("personaCard",card("persona_2",false));
        assertEquals("action_8#2",map(choices(state,"0").get("reactions")).get("cancelPersonaCardId"));
        assertFalse(map(choices(state,"1").get("reactions")).containsKey("cancelPersonaCardId"));
        assertTrue(map(choices(state,null).get("reactions")).isEmpty());
    }
    @Test void coalitionReactionsRequireTheActualCardsAndSwapTarget() {
        var state=state();var g=map(state.get("G"));var me=map(list(g.get("players")).get(0));
        g.put("pending",object("kind","action_4_discard","targetId","0"));
        g.put("response",object("kind","cancel_action","playedBy","1","allowPersona10By","0"));
        assertEquals(false,map(choices(state,"0").get("reactions")).get("persona10Cancel"));
        me.put("coalition",List.of(card("persona_10",false)));
        assertEquals(true,map(choices(state,"0").get("reactions")).get("persona10Cancel"));
        me.put("coalition",List.of(card("persona_8",false)));
        g.put("response",object("kind","cancel_persona","playedBy","1","persona8Swap",object("playerId","0","ownerId","1","playedPersonaId","persona_5")));
        assertEquals(true,map(choices(state,"0").get("reactions")).get("persona8Swap"));
        assertEquals(List.of(object("ownerId","1","cardId","persona_5")),map(choices(state,"0").get("targets")).get("persona8SwapWithPlayedPersona"));
        map(list(g.get("players")).get(1)).put("coalition",List.of());
        assertEquals(false,map(choices(state,"0").get("reactions")).get("persona8Swap"));
    }
    @Test void persona39ShortcutIsLimitedToAnUnblockedOwnTurn() {
        var state=state();var g=map(state.get("G"));
        map(list(g.get("players")).get(0)).put("coalition",List.of(card("persona_39",false)));
        assertEquals(true,map(choices(state,"0").get("actions")).get("persona39RecycleSelf"));
        assertEquals(false,map(choices(state,"1").get("actions")).get("persona39RecycleSelf"));
        g.put("response",object("kind","cancel_action"));
        assertEquals(false,map(choices(state,"0").get("actions")).get("persona39RecycleSelf"));
    }
}
