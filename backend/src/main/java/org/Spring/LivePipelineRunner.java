package org.Spring;

import org.Spring.baseball.fetcher.CoreBaseballFetcher;
import org.Spring.basketball.fetcher.CoreBasketballFetcher;
import org.Spring.f1.fetcher.CoreF1Fetcher;
import org.Spring.fetcher.AbstractEspnFetcher;
import org.Spring.football.fetcher.CoreFootballFetcher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

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
//    UPDATE:
//    This issue has been resolved by adding a sportName() method in AbstractEspnFetcher class
// ============================================================================
@Component
public class LivePipelineRunner implements ApplicationRunner {

    private static final long POLL_MS = 30_000;

    private final List<AbstractEspnFetcher> fetchers;

    public LivePipelineRunner(List<AbstractEspnFetcher> fetchers) {
        this.fetchers = fetchers;
    }

    @Override
    public void run(ApplicationArguments args) {
        fetchers.forEach(fetcher ->
                startLoop(fetcher.sportName(),
                        fetcher::fetchAndPublishLive));
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

    // UPDATE:
    // Refactored based on review: replaced raw Thread + while(true) + sleep()
    // with a ScheduledExecutorService for managed, periodic execution.
    // ------------------------------------------------------------------------
    private final ScheduledExecutorService scheduler =
            Executors.newScheduledThreadPool(4);
    private static final Logger log =
            LoggerFactory.getLogger(LivePipelineRunner.class);

    private void startLoop(String sport, LiveTask task) {

        scheduler.scheduleWithFixedDelay(() -> {

            try {
                task.run();
                log.info("Published live {} matches", sport);
            }
            catch (Exception e) {
                log.error("{} fetch error", sport, e);
            }
        }, 0, POLL_MS, TimeUnit.MILLISECONDS);
    }
}