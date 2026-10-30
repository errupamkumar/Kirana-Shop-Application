package com.kirana.auth;

/** Delivers an OTP to a phone. Selected by {@code app.otp.provider}. */
public interface OtpSender {

    void send(String phoneE164, String code);
}
