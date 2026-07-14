package org.Spring;

import org.Spring.baseball.fetcher.CoreBaseballFetcher;
import org.Spring.basketball.fetcher.CoreBasketballFetcher;
import org.Spring.f1.fetcher.CoreF1Fetcher;
import org.Spring.football.fetcher.CoreFootballFetcher;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Live pipeline orchestrator for ALL sports. Each sport runs on its own daemon
 * thread, polling its provider and pushing only in-progress matches to Event
 * Hub. Separate threads mean one sport's slow/failed fetch never stalls the
 * others, and the app context finishes starting normally.
 */
// ============================================================================
// PLEASE review — Strategy (GoF)
// ----------------------------------------------------------------------------
// This runner hard-codes all four fetchers by constructor and repeats startLoop(..)
// per sport, so every new sport must edit THIS class (breaks Open/Closed). Once the
// fetchers share a base type (see CoreFootballFetcher's Template Method note), treat
// them as interchangeable Strategy objects and let Spring inject the whole family.
//
// EXAMPLE — inject every fetcher bean and loop generically:
//
//   private final List<LiveSportFetcher> fetchers;
//   public LivePipelineRunner(List<LiveSportFetcher> fetchers) { this.fetchers = fetchers; }
//
//   @Override public void run(ApplicationArguments args) {
//       fetchers.forEach(f -> startLoop(f.sportName(), f::fetchAndPublishLive));
//   }
//
// WHY: a new sport becomes a new @Component with ZERO edits here. Injecting
// List<Interface> to receive "all strategies" is idiomatic Spring.
// ============================================================================
@Component
public class LivePipelineRunner implements ApplicationRunner {

    private static final long POLL_MS = 30_000;

    private final CoreFootballFetcher     football;
    private final CoreBasketballFetcher basketball;
    private final CoreBaseballFetcher   baseball;
    private final CoreF1Fetcher         f1;

    public LivePipelineRunner(CoreFootballFetcher football,
                                  CoreBasketballFetcher basketball,
                                  CoreBaseballFetcher baseball,
                                  CoreF1Fetcher f1) {
        this.football   = football;
        this.basketball = basketball;
        this.baseball   = baseball;
        this.f1         = f1;
    }

    @Override
    public void run(ApplicationArguments args) {
        startLoop("football",   football::fetchAndPublishLive);
        startLoop("basketball", basketball::fetchAndPublishLive);
        startLoop("baseball",   baseball::fetchAndPublishLive);
        startLoop("f1",         f1::fetchAndPublishLive);
    }

    @FunctionalInterface
    private interface LiveTask { void run() throws Exception; }

    // ------------------------------------------------------------------------
    // PLEASE review — concurrency / observability (not GoF, but higher severity)
    // Raw `new Thread(while(true))` with Thread.sleep and System.out/err is fragile:
    // no back-pressure, no metrics, no graceful shutdown, and per-poll error handling
    // is ad hoc. Prefer a managed scheduler + a real logger.
    //
    // EXAMPLE:
    //   ScheduledExecutorService pool = Executors.newScheduledThreadPool(4);
    //   pool.scheduleWithFixedDelay(() -> safeRun(sport, task), 0, POLL_MS, MILLISECONDS);
    //   // and: log.info("Published live {} matches to Event Hub", sport);   // not System.out
    // ------------------------------------------------------------------------
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