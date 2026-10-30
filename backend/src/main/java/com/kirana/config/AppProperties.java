package com.kirana.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Typed {@code app.*} configuration (see application.yml for defaults and env variables). */
@ConfigurationProperties("app")
public record AppProperties(
        Jwt jwt,
        String encryptionKey,
        Admin admin,
        Cors cors,
        Otp otp,
        Media media,
        Orders orders,
        Payments payments) {

    public record Jwt(String secret, Duration accessTtl, Duration refreshTtl) {
    }

    public record Admin(String email, String password) {
    }

    public record Cors(List<String> allowedOrigins) {
    }

    public record Otp(String provider, Duration ttl, int maxAttempts, Duration resendAfter, int maxSendsPerHour,
                      List<String> testNumbers, String testCode, int maxSendsPerIpPerHour, Msg91 msg91) {

        public List<String> testNumbersOrEmpty() {
            return testNumbers == null ? List.of() : testNumbers;
        }
    }

    public record Msg91(String authKey, String templateId, String baseUrl) {
    }

    public record Media(String dir) {
    }

    public record Orders(Duration pendingPaymentExpiry) {
    }

    public record Payments(String razorpayWebhookSecret, String razorpayBaseUrl) {
    }
}
