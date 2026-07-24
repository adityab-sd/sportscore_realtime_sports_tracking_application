package org.Spring.producer;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;

import static org.junit.jupiter.api.Assertions.*;

class EventHubProducerTest {

    private static final String VALID_CONNECTION_STRING =
            "Endpoint=sb://example.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=fake";

    private final PrintStream originalOut = System.out;
    private ByteArrayOutputStream capturedOut;

    @BeforeEach
    void captureStdOut() {
        capturedOut = new ByteArrayOutputStream();
        System.setOut(new PrintStream(capturedOut));
    }

    @AfterEach
    void restoreStdOut() {
        System.setOut(originalOut);
    }

    // ---------------------------------------------------------------
    // constructor validation
    // ---------------------------------------------------------------

    @Test
    void constructor_nullConnectionString_doesNotThrow() {
        assertDoesNotThrow(() -> new EventHubProducer(null, "hub"));
    }

    @Test
    void constructor_blankConnectionString_doesNotThrow() {
        assertDoesNotThrow(() -> new EventHubProducer("   ", "hub"));
    }

    @Test
    void constructor_validConnectionString_doesNotThrow() {
        assertDoesNotThrow(() -> new EventHubProducer(VALID_CONNECTION_STRING, "hub"));
    }

    @Test
    void constructor_missingEndpointPrefix_throwsIllegalStateException() {
        String badValue = "SharedAccessKey=someRawApiKeyAccidentallyUsedHere";
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> new EventHubProducer(badValue, "hub"));
        assertFalse(ex.getMessage().contains(badValue),
                "error message must not leak the bad/partial secret value into logs");
    }

    @Test
    void constructor_missingSharedAccessKey_throwsIllegalStateException() {
        String badValue = "Endpoint=sb://example.servicebus.windows.net/";
        assertThrows(IllegalStateException.class, () -> new EventHubProducer(badValue, "hub"));
    }

    @Test
    void constructor_rawApiKeyInsteadOfConnectionString_throwsIllegalStateException() {
        // The scenario the guard exists for: someone pastes just the key, not
        // the full "Endpoint=sb://...;SharedAccessKey=..." connection string.
        String rawKey = "aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890==";
        assertThrows(IllegalStateException.class, () -> new EventHubProducer(rawKey, "hub"));
    }

    @Test
    void constructor_errorMessage_explainsWhatWentWrong() {
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> new EventHubProducer("garbage", "hub"));
        assertTrue(ex.getMessage().contains("EVENTHUB_CONNECTION_STRING"));
    }

    // ---------------------------------------------------------------
    // send() guard when no connection string is configured
    // ---------------------------------------------------------------

    @Test
    void send_nullConnectionString_skipsSendWithoutThrowing() {
        EventHubProducer producer = new EventHubProducer(null, "hub");
        assertDoesNotThrow(() -> producer.send("{\"status\":\"LIVE\"}"));
        assertTrue(capturedOut.toString().contains("[EventHubProducer] No connection string"));
    }

    @Test
    void send_blankConnectionString_skipsSendWithoutThrowing() {
        EventHubProducer producer = new EventHubProducer("", "hub");
        assertDoesNotThrow(() -> producer.send("{\"status\":\"LIVE\"}"));
        assertTrue(capturedOut.toString().contains("No connection string"));
    }

    @Test
    void send_shortPayload_printedInFull_noTruncationEllipsisConfusion() {
        EventHubProducer producer = new EventHubProducer(null, "hub");
        String shortPayload = "{\"status\":\"LIVE\"}";
        producer.send(shortPayload);
        assertTrue(capturedOut.toString().contains(shortPayload));
    }

    @Test
    void send_longPayload_previewTruncatedTo120Chars() {
        EventHubProducer producer = new EventHubProducer(null, "hub");
        String longPayload = "x".repeat(500);
        producer.send(longPayload);

        String output = capturedOut.toString();
        // Preview must contain exactly the first 120 chars, not the full 500.
        assertTrue(output.contains("x".repeat(120)));
        assertFalse(output.contains("x".repeat(121)),
                "payload preview should be capped at 120 chars, not leak the full message");
    }

    @Test
    void send_emptyPayload_doesNotThrow() {
        EventHubProducer producer = new EventHubProducer(null, "hub");
        assertDoesNotThrow(() -> producer.send(""));
    }
}