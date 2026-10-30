package com.kirana.common;

import java.util.Map;

/** Error body for every non-2xx response. */
public record ApiError(ErrorCode code, String message, Map<String, Object> details) {

    public static ApiError of(ErrorCode code, String message) {
        return new ApiError(code, message, Map.of());
    }
}
