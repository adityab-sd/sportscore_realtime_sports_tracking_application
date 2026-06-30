package org.Spring;

import org.Spring.Coresports.CoreSportsFetcher;
import org.Spring.fetcher.basketball.CoreBasketballFetcher;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Live pipeline orchestrator for ALL sports. Each sport runs on its own daemon
 * thread, polling its provider and pushing only in-progress matches to Event
 * Hub. Separate threads mean one sport's slow/failed fetch never stalls the
 * others, and the app context finishes starting normally.
 */
@Component
public class FootballPipelineRunner implements ApplicationRunner {

    private static final long POLL_MS = 30_000;

    private final CoreSportsFetcher football;
    private final CoreBasketballFetcher basketball;

    public FootballPipelineRunner(CoreSportsFetcher football,
                                  CoreBasketballFetcher basketball) {
        this.football = football;
        this.basketball = basketball;
    }

    @Override
    public void run(ApplicationArguments args) {
        startLoop("football", football::fetchAndPublishLive);
        startLoop("basketball", basketball::fetchAndPublishLive);
    }

    @FunctionalInterface
    private interface LiveTask { void run() throws Exception; }

    private void startLoop(String sport, LiveTask task) {
        Thread t = new Thread(() -> {
            while (true) {
                try {
                    task.run();
                    System.out.println("Published live " + sport + " matches to Event Hub");
                } catch (Exception e) {
                    System.err.println(sport + " fetch error: " + e.getMessage());
                }
                try {
                    Thread.sleep(POLL_MS);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return;
                }
            }
        }, sport + "-live-pipeline");
        t.setDaemon(true);
        t.start();
    }
}