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
}
