package org.Spring.producer;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Tests for EventHubProducer's fail-fast validation.
 *
 * The constructor guards against someone wiring the wrong value into the Event
 * Hub connection string (e.g. a raw API key instead of the full connection
 * string) — it should fail clearly at startup, not later with a cryptic Azure
 * error. A blank connection string is allowed (that's the "running locally
 * without Azure" case), and in that mode send() must be a safe no-op.
 */
class EventHubProducerTest {

    @Test
    @DisplayName("a value that isn't a real connection string is rejected at construction")
    void badConnectionStringThrows() {
        assertThatThrownBy(() -> new EventHubProducer("just-an-api-key", "hub"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("a blank connection string is allowed (local / no-Azure mode)")
    void blankConnectionStringAllowed() {
        assertThatCode(() -> new EventHubProducer("", "hub")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("a valid-looking connection string is accepted")
    void validConnectionStringAllowed() {
        String conn = "Endpoint=sb://ns.servicebus.windows.net/;SharedAccessKeyName=k;SharedAccessKey=abc123";
        assertThatCode(() -> new EventHubProducer(conn, "hub")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("send() on a blank-connection producer is a safe no-op, not a crash")
    void blankProducerSendIsNoOp() {
        EventHubProducer producer = new EventHubProducer("", "hub");
        assertThatCode(() -> producer.send("[{\"id\":1}]")).doesNotThrowAnyException();
    }
}