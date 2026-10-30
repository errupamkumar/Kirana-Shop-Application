package com.kirana.auth;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Development sender: writes the code to the log instead of sending an SMS. */
@Slf4j
@Component
@ConditionalOnProperty(name = "app.otp.provider", havingValue = "logging", matchIfMissing = true)
public class LoggingOtpSender implements OtpSender {

    public LoggingOtpSender() {
        log.warn("OTP provider is 'logging': codes are written to the log. Use OTP_PROVIDER=msg91 in production.");
    }

    @Override
    public void send(String phoneE164, String code) {
        log.info("[DEV OTP] code for {} is {}", phoneE164, code);
    }
}
