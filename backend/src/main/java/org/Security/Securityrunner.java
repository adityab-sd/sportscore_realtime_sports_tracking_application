package org.Security;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

// ============================================================================
// PLEASE review — two @SpringBootApplication entry points (this + org.Spring.Main)
// create ambiguous bootstrapping. Keep ONE. This looks like a throwaway probe
// (SportsDataService just echoes a string), so it should be removed or merged.
// EXAMPLE: keep org.Spring.Main as the single @SpringBootApplication and delete this
// class (or demote it to a plain @RestController with no main()).
// ============================================================================
@SpringBootApplication
public class Securityrunner {
    public static void main(String[] args) {
        SpringApplication.run(Securityrunner.class, args);
    }
}

@Service
class SportsDataService {
    // ========================================================================
    // PLEASE review — SECURITY (highest severity): hard-coded live API key.
    // A real secret is committed to Git (and its history), ironically in a class
    // named "Security". Rotate it NOW and load from config / Key Vault. Note the real
    // Key Vault wiring in KeyVaultConfig.java is entirely commented out.
    //
    // EXAMPLE:
    //   @Value("${apisports.key}") private String apiKey;   // from env / Key Vault, never a literal
    // ========================================================================
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