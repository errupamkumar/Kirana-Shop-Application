package com.kirana.order;

public enum OrderStatus {
    PENDING_PAYMENT,
    PLACED,
    PACKED,
    OUT_FOR_DELIVERY,
    DELIVERED,
    CANCELLED;

    public boolean isTerminal() {
        return this == DELIVERED || this == CANCELLED;
    }
}
