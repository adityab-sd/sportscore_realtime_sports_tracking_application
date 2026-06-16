package org.Spring.model;

import java.util.List;

public record Match(
        int id,
        String status,
        Integer elapsed,
        String kickoff,
        String competition,
        Team homeTeam,
        Team awayTeam,
        Integer homeScore,
        Integer awayScore,
        List<MatchEvent> events) {
}