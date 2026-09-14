package com.politikum.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Advances stored matches even when every browser is closed. */
@Component
@ConditionalOnProperty(name="politikum.automation.enabled",havingValue="true",matchIfMissing=true)
public final class MatchAutomation {
    private static final Logger log=LoggerFactory.getLogger(MatchAutomation.class);
    private final LiveMatchService matches;
    public MatchAutomation(LiveMatchService matches) { this.matches=matches; }
    @Scheduled(initialDelayString="${politikum.automation.initial-delay-ms:1000}",fixedDelayString="${politikum.automation.delay-ms:500}")
    public void advance() {
        for(String id:matches.automaticMatchIds()) {
            try { matches.advanceAutomatic(id); }
            catch(org.springframework.dao.TransientDataAccessException e) { log.debug("Automatic move will retry for {}",id,e); }
            catch(RuntimeException e) { log.warn("Automatic move failed for {}",id,e); }
        }
    }
}
