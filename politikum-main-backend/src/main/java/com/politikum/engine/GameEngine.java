package com.politikum.engine;

import java.util.List;
import java.util.Map;

/** Stable boundary for the authoritative Java match engine. */
public interface GameEngine {
    Map<String, Object> createMatchState(int numPlayers);
    Map<String, Object> applyMove(Map<String, Object> state, String playerId, String move, List<Object> args);
}
