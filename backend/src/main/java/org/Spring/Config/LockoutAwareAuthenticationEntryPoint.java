package org.Spring.Config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Distinguishes "account locked" from generic "bad credentials" in the
 * HTTP response, so the frontend can show an accurate message instead of
 * a generic "invalid password" for both cases.
 *
 * Standard Spring Security Basic Auth returns 401 for every authentication
 * failure with no way to tell them apart. We return 423 Locked specifically
 * for LockedException, keeping 401 for everything else.
 */
@Component
public class LockoutAwareAuthenticationEntryPoint implements AuthenticationEntryPoint {

    @Override
    public void commence(HttpServletRequest request,
                          HttpServletResponse response,
                          AuthenticationException authException) throws IOException {

        if (authException instanceof LockedException) {
            response.setStatus(423); // 423 Locked
            response.setContentType("application/json");
            response.getWriter().write(
                "{\"error\":\"account_locked\",\"message\":\"" +
                "Too many failed login attempts. Please try again in a few minutes.\"}"
            );
            return;
        }

        response.setHeader("WWW-Authenticate", "Basic realm=\"SportScore\"");
        response.setStatus(401);
        response.setContentType("application/json");
        response.getWriter().write(
            "{\"error\":\"invalid_credentials\",\"message\":\"Invalid username or password.\"}"
        );
    }
}
