package org.Spring;

import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.Spring.fetcher.AbstractEspnFetcher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Live pipeline orchestrator for ALL sports. Each sport runs on its own daemon
 * thread, polling its provider and pushing only in-progress matches to Event
 * Hub. Separate threads mean one sport's slow/failed fetch never stalls the
 * others, and the app context finishes starting normally.
 */
// Addressed: fetchers are now injected as List<AbstractEspnFetcher> so adding a new
// sport is just a new @Component with zero edits here. Each fetcher provides its own
// sportName() via the base class, and the runner loops generically over all of them.
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

    // Addressed: replaced raw Thread + while(true) + sleep() with a ScheduledExecutorService
    // for managed periodic execution, and replaced System.out/err with SLF4J logging.
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