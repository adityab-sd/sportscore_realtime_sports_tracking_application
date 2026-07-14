package org.sportscore.validator;

import java.util.List;

import org.sportscore.model.Match;
import org.sportscore.model.MatchEvent;

public class MatchValidator {

    /**
     * Returns true if the match has enough data to be forwarded.
     */
    // PLEASE review — thin validation: this passes a match even if both scores are null, id is 0,
    // or teams have blank names, so malformed data still reaches the client. Validate the fields
    // the UI actually renders.
    // EXAMPLE:
    //   return match.homeTeam() != null && notBlank(match.homeTeam().name())
    //       && match.awayTeam() != null && notBlank(match.awayTeam().name())
    //       && match.status() != null && !match.status().isBlank();
    public boolean isValid(Match match) {
        return match.homeTeam() != null
                && match.awayTeam() != null
                && match.status() != null
                && !match.status().isBlank();
    }

    // ============================================================================
    // PLEASE review — hidden precondition: transform() calls match.status().trim(),
    // which NPEs if status is null. It only works because callers happen to run isValid()
    // first (the function's filter -> map chain). A method should not depend on an
    // unenforced call order.
    // EXAMPLE (make it self-safe):
    //   String status = match.status() == null ? "" : match.status().trim();
    //   if (status.isBlank()) return match;   // or throw IllegalArgumentException
    // ============================================================================
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