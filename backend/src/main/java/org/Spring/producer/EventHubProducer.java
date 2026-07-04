package org.Spring.producer;

import java.util.List;

import com.azure.messaging.eventhubs.EventData;
import com.azure.messaging.eventhubs.EventHubClientBuilder;
import com.azure.messaging.eventhubs.EventHubProducerClient;

@org.springframework.stereotype.Component
public class EventHubProducer {

    private final String connectionString;
    private final String eventHubName;

    public EventHubProducer(
            @org.springframework.beans.factory.annotation.Value("${eventhub.connection-string}") String connectionString,
            @org.springframework.beans.factory.annotation.Value("${eventhub.name}") String eventHubName) {
        this.connectionString = connectionString;
        this.eventHubName     = eventHubName;
    }

    public void send(String json) {
        // Guard: skip when running main() outside Spring (no connection string)
        if (connectionString == null || connectionString.isBlank()) {
            System.out.println("[EventHubProducer] No connection string - skipping send. Payload preview: "
                    + json.substring(0, Math.min(json.length(), 120)) + "...");
            return;
        }
        try (EventHubProducerClient client = new EventHubClientBuilder()
                .connectionString(connectionString, eventHubName)
                .buildProducerClient()) {
            client.send(List.of(new EventData(json)));
        }
    }
}