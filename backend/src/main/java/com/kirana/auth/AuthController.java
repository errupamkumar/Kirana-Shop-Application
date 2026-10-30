package com.kirana.auth;

import com.kirana.auth.AuthDtos.AdminAuthResponse;
import com.kirana.auth.AuthDtos.AdminLoginRequest;
import com.kirana.auth.AuthDtos.CustomerAuthResponse;
import com.kirana.auth.AuthDtos.OtpSentResponse;
import com.kirana.auth.AuthDtos.RefreshRequest;
import com.kirana.auth.AuthDtos.SendOtpRequest;
import com.kirana.auth.AuthDtos.TokenPair;
import com.kirana.auth.AuthDtos.VerifyOtpRequest;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Auth")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final TokenService tokenService;

    @PostMapping("/app/auth/otp/send")
    public OtpSentResponse sendOtp(@Valid @RequestBody SendOtpRequest request, HttpServletRequest http) {
        return authService.sendOtp(request.phone(), http.getRemoteAddr());
    }

    @PostMapping("/app/auth/otp/verify")
    public CustomerAuthResponse verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
        return authService.verifyOtp(request.phone(), request.otp());
    }

    @PostMapping("/admin/auth/login")
    public AdminAuthResponse adminLogin(@Valid @RequestBody AdminLoginRequest request, HttpServletRequest http) {
        // Behind a proxy, server.forward-headers-strategy (prod profile) makes this the real client address
        return authService.adminLogin(request.email(), request.password(), http.getRemoteAddr());
    }

    @PostMapping("/auth/refresh")
    public TokenPair refresh(@Valid @RequestBody RefreshRequest request) {
        return tokenService.refresh(request.refreshToken());
    }

    @PostMapping("/auth/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@Valid @RequestBody RefreshRequest request) {
        tokenService.revoke(request.refreshToken());
    }
}
