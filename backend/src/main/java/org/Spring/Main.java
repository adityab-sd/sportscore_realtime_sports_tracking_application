2️⃣ Update the Java Service Code (Example API Service)
To see how this works in your actual Java code, here is an example of a secure service class utilizing your hidden keys. It uses Spring's @Value annotation to safely inject your live match API credentials at runtime:

Java
package com.sportsscore.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class SportsDataService {

    // Safely injects the hidden key from your .env file
    @Value("${sports.api.key}")
    private String apiKey;

    @Value("${sports.api.base-url}")
    private String baseUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    public String getLiveMatchScores() {
        // Build the secure URL using the hidden API key
        String url = baseUrl + "/scores/json/AllLiveMatches?key=" + apiKey;
        
        // Fetch the data from the external provider safely
        return restTemplate.getForObject(url, String.class);
    }
}