package org.Spring.basketball.api;

import org.Spring.api.Dto;

import java.util.List;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/basketball")
@CrossOrigin(origins = "*")
public class BasketballController {

    private final BasketballService service;

    public BasketballController(BasketballService service) {
        this.service = service;
    }

    @GetMapping("/{league}/scoreboard")
    public List<BasketballDto.GameDto> scoreboard(@PathVariable String league) throws Exception {
        return service.scoreboard(league);
    }

    @GetMapping("/{league}/fixtures")
    public BasketballDto.Fixtures fixtures(@PathVariable String league) throws Exception {
        return service.fixtures(league);
    }

    @GetMapping("/{league}/standings")
    public List<BasketballDto.StandingRow> standings(@PathVariable String league) throws Exception {
        return service.standings(league);
    }

    @GetMapping("/{league}/news")
    public List<Dto.NewsItem> news(@PathVariable String league,
                                   @RequestParam(defaultValue = "12") int limit) throws Exception {
        return service.news(league, limit);
    }

    @GetMapping("/{league}/teams/{teamId}")
    public Dto.TeamDetail team(@PathVariable String league,
                               @PathVariable String teamId) throws Exception {
        return service.team(league, teamId);
    }

    @GetMapping("/{league}/teams/{teamId}/roster")
    public List<Dto.Player> roster(@PathVariable String league,
                                   @PathVariable String teamId) throws Exception {
        return service.roster(league, teamId);
    }

    @GetMapping("/{league}/leaders")
    public List<Dto.Leader> leaders(@PathVariable String league) throws Exception {
        return service.leaders(league);
    }

    @GetMapping("/{league}/match/{eventId}")
    public BasketballDto.GameDetail matchDetail(@PathVariable String league,
                                               @PathVariable String eventId) throws Exception {
        return service.matchDetail(league, eventId);
    }
}