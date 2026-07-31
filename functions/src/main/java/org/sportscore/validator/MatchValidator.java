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
    // UPDATE:
    // Now also checks both team names are present and non-blank, so a match whose team
    // data is missing/malformed is filtered out here instead of reaching the UI as a
    // card with a blank team name. (id==0 is no longer possible to see this far - the
    // backend adapters now validate ESPN ids before building a Match at all.)
    public boolean isValid(Match match) {
        return match.homeTeam() != null
                && notBlank(match.homeTeam().name())
                && match.awayTeam() != null
                && notBlank(match.awayTeam().name())
                && match.status() != null
                && !match.status().isBlank();
    }

    private boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    // ============================================================================
    // PLEASE review — hidden precondition: transform() calls match.status().trim(),
    // which NPEs if status is null. It only works because callers happen to run isValid()
    // first (the function's filter -> map chain). A method should not depend on an
    // unenforced call order.
    // EXAMPLE (make it self-safe):
    //   String status = match.status() == null ? "" : match.status().trim();
    //   if (status.isBlank()) return match;   // or throw IllegalArgumentException
    // UPDATE:
    // transform() no longer depends on isValid() having been called first - it null-guards
    // status() itself now, so calling it standalone can't NPE even if the call order changes.
    // ============================================================================
    /**
     * Sanitises a match before broadcasting, carrying all unified fields through.
     */
    public Match transform(Match match) {
        List<MatchEvent> cleanedEvents = match.events() == null ? List.of() :
                match.events().stream()
                        .filter(e -> e.type() != null && !e.type().isBlank())
                        .toList();

        String status = match.status() == null ? "" : match.status().trim();

        return new Match(
                match.id(),
                match.sport() == null ? "football" : match.sport(),
                status,
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