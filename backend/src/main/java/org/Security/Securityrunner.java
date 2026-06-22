package org.Security;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

@SpringBootApplication
public class Securityrunner {
    public static void main(String[] args) {
        SpringApplication.run(Securityrunner.class, args);
    }
}

@Service
class SportsDataService {
    // Marked as final because they don't change
    private final String apiKey = "519be988864b450f4ab9eb5a85971cc1"; 
    private final String baseUrl = "https://sports.core.api.espn.com/v2/sports/soccer";
    private final RestTemplate restTemplate = new RestTemplate();

    public String getLiveMatchScores() {
        return "Backend is running! Securely loaded base URL: " + baseUrl;
    }
}

@RestController
class SportsController {
    private final SportsDataService sportsDataService;

    public SportsController(SportsDataService sportsDataService) {
        this.sportsDataService = sportsDataService;
    }

    @GetMapping("/api/scores")
    public String checkScores() {
        return sportsDataService.getLiveMatchScores();
    }
}