package com.kirana.auth;

import com.kirana.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Creates the first ADMIN from ADMIN_EMAIL / ADMIN_PASSWORD when no admin user exists. */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminBootstrap implements ApplicationRunner {

    private final AdminUserRepository admins;
    private final PasswordEncoder passwordEncoder;
    private final AppProperties properties;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (admins.count() > 0) {
            return;
        }
        String email = properties.admin().email();
        String password = properties.admin().password();
        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            log.warn("No admin user exists and ADMIN_EMAIL / ADMIN_PASSWORD are not set; admin login is unavailable");
            return;
        }
        if (password.length() < 8) {
            log.warn("ADMIN_PASSWORD must be at least 8 characters; first admin not created");
            return;
        }
        AdminUser admin = new AdminUser();
        admin.setEmail(email.trim().toLowerCase());
        admin.setName("Store Admin");
        admin.setRole(AdminRole.ADMIN);
        admin.setPasswordHash(passwordEncoder.encode(password));
        admins.save(admin);
        log.info("Created first admin user {}", admin.getEmail());
    }
}
