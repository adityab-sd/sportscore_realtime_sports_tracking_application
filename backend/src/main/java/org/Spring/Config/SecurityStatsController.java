package org.Spring.Config;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Exposes non-sensitive, aggregate security stats for the public
 * Security & Privacy page. Only returns counts - no IPs, usernames,
 * timestamps, or any identifying information about who was blocked.
 */
@RestController
public class SecurityStatsController {

    private final SecurityStatsService statsService;

    public SecurityStatsController(SecurityStatsService statsService) {
        this.statsService = statsService;
    }

    @GetMapping("/api/security/stats")
    public Map<String, Long> getStats() {
        return Map.of(
            "blockedRequests", statsService.getBlockedRequests(),
            "lockedAccounts", statsService.getLockedAccounts()
        );
    }
}