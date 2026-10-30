package com.kirana;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

// Authentication is JWT based (Phase 2); no in-memory default user.
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class KiranaApplication {

    public static void main(String[] args) {
        SpringApplication.run(KiranaApplication.class, args);
    }
}
