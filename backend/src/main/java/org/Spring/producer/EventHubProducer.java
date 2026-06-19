package org.Spring.producer;

import com.azure.messaging.eventhubs.EventData;
import com.azure.messaging.eventhubs.EventHubClientBuilder;
import com.azure.messaging.eventhubs.EventHubProducerClient;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Properties;

@org.springframework.stereotype.Component
public class EventHubProducer {

    private final String connectionString;
    private final String eventHubName;

    public EventHubProducer(
            @org.springframework.beans.factory.annotation.Value("${eventhub.connection-string}") String connectionString,
            @org.springframework.beans.factory.annotation.Value("${eventhub.name}") String eventHubName) {
        this.connectionString = connectionString;
        this.eventHubName = eventHubName;
    }

    public void send(String json) {
        try (EventHubProducerClient client = new EventHubClientBuilder()
                .connectionString(connectionString, eventHubName)
                .buildProducerClient()) {
            client.send(List.of(new EventData(json)));
        }
    }
}
