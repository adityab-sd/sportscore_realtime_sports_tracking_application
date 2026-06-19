package org.sportscore.validator;

import org.sportscore.model.Match;
import org.sportscore.model.MatchEvent;

import java.util.List;

public class MatchValidator {

    /**
     * Returns true if the match has enough data to be forwarded.
     * Rejects matches with null teams, scores, or unrecognised statuses.
     */
    public boolean isValid(Match match) {
        return match.homeTeam() != null
                && match.awayTeam() != null
                && match.status() != null
                && !match.status().isBlank();
    }

    /**
     * Sanitises a match before broadcasting:
     * - Trims whitespace from team names
     * - Removes events with blank player names
     * - Clamps elapsed to 0 if negative
     */
    public Match transform(Match match) {
        List<MatchEvent> cleanedEvents = match.events() == null ? List.of() :
                match.events().stream()
                        .filter(e -> e.player() != null && !e.player().isBlank())
                        .toList();

        return new Match(
                match.id(),
                match.status().trim(),
                match.elapsed() == null ? null : (match.elapsed() < 0 ? 0 : match.elapsed()),
                match.kickoff(),
                match.competition(),
                match.homeTeam(),
                match.awayTeam(),
                match.homeScore(),
                match.awayScore(),
                cleanedEvents);
    }
}
