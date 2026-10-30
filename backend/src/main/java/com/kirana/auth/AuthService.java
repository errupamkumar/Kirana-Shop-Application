package com.kirana.auth;

import com.kirana.auth.AuthDtos.AdminAuthResponse;
import com.kirana.auth.AuthDtos.AdminProfile;
import com.kirana.auth.AuthDtos.CustomerAuthResponse;
import com.kirana.auth.AuthDtos.OtpSentResponse;
import com.kirana.common.ApiException;
import com.kirana.common.ErrorCode;
import com.kirana.common.Phones;
import com.kirana.customer.MeResponse;
import com.kirana.customer.User;
import com.kirana.customer.UserRepository;
import com.kirana.common.SlidingWindowLimiter;
import com.kirana.config.AppProperties;
import java.time.Clock;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    /** Admin brute-force protection: failed logins per email + client address. */
    static final int ADMIN_MAX_FAILURES = 5;
    static final Duration ADMIN_LOCKOUT_WINDOW = Duration.ofMinutes(15);

    private final OtpService otpService;
    private final TokenService tokenService;
    private final UserRepository users;
    private final AdminUserRepository admins;
    private final PasswordEncoder passwordEncoder;
    private final SlidingWindowLimiter adminFailures;
    /** Null when per-address OTP limiting is disabled (max-sends-per-ip-per-hour <= 0). */
    private final SlidingWindowLimiter otpSendsPerIp;

    public AuthService(OtpService otpService, TokenService tokenService, UserRepository users, AdminUserRepository admins,
                       PasswordEncoder passwordEncoder, AppProperties properties, Clock clock) {
        this.otpService = otpService;
        this.tokenService = tokenService;
        this.users = users;
        this.admins = admins;
        this.passwordEncoder = passwordEncoder;
        this.adminFailures = new SlidingWindowLimiter(ADMIN_MAX_FAILURES, ADMIN_LOCKOUT_WINDOW, clock);
        int perIp = properties.otp().maxSendsPerIpPerHour();
        this.otpSendsPerIp = perIp > 0 ? new SlidingWindowLimiter(perIp, Duration.ofHours(1), clock) : null;
    }

    /** Sends an OTP. Besides the per-phone rules, one client address may trigger at most N SMS per hour. */
    public OtpSentResponse sendOtp(String rawPhone, String clientAddress) {
        String phone = Phones.normalize(rawPhone);
        if (otpSendsPerIp != null && !otpSendsPerIp.tryAcquire("otp:" + clientAddress)) {
            throw new ApiException(ErrorCode.OTP_RATE_LIMITED, "Too many OTP requests from this network, try again later",
                    Map.of("retryAfterSeconds", Math.max(1, otpSendsPerIp.retryAfter("otp:" + clientAddress).toSeconds())));
        }
        OtpService.SendResult result = otpService.send(phone);
        return new OtpSentResponse(phone, result.expiresInSeconds(), result.resendAfterSeconds());
    }

    /** Verifies the OTP and logs in, creating the customer on first login. */
    public CustomerAuthResponse verifyOtp(String rawPhone, String otp) {
        String phone = Phones.normalize(rawPhone);
        otpService.verify(phone, otp);
        return loginCustomer(phone);
    }

    private CustomerAuthResponse loginCustomer(String phone) {
        Optional<User> existing = users.findByPhone(phone);
        User user = existing.orElseGet(() -> {
            User created = new User();
            created.setPhone(phone);
            return users.save(created);
        });
        AuthPrincipal principal = new AuthPrincipal(SubjectType.CUSTOMER, user.getId(), AuthPrincipal.ROLE_CUSTOMER, phone);
        return new CustomerAuthResponse(tokenService.issue(principal), MeResponse.from(user), existing.isEmpty());
    }

    /** Email + password login for staff, locked for 15 minutes after 5 failures from the same address. */
    @Transactional
    public AdminAuthResponse adminLogin(String email, String password, String clientAddress) {
        String key = email.trim().toLowerCase(Locale.ROOT) + "|" + clientAddress;
        if (adminFailures.isLimited(key)) {
            long minutes = Math.max(1, (adminFailures.retryAfter(key).toSeconds() + 59) / 60);
            throw new ApiException(ErrorCode.TOO_MANY_ATTEMPTS,
                    "Too many failed attempts. Try again in " + minutes + " minute" + (minutes == 1 ? "" : "s") + ".",
                    Map.of("retryAfterSeconds", adminFailures.retryAfter(key).toSeconds()));
        }
        Optional<AdminUser> match = admins.findByEmailIgnoreCase(email.trim())
                .filter(AdminUser::isActive)
                .filter(a -> passwordEncoder.matches(password, a.getPasswordHash()));
        if (match.isEmpty()) {
            adminFailures.record(key);
            throw new ApiException(ErrorCode.UNAUTHORIZED, "Invalid email or password");
        }
        adminFailures.reset(key);
        AdminUser admin = match.get();
        AuthPrincipal principal = new AuthPrincipal(SubjectType.ADMIN, admin.getId(), admin.getRole().name(), admin.getEmail());
        return new AdminAuthResponse(tokenService.issue(principal), AdminProfile.from(admin));
    }
}
