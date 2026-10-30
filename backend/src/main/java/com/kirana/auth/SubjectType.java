package com.kirana.auth;

/** Who a token belongs to: a customer (users table) or a staff member (admin_users table). */
public enum SubjectType {
    CUSTOMER,
    ADMIN
}
