package org.Spring.Config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.security.authentication.AuthenticationProvider;

import java.util.Arrays;
import java.util.List;


@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Value("${APP_ADMIN_USER}")
    private String adminUser;

    @Value("${APP_ADMIN_PASS}")
    private String adminPass;

    @Value("${APP_USER_NAME}")
    private String userName;

    @Value("${APP_USER_PASS}")
    private String userPass;

    
    @Value("${CORS_ALLOWED_ORIGINS:http://localhost:3000}")
    private String allowedOrigins;

    private final RateLimitFilter rateLimitFilter;

    public SecurityConfig(RateLimitFilter rateLimitFilter) {
        this.rateLimitFilter = rateLimitFilter;
    }

@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .cors(cors -> cors.configurationSource(corsConfigurationSource()))
        .csrf(csrf -> csrf.disable())
        .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .headers(headers -> headers
            // Forces browsers to only ever use HTTPS for this domain,
            // even if someone types http:// by mistake, for 2 years.
            .httpStrictTransportSecurity(hsts -> hsts
                .includeSubDomains(true)
                .maxAgeInSeconds(63072000)
            )
            // Stops the browser guessing file types, a common XSS vector.
            .contentTypeOptions(Customizer.withDefaults())
            // Prevents this API being embedded in an <iframe> elsewhere,
            // blocking clickjacking-style attacks.
            .frameOptions(frame -> frame.deny())
            // Limits how much referrer info leaks when a request originates
            // from this API and something links elsewhere from it.
            .referrerPolicy(referrer -> referrer
                .policy(org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN)
            )
        )
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/auth/**", "/public/**").permitAll()
            .requestMatchers("/api/admin/**").hasRole("ADMIN")
            .requestMatchers("/api/user/**").hasAnyRole("USER", "ADMIN")
            .anyRequest().authenticated()
        )
        .httpBasic(Customizer.withDefaults())
        // Rate limiter runs before authentication so it protects
        // even unauthenticated / public endpoints from abuse.
        .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class);

    return http.build();
}

    @Bean
    public UserDetailsService userDetailsService() {
        if (adminUser.equals(userName)) {
            throw new IllegalStateException(
                "APP_ADMIN_USER and APP_USER_NAME must be different usernames."
            );
        }

        UserDetails admin = User.builder()
            .username(adminUser)
            .password(passwordEncoder().encode(adminPass))
            .roles("ADMIN")
            .build();

        UserDetails user = User.builder()
            .username(userName)
            .password(passwordEncoder().encode(userPass))
            .roles("USER")
            .build();

        return new InMemoryUserDetailsManager(admin, user);
    }

    @Bean
public AuthenticationProvider authenticationProvider(LoginAttemptService loginAttemptService) {
    DaoAuthenticationProvider realProvider = new DaoAuthenticationProvider();
    realProvider.setUserDetailsService(userDetailsService());
    realProvider.setPasswordEncoder(passwordEncoder());

    
    return new LockingAuthenticationProvider(realProvider, loginAttemptService);
}

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .toList();
        configuration.setAllowedOrigins(origins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}