package org.Spring;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

// PLEASE review — single source of truth for bootstrapping. A SECOND
// @SpringBootApplication exists (org.Security.Securityrunner); two entry points make
// startup ambiguous. Keep only one — see the note there.
// EXAMPLE: keep this Main as the only @SpringBootApplication and delete Securityrunner.
@SpringBootApplication
@org.springframework.retry.annotation.EnableRetry
public class Main {
    public static void main(String[] args) {
        SpringApplication.run(Main.class, args);
    }
}