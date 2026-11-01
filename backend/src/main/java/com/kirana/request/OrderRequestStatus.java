package com.kirana.request;

/**
 * A customer's order request (photo of a handwritten list and/or a voice note).
 * <pre>
 * PENDING  -> ACCEPTED  (admin builds the order from it; the order starts as ACCEPTED)
 * PENDING  -> REJECTED  (admin, with a reason the customer sees)
 * PENDING  -> CANCELLED (customer, before the store has handled it)
 * </pre>
 */
public enum OrderRequestStatus {
    PENDING,
    ACCEPTED,
    REJECTED,
    CANCELLED
}
