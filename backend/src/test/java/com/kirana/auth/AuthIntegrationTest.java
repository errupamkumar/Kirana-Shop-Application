package com.kirana.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.kirana.IntegrationTest;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AuthIntegrationTest extends IntegrationTest {

    private static final String SEND = "/api/v1/app/auth/otp/send";
    private static final String VERIFY = "/api/v1/app/auth/otp/verify";

    @Test
    void otpLoginCreatesUserOnFirstLoginOnly() throws Exception {
        String phone = newPhone();
        postJson(SEND, null, Map.of("phone", phone)).andExpect(status().isOk())
                .andExpect(jsonPath("$.phone").value("+91" + phone))
                .andExpect(jsonPath("$.expiresInSeconds").value(300));
        String code = otpSender.lastCode("+91" + phone);
        assertThat(code).matches("\\d{6}");

        JsonNode first = body(postJson(VERIFY, null, Map.of("phone", phone, "otp", code)).andExpect(status().isOk()));
        assertThat(first.get("newUser").asBoolean()).isTrue();
        assertThat(first.get("accessToken").asText()).isNotBlank();
        assertThat(first.get("tokenType").asText()).isEqualTo("Bearer");

        // A used code cannot be replayed
        postJson(VERIFY, null, Map.of("phone", phone, "otp", code)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("OTP_INVALID"));

        clock.advance(Duration.ofSeconds(31));
        postJson(SEND, null, Map.of("phone", phone)).andExpect(status().isOk());
        JsonNode second = body(postJson(VERIFY, null, Map.of("phone", phone, "otp", otpSender.lastCode("+91" + phone)))
                .andExpect(status().isOk()));
        assertThat(second.get("newUser").asBoolean()).isFalse();
        assertThat(second.at("/user/id").asLong()).isEqualTo(first.at("/user/id").asLong());
    }

    @Test
    void wrongOtpIsRejectedWithAttemptsLeft() throws Exception {
        String phone = newPhone();
        postJson(SEND, null, Map.of("phone", phone)).andExpect(status().isOk());
        String wrong = otpSender.lastCode("+91" + phone).equals("000000") ? "111111" : "000000";
        postJson(VERIFY, null, Map.of("phone", phone, "otp", wrong)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("OTP_INVALID"))
                .andExpect(jsonPath("$.details.attemptsLeft").value(4));
    }

    @Test
    void expiredOtpIsRejected() throws Exception {
        String phone = newPhone();
        postJson(SEND, null, Map.of("phone", phone)).andExpect(status().isOk());
        String code = otpSender.lastCode("+91" + phone);
        clock.advance(Duration.ofMinutes(5).plusSeconds(1));
        postJson(VERIFY, null, Map.of("phone", phone, "otp", code)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("OTP_INVALID"))
                .andExpect(jsonPath("$.message").value("OTP has expired, please request a new one"));
    }

    @Test
    void attemptLimitLocksTheCode() throws Exception {
        String phone = newPhone();
        postJson(SEND, null, Map.of("phone", phone)).andExpect(status().isOk());
        String code = otpSender.lastCode("+91" + phone);
        String wrong = code.equals("000000") ? "111111" : "000000";
        for (int i = 0; i < 5; i++) {
            postJson(VERIFY, null, Map.of("phone", phone, "otp", wrong)).andExpect(status().isBadRequest());
        }
        // Even the right code is refused after 5 wrong attempts
        postJson(VERIFY, null, Map.of("phone", phone, "otp", code)).andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("OTP_RATE_LIMITED"));
    }

    @Test
    void resendIsRateLimited() throws Exception {
        String phone = newPhone();
        postJson(SEND, null, Map.of("phone", phone)).andExpect(status().isOk());
        postJson(SEND, null, Map.of("phone", phone)).andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("OTP_RATE_LIMITED"))
                .andExpect(jsonPath("$.details.retryAfterSeconds").isNumber());

        // At most 5 sends per hour
        for (int i = 0; i < 4; i++) {
            clock.advance(Duration.ofSeconds(31));
            postJson(SEND, null, Map.of("phone", phone)).andExpect(status().isOk());
        }
        clock.advance(Duration.ofSeconds(31));
        postJson(SEND, null, Map.of("phone", phone)).andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("Too many OTP requests, try again later"));
    }

    @Test
    void invalidPhoneIsRejected() throws Exception {
        postJson(SEND, null, Map.of("phone", "12345")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.details.phone").exists());
    }

    @Test
    void testNumberAcceptsTestCodeWithoutSms() throws Exception {
        postJson(SEND, null, Map.of("phone", "9999999999")).andExpect(status().isOk());
        assertThat(otpSender.lastCode("+919999999999")).isNull();
        postJson(VERIFY, null, Map.of("phone", "9999999999", "otp", "123456")).andExpect(status().isOk());
    }

    @Test
    void roleBasedAccess() throws Exception {
        Customer customer = newCustomer();
        get("/api/v1/app/orders/my", null).andExpect(status().isUnauthorized());
        get("/api/v1/app/orders/my", customer.token()).andExpect(status().isOk());
        get("/api/v1/admin/orders", customer.token()).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        get("/api/v1/admin/orders", null).andExpect(status().isUnauthorized());
        get("/api/v1/admin/orders", adminToken()).andExpect(status().isOk());
        // Staff tokens are not customer tokens
        get("/api/v1/app/orders/my", adminToken()).andExpect(status().isForbidden());
        get("/api/v1/app/orders/my", "not-a-jwt").andExpect(status().isUnauthorized());
    }

    @Test
    void expiredAccessTokenIsRejected() throws Exception {
        Customer customer = newCustomer();
        clock.advance(Duration.ofMinutes(16));
        get("/api/v1/app/me", customer.token()).andExpect(status().isUnauthorized());
    }

    @Test
    void refreshRotatesAndReuseRevokesTheFamily() throws Exception {
        Customer customer = newCustomer();
        JsonNode rotated = body(postJson("/api/v1/auth/refresh", null, Map.of("refreshToken", customer.refreshToken()))
                .andExpect(status().isOk()));
        String newRefresh = rotated.get("refreshToken").asText();
        assertThat(newRefresh).isNotEqualTo(customer.refreshToken());
        get("/api/v1/app/me", rotated.get("accessToken").asText()).andExpect(status().isOk())
                .andExpect(jsonPath("$.phone").value(customer.phone()));

        // Reusing the old token is treated as theft: it fails and the new one is revoked too
        postJson("/api/v1/auth/refresh", null, Map.of("refreshToken", customer.refreshToken()))
                .andExpect(status().isUnauthorized());
        postJson("/api/v1/auth/refresh", null, Map.of("refreshToken", newRefresh)).andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesRefreshToken() throws Exception {
        Customer customer = newCustomer();
        postJson("/api/v1/auth/logout", null, Map.of("refreshToken", customer.refreshToken()))
                .andExpect(status().isNoContent());
        postJson("/api/v1/auth/refresh", null, Map.of("refreshToken", customer.refreshToken()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void adminLogin() throws Exception {
        postJson("/api/v1/admin/auth/login", null, Map.of("email", ADMIN_EMAIL, "password", "wrong-password"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        postJson("/api/v1/admin/auth/login", null, Map.of("email", ADMIN_EMAIL.toUpperCase(), "password", ADMIN_PASSWORD))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.admin.role").value("ADMIN"))
                .andExpect(jsonPath("$.refreshToken").isString());
    }

    @Test
    void adminLoginLocksAfterFiveFailures() throws Exception {
        // A separate staff account so the shared test admin is never locked
        String email = "lockout-" + uniqueSuffix() + "@test.local";
        AdminUser staff = new AdminUser();
        staff.setEmail(email);
        staff.setName("Lockout test");
        staff.setRole(AdminRole.STAFF);
        staff.setPasswordHash(passwordEncoder.encode("right-password-1"));
        adminUsers.save(staff);

        for (int i = 0; i < 5; i++) {
            postJson("/api/v1/admin/auth/login", null, Map.of("email", email, "password", "wrong-password"))
                    .andExpect(status().isUnauthorized());
        }
        // Even the right password is refused while locked
        postJson("/api/v1/admin/auth/login", null, Map.of("email", email.toUpperCase(), "password", "right-password-1"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_ATTEMPTS"))
                .andExpect(jsonPath("$.details.retryAfterSeconds").isNumber());

        clock.advance(Duration.ofMinutes(15).plusSeconds(1));
        postJson("/api/v1/admin/auth/login", null, Map.of("email", email, "password", "right-password-1"))
                .andExpect(status().isOk());
    }

    @Test
    void profileUpdate() throws Exception {
        Customer customer = newCustomer();
        call(org.springframework.http.HttpMethod.PUT, "/api/v1/app/me", customer.token(), Map.of("name", "Asha"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Asha"));
        get("/api/v1/app/me", customer.token()).andExpect(jsonPath("$.name").value("Asha"));
    }
}
