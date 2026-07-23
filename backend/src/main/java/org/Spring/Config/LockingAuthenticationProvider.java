package org.Spring.Config;

import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Component;


    public class LockingAuthenticationProvider implements AuthenticationProvider{

    private final AuthenticationProvider delegate;
    private final LoginAttemptService loginAttemptService;

    public LockingAuthenticationProvider(AuthenticationProvider delegate,
                                          LoginAttemptService loginAttemptService) {
        this.delegate = delegate;
        this.loginAttemptService = loginAttemptService;
    }

    @Override
    public Authentication authenticate(Authentication authentication) throws AuthenticationException {
        String username = authentication.getName();

        if (loginAttemptService.isBlocked(username)) {
            throw new LockedException(
                "Too many failed login attempts for this account. Please try again in a few minutes."
            );
        }

        try {
            Authentication result = delegate.authenticate(authentication);
            loginAttemptService.loginSucceeded(username);
            return result;
        } catch (BadCredentialsException e) {
            loginAttemptService.loginFailed(username);
            throw e;
        }
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return UsernamePasswordAuthenticationToken.class.isAssignableFrom(authentication);
    }
}