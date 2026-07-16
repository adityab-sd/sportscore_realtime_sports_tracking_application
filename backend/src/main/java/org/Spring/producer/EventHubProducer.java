package org.Spring.Producer;

import java.util.List;

import com.azure.messaging.eventhubs.EventData;
import com.azure.messaging.eventhubs.EventHubClientBuilder;
import com.azure.messaging.eventhubs.EventHubProducerClient;

// ============================================================================
// TODO (future refactor, not blocking): Strategy + Null Object (GoF)
// ----------------------------------------------------------------------------
// "No connection string" is currently encoded as a null-check in send().
// Consider modeling the two behaviours (real publish vs. local no-op log)
// as two implementations behind one interface, selected via Spring @Profile.
// See team discussion for the suggested MatchPublisher interface design.
// ============================================================================
@org.springframework.stereotype.Component
public class EventHubProducer {

    private final String connectionString;
    private final String eventHubName;

    public EventHubProducer(
            @org.springframework.beans.factory.annotation.Value("${EVENTHUB_CONNECTION_STRING}") String connectionString,
            @org.springframework.beans.factory.annotation.Value("${EVENTHUB_NAME}") String eventHubName) {

        // FAIL-SAFE VALIDATION: a real Azure Event Hub connection string always
        // starts with "Endpoint=sb://" and contains "SharedAccessKey=".
        // If either is missing, something upstream passed the wrong value
        // (e.g. a raw API key instead of the full connection string) -
        // catch that HERE, at startup, with a clear message, instead of
        // letting it fail later with a cryptic Azure SDK error that also
        // leaks part of the bad value into the