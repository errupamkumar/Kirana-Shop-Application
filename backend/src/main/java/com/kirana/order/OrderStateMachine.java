package com.kirana.order;

import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Allowed status transitions per actor.
 * <pre>
 * PENDING_PAYMENT  -> PLACED | CANCELLED   (system: payment verified / failed or expired; admin may cancel)
 * PLACED           -> PACKED | CANCELLED   (customer may only cancel here)
 * PACKED           -> OUT_FOR_DELIVERY | CANCELLED (admin)
 * OUT_FOR_DELIVERY -> DELIVERED | CANCELLED (admin, e.g. customer refused delivery)
 * DELIVERED, CANCELLED: terminal
 * </pre>
 */
public final class OrderStateMachine {

    private static final Map<OrderStatus, Set<OrderStatus>> ADMIN = Map.of(
            OrderStatus.PENDING_PAYMENT, EnumSet.of(OrderStatus.CANCELLED),
            OrderStatus.PLACED, EnumSet.of(OrderStatus.PACKED, OrderStatus.CANCELLED),
            OrderStatus.PACKED, EnumSet.of(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED),
            OrderStatus.OUT_FOR_DELIVERY, EnumSet.of(OrderStatus.DELIVERED, OrderStatus.CANCELLED));

    private static final Map<OrderStatus, Set<OrderStatus>> CUSTOMER = Map.of(
            OrderStatus.PLACED, EnumSet.of(OrderStatus.CANCELLED));

    private static final Map<OrderStatus, Set<OrderStatus>> SYSTEM = Map.of(
            OrderStatus.PENDING_PAYMENT, EnumSet.of(OrderStatus.PLACED, OrderStatus.CANCELLED));

    private OrderStateMachine() {
    }

    public static boolean canTransition(OrderStatus from, OrderStatus to, ActorType actor) {
        return rules(actor).getOrDefault(from, Set.of()).contains(to);
    }

    /** Next statuses offered to an actor, in workflow order. */
    public static List<OrderStatus> next(OrderStatus from, ActorType actor) {
        Set<OrderStatus> allowed = rules(actor).getOrDefault(from, Set.of());
        return EnumSet.allOf(OrderStatus.class).stream().filter(allowed::contains).toList();
    }

    private static Map<OrderStatus, Set<OrderStatus>> rules(ActorType actor) {
        return switch (actor) {
            case ADMIN -> ADMIN;
            case CUSTOMER -> CUSTOMER;
            case SYSTEM -> SYSTEM;
        };
    }
}
