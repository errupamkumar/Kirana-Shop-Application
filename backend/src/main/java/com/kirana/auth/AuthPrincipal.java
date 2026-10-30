package com.kirana.auth;

import java.security.Principal;
import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/**
 * The authenticated caller, built from the access token.
 *
 * @param role CUSTOMER, ADMIN or STAFF
 * @param name phone for customers, email for staff
 */
public record AuthPrincipal(SubjectType type, Long id, String role, String name) implements Principal {

    public static final String ROLE_CUSTOMER = "CUSTOMER";

    @Override
    public String getName() {
        return name;
    }

    public List<GrantedAuthority> authorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role));
    }

    public boolean isCustomer() {
        return type == SubjectType.CUSTOMER;
    }
}
