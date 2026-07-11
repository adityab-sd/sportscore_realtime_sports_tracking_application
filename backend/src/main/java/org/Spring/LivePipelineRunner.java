package org.Spring;

import org.Spring.football.fetcher.CoreFootballFetcher;
import org.Spring.baseball.fetcher.CoreBaseballFetcher;
import org.Spring.basketball.fetcher.CoreBasketballFetcher;
import org.Spring.f1.fetcher.CoreF1Fetcher;
import org.Spring.radio.pipeline.RadioEventBridge;
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
public class LivePipelineRunner implements ApplicationRunner {

    private static final long POLL_MS = 30_000;

    private final CoreFootballFetcher     football;
    private final CoreBasketballFetcher basketball;
    private final CoreBaseballFetcher   baseball;
    private final CoreF1Fetcher         f1;
    private final RadioEventBridge      radioBridge;

    public LivePipelineRunner(CoreFootballFetcher football,
                                  CoreBasketballFetcher basketball,
                                  CoreBaseballFetcher baseball,
                                  CoreF1Fetcher f1,
                                  RadioEventBridge radioBridge) {
        this.football    = football;
        this.basketball  = basketball;
        this.baseball    = baseball;
        this.f1          = f1;
        this.radioBridge = radioBridge;
    }

    @Override
    public void run(ApplicationArguments args) {
        startLoop("football",   () -> {
            List<org.Spring.model.Match> liveMatches = football.fetchAllMatches();
            radioBridge.process(liveMatches);
            // Re-use already-fetched list for the score hub publish
            football.publishMatches(liveMatches);
        });
        startLoop("basketball", basketball::fetchAndPublishLive);
        startLoop("baseball",   baseball::fetchAndPublishLive);
        startLoop("f1",         f1::fetchAndPublishLive);
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