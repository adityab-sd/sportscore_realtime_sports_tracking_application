package org.Spring;

import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import io.github.cdimascio.dotenv.Dotenv;

@SpringBootApplication
@org.springframework.retry.annotation.EnableRetry
public class Main {

    private static final List<String> REQUIRED_KEYS = List.of(
        "APP_ADMIN_USER", "APP_ADMIN_PASS",
        "APP_USER_NAME", "APP_USER_PASS",
        "SIGNALR_CONNECTION_STRING", "SIGNALR_HUB",
        "EVENTHUB_CONNECTION_STRING", "EVENTHUB_NAME"
    );

    public static void main(String[] args) {
        Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();

        // Local dev: load .env values into system properties.
        dotenv.entries().forEach(e -> System.setProperty(e.getKey(), e.getValue()));

        // ADDED: bridge platform-supplied environment variables (e.g. Azure App Service
        // application settings) into system properties, so this app boots the same whether
        // config comes from a local .env file or from the hosting platform. Only the keys we
        // actually need are bridged, and existing .env / -D values take precedence.
        Stream.concat(REQUIRED_KEYS.stream(), Stream.of("JASYPT_ENCRYPTOR_PASSWORD"))
              .forEach(key -> {
                  if (System.getProperty(key) == null) {
                      String env = System.getenv(key);
                      if (env != null && !env.isBlank()) {
                          System.setProperty(key, env);
                      }
                  }
              });

        // Bridge our naming convention to the exact property name Jasypt expects.
        // Reads from system properties, which now cover both .env and platform env vars.
        String jasyptPassword = System.getProperty("JASYPT_ENCRYPTOR_PASSWORD");
        if (jasyptPassword != null && !jasyptPassword.isBlank()) {
            System.setProperty("jasypt.encryptor.password", jasyptPassword);
        }

        List<String> missing = REQUIRED_KEYS.stream()
            .filter(key -> System.getProperty(key) == null || System.getProperty(key).isBlank())
            .collect(Collectors.toList());

        if (!missing.isEmpty()) {
            System.err.println("=================================================");
            System.err.println("STARTUP FAILED: missing required config values:");
            missing.forEach(k -> System.err.println("  - " + k));
            System.err.println("Provide them via backend/.env (local) or as");
            System.err.println("environment variables / app settings (deployed).");
            System.err.println("=================================================");
            System.exit(1);
        }

        System.out.println("[Startup] All required configuration present. Starting application...");
        SpringApplication.run(Main.class, args);
    }
}