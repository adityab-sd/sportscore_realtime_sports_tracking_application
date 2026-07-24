package org.Spring.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.io.IOException;
import java.lang.reflect.Field;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * NOTE: @Retryable/@Recover are Spring AOP annotations - they only actually
 * retry/recover when this bean is proxied by a live Spring context. These
 * tests exercise the plain-Java behavior of get()/recover() directly; the
 * retry *triggering* (does a 5xx really get retried 3x with backoff) needs a
 * @SpringBootTest / @RestClientTest style integration test with the real
 * ApplicationContext, which is out of scope for a unit test.
 *
 * NOTE ON STUBBING STYLE: HttpClient.send() is a generic method
 * (<T> HttpResponse<T> send(HttpRequest, BodyHandler<T>)). Stubbing it with
 * when(rawClient.send(any(), any())).thenReturn(...) fails to compile because
 * javac can't pin down T from two any() matchers, so it infers HttpResponse<Object>
 * and rejects a HttpResponse<String> argument to thenReturn(). doReturn(...).when(...)
 * sidesteps this - it doesn't need to infer the generic return type at all - so every
 * stub below uses that form instead. thenThrow() doesn't have this problem (its
 * argument doesn't depend on T), so exception stubs are left as when(...).thenThrow(...).
 */
class EspnHttpClientTest {

    private HttpClient rawClient;
    private ObjectMapper mapper;
    private EspnHttpClient client;

    @BeforeEach
    void setUp() {
        rawClient = mock(HttpClient.class);
        mapper = new ObjectMapper();
        client = new EspnHttpClient(rawClient, mapper);
    }

    @SuppressWarnings("unchecked")
    private HttpResponse<String> mockResponse(int status, String body) {
        HttpResponse<String> res = mock(HttpResponse.class);
        when(res.statusCode()).thenReturn(status);
        when(res.body()).thenReturn(body);
        return res;
    }

    @SuppressWarnings("unchecked")
    private void stubSend(HttpResponse<String> response) throws Exception {
        doReturn(response).when(rawClient).send(any(), any());
    }

    @Test
    void get_200_parsesJsonBody() throws Exception {
        stubSend(mockResponse(200, "{\"hello\":\"world\"}"));
        JsonNode result = client.get("https://site.api.espn.com/foo");
        assertEquals("world", result.path("hello").asText());
    }

    @Test
    void get_4xx_returnsEmptyNode_doesNotThrow() throws Exception {
        stubSend(mockResponse(404, "not found"));
        JsonNode result = client.get("https://site.api.espn.com/missing");
        assertTrue(result.isObject());
        assertEquals(0, result.size(), "4xx should short-circuit to an empty node, not attempt to parse the error body as JSON");
    }

    @Test
    void get_400_returnsEmptyNode() throws Exception {
        stubSend(mockResponse(400, "bad request"));
        assertTrue(client.get("https://site.api.espn.com/bad").isObject());
    }

    @Test
    void get_5xx_throwsEspnServerException() throws Exception {
        stubSend(mockResponse(503, "unavailable"));
        EspnHttpClient.EspnServerException ex = assertThrows(
                EspnHttpClient.EspnServerException.class,
                () -> client.get("https://site.api.espn.com/scoreboard"));
        assertEquals(503, ex.status);
    }

    @Test
    void get_500_throwsEspnServerException_withUrlInMessage() throws Exception {
        stubSend(mockResponse(500, "error"));
        EspnHttpClient.EspnServerException ex = assertThrows(
                EspnHttpClient.EspnServerException.class,
                () -> client.get("https://site.api.espn.com/x"));
        assertTrue(ex.getMessage().contains("https://site.api.espn.com/x"));
    }

    @Test
    void get_ioException_propagates_soRetryableCanCatchIt() throws Exception {
        when(rawClient.send(any(), any())).thenThrow(new IOException("connection reset"));
        assertThrows(IOException.class, () -> client.get("https://site.api.espn.com/x"));
    }

    @Test
    void get_interruptedException_resetsInterruptFlagAndRethrows() throws Exception {
        when(rawClient.send(any(), any())).thenThrow(new InterruptedException("interrupted"));
        assertThrows(InterruptedException.class, () -> client.get("https://site.api.espn.com/x"));
        assertTrue(Thread.interrupted(), "interrupt flag should be restored on the current thread");
    }

    @Test
    void get_200_withEmptyBody_throwsRatherThanReturningNull() throws Exception {
        // ESPN occasionally returns 200 with an empty body for off-season endpoints.
        // Worth pinning down: there's no empty-body guard before mapper.readTree(),
        // so this currently throws instead of degrading to an empty node like the
        // 4xx path does. If that's not the intended behavior, it's a gap worth a fix.
        stubSend(mockResponse(200, ""));
        assertThrows(Exception.class, () -> client.get("https://site.api.espn.com/x"));
    }

    @Test
    void get_sendsExpectedHeaders() throws Exception {
        stubSend(mockResponse(200, "{}"));
        client.get("https://site.api.espn.com/x");

        ArgumentCaptor<HttpRequest> captor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(rawClient).send(captor.capture(), any());
        HttpRequest sent = captor.getValue();

        assertEquals("GET", sent.method());
        assertTrue(sent.headers().firstValue("User-Agent").isPresent(),
                "ESPN's public endpoint can reject requests with no browser-like User-Agent");
        assertEquals("application/json, text/plain, */*", sent.headers().firstValue("Accept").orElse(null));
        assertEquals("https://www.espn.com", sent.headers().firstValue("Origin").orElse(null));
    }

    @Test
    void recover_espnServerException_returnsEmptyNode() {
        JsonNode result = client.recover(new EspnHttpClient.EspnServerException(503, "https://x"), "https://x");
        assertTrue(result.isObject());
        assertEquals(0, result.size());
    }

    @Test
    void recover_ioException_returnsEmptyNode() {
        JsonNode result = client.recover(new IOException("boom"), "https://x");
        assertTrue(result.isObject());
        assertEquals(0, result.size());
    }

    @Test
    void timeout_defaultsToInjectedValue_andIsAppliedToRequest() throws Exception {
        // @Value has no Spring context in a plain unit test, so set it the way
        // Spring would via reflection and confirm it actually reaches the request.
        Field timeoutField = EspnHttpClient.class.getDeclaredField("timeout");
        timeoutField.setAccessible(true);
        timeoutField.set(client, 7);

        stubSend(mockResponse(200, "{}"));
        client.get("https://site.api.espn.com/x");

        ArgumentCaptor<HttpRequest> captor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(rawClient).send(captor.capture(), any());
        assertEquals(java.time.Duration.ofSeconds(7), captor.getValue().timeout().orElse(null));
    }
}