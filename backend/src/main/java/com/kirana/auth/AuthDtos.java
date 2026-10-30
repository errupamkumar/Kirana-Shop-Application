package com.kirana.auth;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.kirana.customer.MeResponse;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record SendOtpRequest(@NotBlank @Size(max = 16) String phone) {
    }

    public record VerifyOtpRequest(@NotBlank @Size(max = 16) String phone,
                                   @NotBlank @Pattern(regexp = "\\d{6}", message = "must be 6 digits") String otp) {
    }

    public record AdminLoginRequest(@NotBlank @Email @Size(max = 190) String email,
                                    @NotBlank @Size(max = 200) String password) {
        @Override
        public String toString() {
            return "AdminLoginRequest[email=" + email + ", password=***]";
        }
    }

    public record RefreshRequest(@NotBlank @Size(max = 200) String refreshToken) {
    }

    public record TokenPair(String accessToken, String refreshToken, long expiresIn, String tokenType) {
    }

    public record AdminProfile(Long id, String email, String name, AdminRole role) {
        static AdminProfile from(AdminUser a) {
            return new AdminProfile(a.getId(), a.getEmail(), a.getName(), a.getRole());
        }
    }

    public record CustomerAuthResponse(@JsonUnwrapped TokenPair tokens, MeResponse user, boolean newUser) {
    }

    public record AdminAuthResponse(@JsonUnwrapped TokenPair tokens, AdminProfile admin) {
    }

    public record OtpSentResponse(String phone, long expiresInSeconds, long resendAfterSeconds) {
    }
}
