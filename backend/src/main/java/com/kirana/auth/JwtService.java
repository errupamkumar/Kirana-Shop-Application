package com.kirana.auth;

import com.kirana.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

/** HS256 access tokens. Subject is {@code <type>:<id>}; role and name are claims. */
@Service
public class JwtService {

    private static final String ISSUER = "kirana";

    private final SecretKey key;
    private final Duration accessTtl;
    private final Clock clock;

    public JwtService(AppProperties properties, Clock clock) {
        String secret = properties.jwt().secret();
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SECRET must be set and at least 32 bytes (openssl rand -base64 48)");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTtl = properties.jwt().accessTtl();
        this.clock = clock;
    }

    public Duration accessTtl() {
        return accessTtl;
    }

    public String issue(AuthPrincipal principal) {
        Instant now = Instant.now(clock);
        return Jwts.builder()
                .issuer(ISSUER)
                .subject(principal.type().name() + ":" + principal.id())
                .claim("role", principal.role())
                .claim("name", principal.name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(accessTtl)))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    /** Returns the principal for a valid, unexpired token. */
    public Optional<AuthPrincipal> parse(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .requireIssuer(ISSUER)
                    .clock(() -> Date.from(Instant.now(clock)))
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            String[] subject = claims.getSubject().split(":", 2);
            return Optional.of(new AuthPrincipal(SubjectType.valueOf(subject[0]), Long.valueOf(subject[1]),
                    claims.get("role", String.class), claims.get("name", String.class)));
        } catch (JwtException | IllegalArgumentException | ArrayIndexOutOfBoundsException e) {
            return Optional.empty();
        }
    }
}
