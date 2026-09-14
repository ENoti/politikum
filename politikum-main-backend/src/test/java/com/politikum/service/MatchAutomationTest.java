package com.politikum.service;

import com.politikum.util.JsonUtils;
import com.politikum.engine.GameEngine;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.annotation.DirtiesContext;
import java.nio.file.Path;
import java.util.*;
import static com.politikum.engine.GameState.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties="politikum.automation.enabled=false")
@DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
class MatchAutomationTest {
    @TempDir static Path data;
    @Autowired LiveMatchService matches;
    @Autowired JdbcTemplate jdbc;
    @Autowired PolitikumRepository repository;
    @DynamicPropertySource static void properties(DynamicPropertyRegistry p) {
        p.add("politikum.admin-token",()->"automation-test-token");p.add("politikum.db.path",()->data.resolve("test.sqlite").toString());
        p.add("politikum.news.path",()->data.resolve("NEWS.md").toString());p.add("politikum.profile-img-dir",()->data.resolve("profiles").toString());
    }
    private Map<String,Object> card(String id) { return object("id",id,"name",id,"type","persona","baseVp",1,"vp",1); }
    private Map<String,Object> state(boolean bot) {
        return object("G",object("players",List.of(object("id","0","name",bot?"[B] Bot":"Human","isBot",bot,"active",true,"hand",List.of(card("persona_35")),"coalition",List.of()),object("id","1","name","Other","active",true,"hand",List.of(),"coalition",List.of())),"deck",List.of(card("persona_2")),"discard",List.of(),"log",List.of(),"hasDrawn",true,"hasPlayed",false,"turnN",1),"ctx",object("phase","action","currentPlayer","0","turn",1),"_stateID",1);
    }
    private String save(Map<String,Object> state) {
        String id=String.valueOf(matches.createMatch(2,null,"Human","Automation").get("matchID"));
        jdbc.update("UPDATE live_matches SET status='in_progress', state_json=? WHERE match_id=?",JsonUtils.stringify(state),id);return id;
    }
    private Map<String,Object> load(String id) { return JsonUtils.parseMap(jdbc.queryForObject("SELECT state_json FROM live_matches WHERE match_id=?",String.class,id)); }
    @Test void botAdvancesWithoutClientRequests() {
        String id=save(state(true));assertTrue(matches.automaticMatchIds().contains(id));
        new MatchAutomation(matches).advance();
        var next=load(id);assertEquals("1",map(next.get("ctx")).get("currentPlayer"));assertEquals(2,number(next.get("_stateID")));
    }
    @Test void expiredResponseResolvesWithoutBrowserAndIdlePollingDoesNotWrite() {
        var state=state(false);map(state.get("G")).put("response",object("kind","cancel_action","expiresAtMs",1));String id=save(state);
        assertTrue(matches.advanceAutomatic(id));assertNull(map(load(id).get("G")).get("response"));String before=JsonUtils.stringify(load(id));
        assertFalse(matches.advanceAutomatic(id));assertEquals(before,JsonUtils.stringify(load(id)));
    }
    @Test void unexpiredResponseAndFutureBotDeadlineAreNotAdvanced() {
        var state=state(false);map(state.get("G")).put("response",object("kind","cancel_action","expiresAtMs",System.currentTimeMillis()+60000));String id=save(state);
        assertFalse(matches.advanceAutomatic(id));assertEquals(1,number(load(id).get("_stateID")));
        state=state(true);map(state.get("G")).put("botNextActAtMs",System.currentTimeMillis()+60000);id=save(state);
        assertFalse(matches.advanceAutomatic(id));assertEquals(1,number(load(id).get("_stateID")));
    }
    @Test void stoppedMatchesAreNotAdvanced() {
        String id=save(state(true));jdbc.update("UPDATE live_matches SET status='killed' WHERE match_id=?",id);
        assertFalse(matches.advanceAutomatic(id));assertEquals(1,number(load(id).get("_stateID")));
    }
    @Test void newerStoredMoveCannotBeOverwrittenByAutomaticWork() {
        String id=save(state(true));
        var newer=state(false);newer.put("_stateID",99);
        var delayed=new GameEngine() {
            public Map<String,Object> createMatchState(int seats) { return state(true); }
            public Map<String,Object> applyMove(Map<String,Object> original,String actor,String move,List<Object> args) {
                // A human move was saved after the scheduler read its snapshot.
                jdbc.update("UPDATE live_matches SET state_json=? WHERE match_id=?",JsonUtils.stringify(newer),id);
                var next=state(false);next.put("_stateID",2);
                return object("ok",true,"state",next);
            }
        };
        assertFalse(new LiveMatchService(jdbc,delayed,repository).advanceAutomatic(id));
        assertEquals(99,number(load(id).get("_stateID")));
    }
}
