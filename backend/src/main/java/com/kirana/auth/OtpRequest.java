package com.kirana.auth;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

/** One OTP sent to a phone. Only the HMAC of the code is stored. */
@Getter
@Setter
@Entity
@Table(name = "otp_requests")
public class OtpRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String phone;
    private String otpHash;
    private Instant expiresAt;
    private int attempts;
    private boolean consumed;
    private Instant createdAt;
}
