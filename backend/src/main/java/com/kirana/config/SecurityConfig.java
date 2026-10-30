package com.kirana.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kirana.auth.JwtAuthFilter;
import com.kirana.auth.JwtService;
import com.kirana.common.ApiError;
import com.kirana.common.ErrorCode;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Stateless JWT security. Customers (ROLE_CUSTOMER) use /api/v1/app/**; staff use /api/v1/admin/**
 * (ADMIN or STAFF; settings are ADMIN only). Errors are JSON {@link ApiError} bodies.
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, JwtService jwtService, ObjectMapper objectMapper)
            throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> {
                })
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(new JwtAuthFilter(jwtService), UsernamePasswordAuthenticationFilter.class)
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) -> write(res, objectMapper, ErrorCode.UNAUTHORIZED,
                                "Authentication required"))
                        .accessDeniedHandler((req, res, ex) -> write(res, objectMapper, ErrorCode.FORBIDDEN,
                                "You do not have access to this resource")))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/actuator/health/**", "/actuator/info", "/swagger-ui/**", "/swagger-ui.html",
                                "/v3/api-docs/**", "/media/**", "/error").permitAll()
                        // Auth
                        .requestMatchers(HttpMethod.POST, "/api/v1/app/auth/otp/send", "/api/v1/app/auth/otp/verify",
                                "/api/v1/admin/auth/login", "/api/v1/auth/refresh", "/api/v1/auth/logout").permitAll()
                        // Public customer endpoints
                        .requestMatchers(HttpMethod.GET, "/api/v1/app/config", "/api/v1/app/catalog",
                                "/api/v1/app/products", "/api/v1/app/products/*").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/app/location/check").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/webhooks/**").permitAll()
                        // Staff
                        .requestMatchers("/api/v1/admin/settings/**", "/api/v1/admin/settings").hasRole("ADMIN")
                        .requestMatchers("/api/v1/admin/**").hasAnyRole("ADMIN", "STAFF")
                        // Customers
                        .requestMatchers("/api/v1/app/**").hasRole("CUSTOMER")
                        .anyRequest().denyAll())
                .build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(AppProperties properties) {
        CorsConfiguration config = new CorsConfiguration();
        List<String> origins = properties.cors().allowedOrigins();
        // Patterns accept exact origins (https://admin.example.com) and dev wildcards (http://localhost:*)
        config.setAllowedOriginPatterns(origins == null ? List.of() : origins.stream().map(String::trim).toList());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Idempotency-Key"));
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        source.registerCorsConfiguration("/media/**", config);
        return source;
    }

    private static void write(HttpServletResponse res, ObjectMapper mapper, ErrorCode code, String message)
            throws IOException {
        res.setStatus(code.status().value());
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        mapper.writeValue(res.getOutputStream(), ApiError.of(code, message));
    }
}
