package org.sportscore.radio;

import org.sportscore.model.Match;
import org.sportscore.model.MatchEvent;
import org.sportscore.model.Team;

/**
 * Turns a football {@link MatchEvent} (in the context of its parent
 * {@link Match}) into commentary text, then wraps it in SSML for TTS.
 *
 * Built against org.Spring.model.Match / MatchEvent as shared, and assumes
 * org.sportscore.model.Match / MatchEvent (the functions-module copies) are
 * field-for-field identical, per the existing "kept in sync by hand" review
 * comment on those records.
 *
 * Team resolution: MatchEvent.teamId() is matched against the parent
 * Match's homeTeam().id()/awayTeam().id(), confirmed against the real
 * Team(int id, String name, String shortName, String logo) record.
 * Commentary prefers shortName() when present (falls back to name()) since
 * spoken commentary reads more naturally with the common short name.
 *
 * ASSUMPTION on vocabulary: MatchEvent.type() is expected to be one of
 * KICKOFF, GOAL, OWN_GOAL, YELLOW_CARD, RED_CARD, SUBSTITUTION,
 * PENALTY_SCORED, PENALTY_MISSED, VAR_REVIEW, HALFTIME, FULLTIME -- anything
 * else falls through to a generic template (using detail() if present)
 * rather than being dropped.
 */
public class CommentaryService {
    public String toCommentaryText(Match match, MatchEvent event) {
        String sport = match.sport() != null ? match.sport() : "football";
        return switch (sport) {
            case "baseball" -> baseballCommentary(match, event);
            case "f1" -> f1Commentary(match, event);
            default -> footballCommentary(match, event); // existing switch, renamed, unchanged
        };
    }

    private String baseballCommentary(Match match, MatchEvent event) {
        String type = event.type() == null ? "UNKNOWN" : event.type();
        switch (type) {
            case "KICKOFF":
                return "Play ball! First pitch between "
                        + teamName(match.homeTeam()) + " and " + teamName(match.awayTeam()) + ".";
            case "FULLTIME":
                return "That's the final out." + fullTimeScoreLine(match);
            case "RUN_SCORED": {
                String team = resolveTeamName(match, event.teamId());
                return "Run scores for " + team + "!" + scoreLine(match);
            }
            case "INNING_CHANGE":
                return event.detail() != null ? event.detail() + "." : "New inning.";
            default:
                return event.detail() != null ? event.detail() + "." : "Update from the game.";
        }
    }

    private String f1Commentary(Match match, MatchEvent event) {
        String type = event.type() == null ? "UNKNOWN" : event.type();
        switch (type) {
            case "KICKOFF":
                return "Lights out, and we're racing! " + orElse(match.competition(), "The session") + " is underway.";
            case "FULLTIME":
                return "Chequered flag." + (match.homeTeam() != null ? " " + match.homeTeam().name() + " takes it." : "");
            case "LEAD_CHANGE":
                return orElse(event.player(), "A new driver") + " takes the lead"
                        + (event.assist() != null ? ", passing " + event.assist() : "") + "!";
            default:
                return event.detail() != null ? event.detail() + "." : "Update from the session.";
        }
    }



    private String footballCommentary(Match match, MatchEvent event) {
        String type = event.type() == null ? "UNKNOWN" : event.type();

        switch (type) {
            case "KICKOFF":
                return "And we are underway! Kickoff between "
                        + teamName(match.homeTeam()) + " and " + teamName(match.awayTeam()) + ".";

            case "GOAL": {
                String team = resolveTeamName(match, event.teamId());
                String assist = event.assist() != null ? " assisted by " + event.assist() + "," : "";
                return "GOAL! " + orElse(event.player(), "A player") + " scores for " + team + assist
                        + " in the " + ordinalMinute(event.minute()) + "." + scoreLine(match);
            }

            case "OWN_GOAL":
                return "An own goal from " + orElse(event.player(), "a defender")
                        + " in the " + ordinalMinute(event.minute()) + "." + scoreLine(match);

            case "YELLOW_CARD":
                return "Yellow card shown to " + orElse(event.player(), "a player")
                        + " of " + resolveTeamName(match, event.teamId())
                        + " in the " + ordinalMinute(event.minute()) + ".";

            case "RED_CARD":
                return "Red card! " + orElse(event.player(), "A player")
                        + " of " + resolveTeamName(match, event.teamId())
                        + " is sent off in the " + ordinalMinute(event.minute()) + ".";

            case "SUBSTITUTION": {
                String detailSuffix = event.detail() != null ? ", replacing " + event.detail() : "";
                return "Substitution for " + resolveTeamName(match, event.teamId()) + ": "
                        + orElse(event.player(), "a player") + " comes on"
                        + detailSuffix + " in the " + ordinalMinute(event.minute()) + ".";
            }

            case "PENALTY_SCORED":
                return "Penalty scored by " + orElse(event.player(), "the taker")
                        + " in the " + ordinalMinute(event.minute()) + "." + scoreLine(match);

            case "PENALTY_MISSED":
                return "Penalty missed by " + orElse(event.player(), "the taker")
                        + " in the " + ordinalMinute(event.minute()) + ".";

            case "VAR_REVIEW": {
                String detailSuffix = event.detail() != null ? " Reviewing: " + event.detail() + "." : "";
                return "VAR review underway in the " + ordinalMinute(event.minute())
                        + ". Play is paused while the officials check the decision." + detailSuffix;
            }

            case "HALFTIME":
                return "That's halftime." + scoreLine(match);

            case "FULLTIME":
                return "Full time." + fullTimeScoreLine(match);

            default:
                return event.detail() != null
                        ? "Update in the " + ordinalMinute(event.minute()) + ": " + event.detail() + "."
                        : "Update in the " + ordinalMinute(event.minute()) + ".";
        }
    }

    /**
     * Wraps commentary text in SSML with light prosody control. Kept simple on
     * purpose -- Neural TTS HD Flash is chosen specifically for low latency, so
     * this avoids heavy SSML processing overhead on the synthesis side.
     */
    public String toSSML(String commentaryText, String eventType, String voice) {
        String escaped = commentaryText
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");

        boolean emphasize = "GOAL".equals(eventType) || "RED_CARD".equals(eventType)
                || "PENALTY_SCORED".equals(eventType) || "RUN_SCORED".equals(eventType)
                || "LEAD_CHANGE".equals(eventType);
        String body = emphasize ? "<emphasis level=\"strong\">" + escaped + "</emphasis>" : escaped;

        return "<speak version=\"1.0\" xmlns=\"http://www.w3.org/2001/10/synthesis\" xml:lang=\"en-US\">"
                + "<voice name=\"" + voice + "\"><prosody rate=\"1.0\" pitch=\"0%\">" + body + "</prosody></voice>"
                + "</speak>";
    }

    /**
     * Resolves a MatchEvent's teamId to a team name via the parent Match's
     * homeTeam/awayTeam. teamId is a primitive int on MatchEvent, so a payload
     * that omitted it arrives as 0 and won't match a real team id -- falls
     * back to a generic phrase in that case rather than guessing.
     */
    private String resolveTeamName(Match match, int teamId) {
        if (match.homeTeam() != null && match.homeTeam().id() == teamId) {
            return teamName(match.homeTeam());
        }
        if (match.awayTeam() != null && match.awayTeam().id() == teamId) {
            return teamName(match.awayTeam());
        }
        return "the team";
    }

    private String teamName(Team team) {
        if (team == null) return "the side";
        if (team.shortName() != null && !team.shortName().isBlank()) return team.shortName();
        return team.name() != null ? team.name() : "the side";
    }

    private String scoreLine(Match match) {
        if (match.homeScoreDisplay() != null && match.awayScoreDisplay() != null) {
            return " The score is now " + match.homeScoreDisplay() + " to " + match.awayScoreDisplay() + ".";
        }
        if (match.homeScore() != null && match.awayScore() != null) {
            return " The score is now " + match.homeScore() + " to " + match.awayScore() + ".";
        }
        return "";
    }

    private String fullTimeScoreLine(Match match) {
        if (match.homeScoreDisplay() != null && match.awayScoreDisplay() != null) {
            return " Final score, " + match.homeScoreDisplay() + " to " + match.awayScoreDisplay() + ".";
        }
        if (match.homeScore() != null && match.awayScore() != null) {
            return " Final score, " + match.homeScore() + " to " + match.awayScore() + ".";
        }
        return "";
    }

    private String orElse(String value, String fallback) {
        return value != null ? value : fallback;
    }

    private String ordinalMinute(int minute) {
        int mod100 = minute % 100;
        int mod10 = minute % 10;
        String suffix = "th";
        if (mod100 < 11 || mod100 > 13) {
            if (mod10 == 1) suffix = "st";
            else if (mod10 == 2) suffix = "nd";
            else if (mod10 == 3) suffix = "rd";
        }
        return minute + suffix + " minute";
    }
}
