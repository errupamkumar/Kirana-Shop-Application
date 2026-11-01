package com.kirana.order;

public enum OrderStatus {
    PENDING_PAYMENT,
    PLACED,
    /** The store has seen the order and will fulfil it (every order is accepted before packing). */
    ACCEPTED,
    PACKED,
    OUT_FOR_DELIVERY,
    DELIVERED,
    CANCELLED;

    public boolean isTerminal() {
        return this == DELIVERED || this == CANCELLED;
    }
}
