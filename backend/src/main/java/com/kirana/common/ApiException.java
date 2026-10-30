package com.kirana.common;

import java.util.Map;

/** Business or request error mapped to an {@link ApiError} by {@link GlobalExceptionHandler}. */
public class ApiException extends RuntimeException {

    private final ErrorCode code;
    private final transient Map<String, Object> details;

    public ApiException(ErrorCode code, String message) {
        this(code, message, Map.of());
    }

    public ApiException(ErrorCode code, String message, Map<String, Object> details) {
        super(message);
        this.code = code;
        this.details = details;
    }

    public ErrorCode getCode() {
        return code;
    }

    public Map<String, Object> getDetails() {
        return details;
    }

    public static ApiException notFound(String what) {
        return new ApiException(ErrorCode.NOT_FOUND, what + " not found");
    }

    public static ApiException validation(String field, String message) {
        return new ApiException(ErrorCode.VALIDATION_ERROR, "Validation failed", Map.of(field, message));
    }
}
