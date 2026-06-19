package org.Spring;

import org.Spring.Coresports.CoreSportsFetcher;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class FootballPipelineRunner implements ApplicationRunner {

    private final CoreSportsFetcher fetcher;

    public FootballPipelineRunner(CoreSportsFetcher fetcher) {
        this.fetcher = fetcher;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        while (true) {
            try {
                fetcher.fetchAndPublishLive();
                System.out.println("Published fifa.world matches to Event Hub");
            } catch (Exception e) {
                System.err.println("Fetch error: " + e.getMessage());
            }
            Thread.sleep(30_000);
        }
    }
}
