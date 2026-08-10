package org.Spring.api;

import java.net.http.HttpClient;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Tests for the shared EspnApiHelper base-class helpers.
 *
 * EspnApiHelper is abstract, so TestableHelper is a tiny concrete subclass that
 * exposes the protected helpers and swaps in a fake HTTP client which just
 * records the URL it was asked to fetch (no network). That lets us prove
 * getPaged() clamps pagination before it ever builds an upstream URL, plus the
 * null-safe node readers behave.
 */
class EspnApiHelperTest {

    private TestableHelper helper;

    @BeforeEach
    void setUp() {
        helper = new TestableHelper();
    }

    @Test
    @DisplayName("getPaged clamps an oversized limit down to 100")
    void getPagedClampsLimit() throws Exception {
        helper.callGetPaged("http://x/base", 1, 9999);
        assertThat(helper.lastUrl()).contains("limit=100");
    }

    @Test
    @DisplayName("getPaged floors a non-positive page up to 1")
    void getPagedFloorsPage() throws Exception {
        helper.callGetPaged("http://x/base", -5, 20);
        assertThat(helper.lastUrl()).contains("page=1");
        assertThat(helper.lastUrl()).contains("limit=20");
    }

    @Test
    @DisplayName("getPaged uses & as the separator when the base URL already has a query")
    void getPagedUsesAmpersandWhenQueryPresent() throws Exception {
        helper.callGetPaged("http://x/base?foo=bar", 1, 50);
        assertThat(helper.lastUrl()).contains("bar&page=1");
    }

    @Test
    @DisplayName("num() returns the value when present and null when missing/blank")
    void numReadsSafely() throws Exception {
        JsonNode root = new ObjectMapper().readTree("{\"v\":5,\"blank\":\"\"}");
        assertThat(helper.callNum(root.path("v"))).isEqualTo(5);
        assertThat(helper.callNum(root.path("missing"))).isNull();
        assertThat(helper.callNum(root.path("blank"))).isNull();
    }

    @Test
    @DisplayName("first() returns the first non-null value")
    void firstPicksFirstNonNull() {
        assertThat(helper.callFirst(null, null, "third", "fourth")).isEqualTo("third");
        assertThat(helper.callFirst((String) null, (String) null)).isNull();
    }

    /** Concrete subclass exposing the protected helpers and a URL-recording fake client. */
    static class TestableHelper extends EspnApiHelper {
        private final List<String> urls = new ArrayList<>();

        TestableHelper() {
            ObjectMapper om = new ObjectMapper();
            this.mapper = om;
            List<String> recorded = this.urls;
            this.espnHttp = new EspnHttpClient(HttpClient.newHttpClient(), om, null, null) {
                @Override public JsonNode get(String url) {
                    recorded.add(url);
                    return om.createObjectNode();
                }
            };
        }

        String lastUrl() { return urls.get(urls.size() - 1); }

        JsonNode callGetPaged(String base, int page, int limit) throws Exception {
            return getPaged(base, page, limit);
        }
        Integer callNum(JsonNode n) { return num(n); }
        String callFirst(String... vals) { return first(vals); }
    }
}