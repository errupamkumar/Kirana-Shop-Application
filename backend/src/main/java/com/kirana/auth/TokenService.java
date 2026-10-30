package com.kirana.auth;

import com.kirana.auth.AuthDtos.TokenPair;
import com.kirana.common.ApiException;
import com.kirana.common.ErrorCode;
import com.kirana.common.Hashing;
import com.kirana.config.AppProperties;
import com.kirana.customer.UserRepository;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Issues access + refresh tokens and rotates refresh tokens. Reusing a rotated token revokes the whole family. */
@Slf4j
@Service
@RequiredArgsConstructor
public class TokenService {

    private final JwtService jwt;
    private final RefreshTokenRepository refreshTokens;
    private final UserRepository users;
    private final AdminUserRepository admins;
    private final AppProperties properties;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    @Transactional
    public TokenPair issue(AuthPrincipal principal) {
        byte[] raw = new byte[32];
        random.nextBytes(raw);
        String refresh = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        Instant now = Instant.now(clock);

        RefreshToken token = new RefreshToken();
        token.setTokenHash(Hashing.sha256Hex(refresh));
        token.setSubjectType(principal.type());
        token.setSubjectId(principal.id());
        token.setCreatedAt(now);
        token.setExpiresAt(now.plus(properties.jwt().refreshTtl()));
        refreshTokens.save(token);

        return new TokenPair(jwt.issue(principal), refresh, jwt.accessTtl().toSeconds(), "Bearer");
    }

    @Transactional(noRollbackFor = ApiException.class)
    public TokenPair refresh(String refreshToken) {
        RefreshToken token = refreshTokens.findByTokenHash(Hashing.sha256Hex(refreshToken))
                .orElseThrow(TokenService::invalid);
        if (token.isRevoked()) {
            log.warn("Reuse of a revoked refresh token for {} {}; revoking all sessions", token.getSubjectType(),
                    token.getSubjectId());
            refreshTokens.revokeAllFor(token.getSubjectType(), token.getSubjectId());
            throw invalid();
        }
        if (!Instant.now(clock).isBefore(token.getExpiresAt())) {
            token.setRevoked(true);
            throw invalid();
        }
        token.setRevoked(true);
        return issue(principalFor(token));
    }

    @Transactional
    public void revoke(String refreshToken) {
        refreshTokens.findByTokenHash(Hashing.sha256Hex(refreshToken)).ifPresent(t -> t.setRevoked(true));
    }

    private AuthPrincipal principalFor(RefreshToken token) {
        if (token.getSubjectType() == SubjectType.CUSTOMER) {
            return users.findById(token.getSubjectId())
                    .map(u -> new AuthPrincipal(SubjectType.CUSTOMER, u.getId(), AuthPrincipal.ROLE_CUSTOMER, u.getPhone()))
                    .orElseThrow(TokenService::invalid);
        }
        return admins.findById(token.getSubjectId())
                .filter(AdminUser::isActive)
                .map(a -> new AuthPrincipal(SubjectType.ADMIN, a.getId(), a.getRole().name(), a.getEmail()))
                .orElseThrow(TokenService::invalid);
    }

    private static ApiException invalid() {
        return new ApiException(ErrorCode.UNAUTHORIZED, "Session expired, please log in again");
    }
}
