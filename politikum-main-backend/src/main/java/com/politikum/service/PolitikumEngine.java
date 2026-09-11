package com.politikum.service;

import com.politikum.engine.*;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Service;
import java.io.IOException;
import java.time.Clock;
import java.util.*;

/** Routes migrated rules to Java; initializes Graal only for remaining card moves. */
@Service
public final class PolitikumEngine implements GameEngine {
    private final CardCatalog catalog;
    private final JavaLobbyEngine lobby;
    private GraalPolitikumEngine legacy;
    public PolitikumEngine() throws IOException {
        catalog = new CardCatalog();
        lobby = new JavaLobbyEngine(catalog, Clock.systemUTC(), Math::random);
    }
    @Override public Map<String, Object> createMatchState(int numPlayers) { return lobby.createMatchState(numPlayers); }
    @Override public Map<String, Object> applyMove(Map<String, Object> state, String playerId, String move, List<Object> args) {
        if (lobby.supports(move)) return lobby.applyMove(state, playerId, move, args);
        return legacy().applyMove(state, playerId, move, args);
    }
    private synchronized GraalPolitikumEngine legacy() {
        if (legacy == null) {
            try { legacy = new GraalPolitikumEngine(catalog); }
            catch (Exception e) { throw new IllegalStateException("Failed to initialize remaining JS rules", e); }
        }
        return legacy;
    }
    @PreDestroy public synchronized void close() { if (legacy != null) legacy.close(); }
}
