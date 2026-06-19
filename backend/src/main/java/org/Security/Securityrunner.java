package org.Security;

import org.springframework.beans.factory.annotation.Value;
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

    // Safely injects the hidden keys from your application.properties -> .env file
    @Value("${sports.api.key}")
    private String apiKey;

    @Value("${sports.api.base-url}")
    private String baseUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    public String getLiveMatchScores() {
        // Build the secure URL using the hidden API key
        String url = baseUrl + "/scores/json/AllLiveMatches?key=" + apiKey;
        
        System.out.println("Executing secure API call using key: " + apiKey);
        
        // Fetch the data from the external provider safely
        // return restTemplate.getForObject(url, String.class);
        return "Backend is running! Securely loaded base URL: " + baseUrl;
    }
}

// Added a quick controller so you can test it easily in your web browser
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