package org.Spring;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@org.springframework.retry.annotation.EnableRetry
public class Main {
    public static void main(String[] args) {
        SpringApplication.run(Main.class, args);
    }
}