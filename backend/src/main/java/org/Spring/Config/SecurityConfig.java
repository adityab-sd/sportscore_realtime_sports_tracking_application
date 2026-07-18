package org.Spring.Config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
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

import java.util.Arrays;
import java.util.List;

/**
 * SINGLE SOURCE OF TRUTH for backend security.
 *
 * IMPORTANT: There must be no other @Configuration class defining
 * UserDetailsService, PasswordEncoder, or SecurityFilterChain beans.
 * A previous duplicate (UserConfig.java) silently overrode this file's
 * credentials because "spring.main.allow-bean-definition-overriding=true"
 * was set in application.properties. That flag has been removed
 * (see application.properties) and UserConfig.java has been deleted.
 * If Spring now fails to start complaining about a duplicate bean,
 * that means a leftover copy of UserConfig.java (or similar) still
 * exists somewhere in the project - search for it and delete it.
 */
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

    /**
     * Comma-separated list of allowed frontend origins.
     * Defaults to localhost:3000 if CORS_ALLOWED_ORIGINS is not set,
     * so nothing breaks if the env var is missing during local dev.
     * For prod/demo, set CORS_ALLOWED_ORIGINS=https://yourdomain.com
     */
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
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService());
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
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