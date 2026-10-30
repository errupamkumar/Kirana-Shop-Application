package com.kirana.payment;

/** Used for both orders.payment_status and payments.status. */
public enum PaymentStatus {
    PENDING,
    PAID,
    FAILED,
    REFUND_PENDING,
    COD_PENDING,
    COD_COLLECTED
}
