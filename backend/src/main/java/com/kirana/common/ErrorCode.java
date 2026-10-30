package com.kirana.common;

import org.springframework.http.HttpStatus;

/** Stable error codes returned to clients as {@code ApiError.code}. */
public enum ErrorCode {
    OUT_OF_RADIUS(HttpStatus.UNPROCESSABLE_ENTITY),
    BELOW_MIN_ORDER(HttpStatus.UNPROCESSABLE_ENTITY),
    STORE_CLOSED(HttpStatus.UNPROCESSABLE_ENTITY),
    PAYMENT_METHOD_DISABLED(HttpStatus.UNPROCESSABLE_ENTITY),
    VARIANT_INACTIVE(HttpStatus.UNPROCESSABLE_ENTITY),
    OUT_OF_STOCK(HttpStatus.CONFLICT),
    PRICE_CHANGED(HttpStatus.CONFLICT),
    INVALID_STATUS_TRANSITION(HttpStatus.CONFLICT),
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED),
    FORBIDDEN(HttpStatus.FORBIDDEN),
    NOT_FOUND(HttpStatus.NOT_FOUND),
    OTP_INVALID(HttpStatus.BAD_REQUEST),
    OTP_RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS),
    TOO_MANY_ATTEMPTS(HttpStatus.TOO_MANY_REQUESTS),
    PAYMENT_VERIFICATION_FAILED(HttpStatus.BAD_REQUEST),
    PAYMENT_GATEWAY_ERROR(HttpStatus.BAD_GATEWAY),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR);

    private final HttpStatus status;

    ErrorCode(HttpStatus status) {
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
