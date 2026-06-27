package org.sportscore.validator;

import java.util.List;

import org.sportscore.model.Match;
import org.sportscore.model.MatchEvent;

public class MatchValidator {

    /**
     * Returns true if the match has enough data to be forwarded.
     */
    public boolean isValid(Match match) {
        return match.homeTeam() != null
                && match.awayTeam() != null
                && match.status() != null
                && !match.status().isBlank();
    }

    /**
     * Sanitises a match before broadcasting, carrying all unified fields through.
     */
    public Match transform(Match match) {
        List<MatchEvent> cleanedEvents = match.events() == null ? List.of() :
                match.events().stream()
                        .filter(e -> e.player() != null && !e.player().isBlank())
                        .toList();

        return new Match(
                match.id(),
                match.sport() == null ? "football" : match.sport(),
                match.status().trim(),
                match.elapsed() == null ? null : (match.elapsed() < 0 ? 0 : match.elapsed()),
                match.clock(),
                match.period(),
                match.statusDetail(),
                match.kickoff(),
                match.competition(),
                match.homeTeam(),
                match.awayTeam(),
                match.homeScore(),
                match.awayScore(),
                match.homeScoreDisplay(),
                match.awayScoreDisplay(),
                cleanedEvents);
    }
}