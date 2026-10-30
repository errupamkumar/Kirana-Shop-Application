package com.kirana.auth;

import com.kirana.common.ApiException;
import com.kirana.common.ErrorCode;
import com.kirana.common.Hashing;
import com.kirana.config.AppProperties;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * OTP rules: 6 digits, stored as HMAC, valid 5 minutes, 5 wrong attempts per code, one resend per 30 s and
 * at most 5 sends per hour per phone. Configured numbers always accept the test code (dev only).
 */
@Service
@RequiredArgsConstructor
public class OtpService {

    private final OtpRequestRepository repository;
    private final OtpSender sender;
    private final AppProperties properties;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public record SendResult(long expiresInSeconds, long resendAfterSeconds) {
    }

    @Transactional
    public SendResult send(String phone) {
        AppProperties.Otp otp = properties.otp();
        Instant now = Instant.now(clock);
        if (isTestNumber(phone)) {
            return new SendResult(otp.ttl().toSeconds(), otp.resendAfter().toSeconds());
        }

        Optional<OtpRequest> last = repository.findFirstByPhoneOrderByCreatedAtDescIdDesc(phone);
        if (last.isPresent()) {
            Instant resendAt = last.get().getCreatedAt().plus(otp.resendAfter());
            if (now.isBefore(resendAt)) {
                long wait = Math.max(1, Duration.between(now, resendAt).toSeconds());
                throw new ApiException(ErrorCode.OTP_RATE_LIMITED, "Please wait before requesting another OTP",
                        Map.of("retryAfterSeconds", wait));
            }
        }
        if (repository.countByPhoneAndCreatedAtAfter(phone, now.minus(Duration.ofHours(1))) >= otp.maxSendsPerHour()) {
            throw new ApiException(ErrorCode.OTP_RATE_LIMITED, "Too many OTP requests, try again later",
                    Map.of("retryAfterSeconds", 3600));
        }

        repository.consumeAllForPhone(phone);
        String code = String.format("%06d", random.nextInt(1_000_000));
        OtpRequest request = new OtpRequest();
        request.setPhone(phone);
        request.setOtpHash(hash(phone, code));
        request.setExpiresAt(now.plus(otp.ttl()));
        request.setCreatedAt(now);
        repository.save(request);
        sender.send(phone, code);
        return new SendResult(otp.ttl().toSeconds(), otp.resendAfter().toSeconds());
    }

    /** Throws OTP_INVALID / OTP_RATE_LIMITED unless the code is correct. Wrong attempts are counted even on failure. */
    @Transactional(noRollbackFor = ApiException.class)
    public void verify(String phone, String code) {
        AppProperties.Otp otp = properties.otp();
        if (isTestNumber(phone) && otp.testCode().equals(code)) {
            return;
        }
        OtpRequest request = repository.findFirstByPhoneAndConsumedFalseOrderByCreatedAtDescIdDesc(phone)
                .orElseThrow(() -> new ApiException(ErrorCode.OTP_INVALID, "No active OTP, please request a new one"));
        if (!Instant.now(clock).isBefore(request.getExpiresAt())) {
            request.setConsumed(true);
            throw new ApiException(ErrorCode.OTP_INVALID, "OTP has expired, please request a new one");
        }
        if (request.getAttempts() >= otp.maxAttempts()) {
            request.setConsumed(true);
            throw new ApiException(ErrorCode.OTP_RATE_LIMITED, "Too many wrong attempts, please request a new OTP");
        }
        if (!Hashing.constantTimeEquals(request.getOtpHash(), hash(phone, code))) {
            request.setAttempts(request.getAttempts() + 1);
            int left = otp.maxAttempts() - request.getAttempts();
            throw new ApiException(ErrorCode.OTP_INVALID, "Incorrect OTP", Map.of("attemptsLeft", left));
        }
        request.setConsumed(true);
    }

    private boolean isTestNumber(String phone) {
        return properties.otp().testNumbersOrEmpty().contains(phone);
    }

    private String hash(String phone, String code) {
        return Hashing.hmacSha256Hex(properties.jwt().secret(), phone + ":" + code);
    }
}
