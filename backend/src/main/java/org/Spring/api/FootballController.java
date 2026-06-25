package org.Spring.api;

import java.util.List;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Clean football endpoints for the frontend. Returns DTOs whose shapes match
 * the frontend's TypeScript interfaces, so Vamsi only fetches-and-uses (no parsing).
 *
 * Live scores are NOT here - they are pushed via Event Hub -> SignalR.
 *
 * Replaces FootballGatewayController.java / any earlier FootballController.java.
 * Keep only ONE controller on /api/football/** or Spring won't start.
 */
@RestController
@RequestMapping("/api/football")
@CrossOrigin(origins = "*")
public class FootballController {

    private final FootballService service;

    public FootballController(FootballService service) {
        this.service = service;
    }

    @GetMapping("/{league}/scoreboard")
    public List<Dto.MatchDto> scoreboard(@PathVariable String league) throws Exception {
        return service.scoreboard(league);
    }

    @GetMapping("/{league}/fixtures")
    public Dto.Fixtures fixtures(@PathVariable String league) throws Exception {
        return service.fixtures(league);
    }

    @GetMapping("/{league}/standings")
    public List<Dto.StandingRow> standings(@PathVariable String league) throws Exception {
        return service.standings(league);
    }

    @GetMapping("/{league}/news")
    public List<Dto.NewsItem> news(@PathVariable String league,
                                   @RequestParam(defaultValue = "12") int limit) throws Exception {
        return service.news(league, limit);
    }

    @GetMapping("/{league}/teams/{teamId}")
    public Dto.TeamDetail team(@PathVariable String league, @PathVariable String teamId) throws Exception {
        return service.team(league, teamId);
    }

    @GetMapping("/{league}/teams/{teamId}/roster")
    public List<Dto.Player> roster(@PathVariable String league, @PathVariable String teamId) throws Exception {
        return service.roster(league, teamId);
    }

    @GetMapping("/{league}/leaders")
    public List<Dto.Leader> leaders(@PathVariable String league) throws Exception {
        return service.leaders(league);
    }

    @GetMapping("/{league}/match/{eventId}")
    public Dto.MatchDetail matchDetail(@PathVariable String league, @PathVariable String eventId) throws Exception {
        return service.matchDetail(league, eventId);
    }
}
