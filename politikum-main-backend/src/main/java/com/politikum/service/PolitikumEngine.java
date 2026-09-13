package com.politikum.service;

import com.politikum.engine.*;
import org.springframework.stereotype.Service;
import java.io.IOException;
import java.time.Clock;
import java.util.*;

/** Single authoritative Java engine for lobby and game moves. */
@Service
public final class PolitikumEngine implements GameEngine {
    private final JavaGameEngine engine;
    public PolitikumEngine() throws IOException {
        engine = new JavaGameEngine(new CardCatalog(), Clock.systemUTC(), Math::random);
    }
    @Override public Map<String, Object> createMatchState(int numPlayers) { return engine.createMatchState(numPlayers); }
    @Override public Map<String, Object> applyMove(Map<String, Object> state, String playerId, String move, List<Object> args) {
        return engine.applyMove(state, playerId, move, args);
    }
    /** Compatibility for existing callers; the native engine owns no closeable resources. */
    public void close() { }
}
