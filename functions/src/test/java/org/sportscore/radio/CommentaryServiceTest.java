package org.sportscore.radio;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.sportscore.model.Match;
import org.sportscore.model.MatchEvent;
import org.sportscore.model.Team;

/**
 * Pure unit tests for CommentaryService -- no Azure, no Event Hubs, no
 * network. This is the fastest way to check commentary wording and the
 * teamId -> team name resolution without spinning up the function at all.
 *
 * Run with: mvn test -Dtest=CommentaryServiceTest
 * (requires junit-jupiter as a test-scope dependency -- see pom snippet in
 * TESTING.md if it's not already in the project.)
 */
class CommentaryServiceTest {

    private final CommentaryService service = new CommentaryService();

    private Match sampleMatch(MatchEvent... events) {
        Team home = new Team(1, "Arsenal Football Club", "Arsenal", null);
        Team away = new Team(2, "Chelsea Football Club", "Chelsea", null);
        return new Match(
                1001, "football", "IN_PLAY", 23, null, null, "IN_PLAY", "2026-07-23T15:00:00Z",
                "Premier League", home, away, 1, 0, "1", "0", List.of(events));
    }

    @Test
    void teamNamePrefersShortNameOverFullName() {
        MatchEvent goal = new MatchEvent(23, "GOAL", null, "Bukayo Saka", null, 1);
        Match match = sampleMatch(goal);
        String text = service.toCommentaryText(match, goal);

        assertTrue(text.contains("Arsenal"));
        assertTrue(!text.contains("Football Club"));
    }

    @Test
    void teamNameFallsBackToFullNameWhenShortNameMissing() {
        Team home = new Team(1, "Arsenal Football Club", null, null);
        Team away = new Team(2, "Chelsea Football Club", "Chelsea", null);
        Match match = new Match(
                1001, "football", "IN_PLAY", 23, null, null, "IN_PLAY", "2026-07-23T15:00:00Z",
                "Premier League", home, away, 1, 0, "1", "0",
                List.of(new MatchEvent(23, "GOAL", null, "Bukayo Saka", null, 1)));

        String text = service.toCommentaryText(match, match.events().get(0));
        assertTrue(text.contains("Arsenal Football Club"));
    }

    @Test
    void kickoffMentionsBothTeams() {
        Match match = sampleMatch(new MatchEvent(0, "KICKOFF", null, null, null, 0));
        String text = service.toCommentaryText(match, match.events().get(0));
        assertTrue(text.contains("Arsenal"));
        assertTrue(text.contains("Chelsea"));
    }

    @Test
    void goalResolvesScoringTeamAndAssistAndScoreLine() {
        MatchEvent goal = new MatchEvent(23, "GOAL", null, "Bukayo Saka", "Martin Odegaard", 1);
        Match match = sampleMatch(goal);
        String text = service.toCommentaryText(match, goal);

        assertTrue(text.contains("Bukayo Saka"));
        assertTrue(text.contains("Arsenal")); // teamId 1 -> home team
        assertTrue(text.contains("Martin Odegaard"));
        assertTrue(text.contains("23rd minute"));
        assertTrue(text.contains("1 to 0")); // uses homeScoreDisplay/awayScoreDisplay
    }

    @Test
    void goalWithUnknownTeamIdFallsBackGracefully() {
        MatchEvent goal = new MatchEvent(50, "GOAL", null, "Mystery Player", null, 999);
        Match match = sampleMatch(goal);
        String text = service.toCommentaryText(match, goal);

        assertTrue(text.contains("the team")); // 999 matches neither home(1) nor away(2)
    }

    @Test
    void redCardMentionsPlayerAndTeam() {
        MatchEvent red = new MatchEvent(78, "RED_CARD", null, "Declan Rice", null, 1);
        Match match = sampleMatch(red);
        String text = service.toCommentaryText(match, red);

        assertTrue(text.contains("Red card"));
        assertTrue(text.contains("Declan Rice"));
        assertTrue(text.contains("Arsenal"));
    }

    @Test
    void substitutionIncludesReplacingDetailWhenPresent() {
        MatchEvent sub = new MatchEvent(80, "SUBSTITUTION", "Christopher Nkunku", "Cole Palmer", null, 2);
        Match match = sampleMatch(sub);
        String text = service.toCommentaryText(match, sub);

        assertTrue(text.contains("Cole Palmer"));
        assertTrue(text.contains("replacing Christopher Nkunku"));
        assertTrue(text.contains("Chelsea"));
    }

    @Test
    void fullTimeUsesScoreDisplayFields() {
        MatchEvent fulltime = new MatchEvent(90, "FULLTIME", null, null, null, 0);
        Match match = sampleMatch(fulltime);
        String text = service.toCommentaryText(match, fulltime);

        assertEquals("Full time. Final score, 1 to 0.", text);
    }

    @Test
    void unknownEventTypeFallsThroughToGenericTemplate() {
        MatchEvent weird = new MatchEvent(55, "DRINKS_BREAK", "cooling break", null, null, 0);
        Match match = sampleMatch(weird);
        String text = service.toCommentaryText(match, weird);

        assertTrue(text.contains("55th minute"));
        assertTrue(text.contains("cooling break"));
    }

    @Test
    void ssmlEmphasizesGoalsAndEscapesSpecialCharacters() {
        String ssml = service.toSSML("Test & <check>", "GOAL", "en-US-AvaMultilingualNeural");
        assertTrue(ssml.contains("<emphasis level=\"strong\">"));
        assertTrue(ssml.contains("&amp;"));
        assertTrue(ssml.contains("&lt;check&gt;"));
        assertTrue(ssml.contains("en-US-AvaMultilingualNeural"));
    }

    @Test
    void ssmlDoesNotEmphasizeRoutineEvents() {
        String ssml = service.toSSML("Yellow card shown", "YELLOW_CARD", "en-US-AvaMultilingualNeural");
        assertTrue(!ssml.contains("<emphasis"));
    }
}
