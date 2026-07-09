package org.Spring.producer;

import java.util.List;

import com.azure.messaging.eventhubs.EventData;
import com.azure.messaging.eventhubs.EventHubClientBuilder;
import com.azure.messaging.eventhubs.EventHubProducerClient;

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
