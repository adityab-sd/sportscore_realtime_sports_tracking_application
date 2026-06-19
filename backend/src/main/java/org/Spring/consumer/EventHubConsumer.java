package org.Spring.consumer;

import com.azure.messaging.eventhubs.EventHubClientBuilder;
import com.azure.messaging.eventhubs.EventHubConsumerClient;
import com.azure.messaging.eventhubs.models.EventPosition;
import com.azure.messaging.eventhubs.models.PartitionEvent;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.Spring.model.Match;

import java.time.Duration;
import java.util.List;

public class EventHubConsumer {

    private final EventHubConsumerClient consumer;
    private final ObjectMapper mapper = new ObjectMapper();

    public EventHubConsumer(String connectionString, String eventHubName) {
        this.consumer = new EventHubClientBuilder()
                .connectionString(connectionString, eventHubName)
                .consumerGroup(EventHubClientBuilder.DEFAULT_CONSUMER_GROUP_NAME)
                .buildConsumerClient();
    }

    public void startListening() {
        new Thread(() -> {
            try {
                for (String partitionId : consumer.getPartitionIds()) {
                    System.out.println("Listening on partition: " + partitionId);
                    for (PartitionEvent event : consumer.receiveFromPartition(
                            partitionId, 100, EventPosition.latest(), Duration.ofSeconds(30))) {
                        List<Match> matches = mapper.readValue(
                                event.getData().getBodyAsString(),
                                new TypeReference<List<Match>>() {});
                        if (matches.isEmpty()) {
                            System.out.println("No live matches.");
                            continue;
                        }
                        matches.forEach(m -> {
                            System.out.printf("[%s] %s | %s %d - %d %s | Elapsed: %s min%n",
                                    m.competition(), m.status(),
                                    m.homeTeam().name(), m.homeScore(),
                                    m.awayScore(), m.awayTeam().name(),
                                    m.elapsed());
                            m.events().forEach(e -> System.out.printf("  %d' [%s] %s%s%n",
                                    e.minute(), e.type(), e.player(),
                                    e.assist() != null ? " (assist: " + e.assist() + ")" : ""));
                        });
                    }
                }
            } catch (Exception e) {
                System.err.println("Consumer error: " + e.getMessage());
            }
        }).start();
    }
}
