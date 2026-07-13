package org.Spring.producer;

import java.util.List;

import com.azure.messaging.eventhubs.EventData;
import com.azure.messaging.eventhubs.EventHubClientBuilder;
import com.azure.messaging.eventhubs.EventHubProducerClient;

// ============================================================================
// PLEASE review — Strategy + Null Object (GoF)
// ----------------------------------------------------------------------------
// "No connection string" is encoded as a null client plus an if-check in send().
// Every future method must remember that null-check, and the "log instead of send"
// behaviour leaks into production code. Model the two behaviours as two
// implementations behind one interface; the no-op arm is the Null Object.
//
// EXAMPLE:
//   public interface MatchPublisher { void send(String json); }
//
//   @Component @Profile("!local")
//   class EventHubPublisher implements MatchPublisher {
//       public void send(String j) { client.send(List.of(new EventData(j))); }
//   }
//
//   @Component @Profile("local")            // Null Object — safely does nothing
//   class NoOpPublisher implements MatchPublisher {
//       public void send(String j) { log.debug("skip publish, {} bytes", j.length()); }
//   }
//
// WHY: callers never null-check; the Spring profile picks the behaviour. Null Object
// exists precisely to delete "if (x == null)" branches.
// ============================================================================
@org.springframework.stereotype.Component
public class EventHubProducer {

    private final EventHubProducerClient client;

    public EventHubProducer(
            @org.springframework.beans.factory.annotation.Value("${eventhub.connection-string}") String connectionString,
            @org.springframework.beans.factory.annotation.Value("${eventhub.name}") String eventHubName) {
        this.client = (connectionString == null || connectionString.isBlank()) ? null
                : new EventHubClientBuilder()
                        .connectionString(connectionString, eventHubName)
                        .buildProducerClient();
    }

    public void send(String json) {
        if (client == null) {
            System.out.println("[EventHubProducer] No connection string - skipping send. Payload preview: "
                    + json.substring(0, Math.min(json.length(), 120)) + "...");
            return;
        }
        client.send(List.of(new EventData(json)));
    }
}
