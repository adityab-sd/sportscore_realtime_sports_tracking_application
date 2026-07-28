package org.Spring;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.util.List;
import java.util.stream.Collectors;

// NOTE from teammate: a second @SpringBootApplication exists
// (org.Security.Securityrunner) - two entry points make startup ambiguous.
// TODO: confirm with team which one to keep and delete the other.
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

        dotenv.entries().forEach(e -> System.setProperty(e.getKey(), e.getValue()));
        // Note: no longer printing values to console - even in dev, avoid
        // logging secrets where they could end up in shared terminal output.
    
        // Bridge our .env naming convention to the exact property name Jasypt expects
        String jasyptPassword = dotenv.get("JASYPT_ENCRYPTOR_PASSWORD");
        if (jasyptPassword != null) {
            System.setProperty("jasypt.encryptor.password", jasyptPassword);
}
        List<String> missing = REQUIRED_KEYS.stream()
            .filter(key -> System.getProperty(key) == null || System.getProperty(key).isBlank())
            .collect(Collectors.toList());

        if (!missing.isEmpty()) {
            System.err.println("=================================================");
            System.err.println("STARTUP FAILED: missing required .env values:");
            missing.forEach(k -> System.err.println("  - " + k));
            System.err.println("Check that backend/.env exists (exact name, no .txt)");
            System.err.println("and contains all required keys with real values.");
            System.err.println("=================================================");
            System.exit(1);
        }

        System.out.println("[Startup] All required environment variables present. Starting application...");
        SpringApplication.run(Main.class, args);
    }
}