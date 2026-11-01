package com.kirana.order;

import static com.kirana.order.OrderStatus.CANCELLED;
import static com.kirana.order.OrderStatus.DELIVERED;
import static com.kirana.order.OrderStatus.ACCEPTED;
import static com.kirana.order.OrderStatus.OUT_FOR_DELIVERY;
import static com.kirana.order.OrderStatus.PACKED;
import static com.kirana.order.OrderStatus.PENDING_PAYMENT;
import static com.kirana.order.OrderStatus.PLACED;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class OrderStateMachineTest {

    @Test
    void adminHappyPath() {
        assertThat(OrderStateMachine.canTransition(PLACED, ACCEPTED, ActorType.ADMIN)).isTrue();
        assertThat(OrderStateMachine.canTransition(ACCEPTED, PACKED, ActorType.ADMIN)).isTrue();
        assertThat(OrderStateMachine.canTransition(PACKED, OUT_FOR_DELIVERY, ActorType.ADMIN)).isTrue();
        assertThat(OrderStateMachine.canTransition(OUT_FOR_DELIVERY, DELIVERED, ActorType.ADMIN)).isTrue();
    }

    @Test
    void noSkippingSteps() {
        assertThat(OrderStateMachine.canTransition(PLACED, PACKED, ActorType.ADMIN)).isFalse();
        assertThat(OrderStateMachine.canTransition(PLACED, OUT_FOR_DELIVERY, ActorType.ADMIN)).isFalse();
        assertThat(OrderStateMachine.canTransition(ACCEPTED, PLACED, ActorType.ADMIN)).isFalse();
        assertThat(OrderStateMachine.canTransition(PLACED, DELIVERED, ActorType.ADMIN)).isFalse();
        assertThat(OrderStateMachine.canTransition(PACKED, PLACED, ActorType.ADMIN)).isFalse();
    }

    @Test
    void terminalStatesHaveNoExits() {
        for (OrderStatus to : OrderStatus.values()) {
            for (ActorType actor : ActorType.values()) {
                assertThat(OrderStateMachine.canTransition(DELIVERED, to, actor)).isFalse();
                assertThat(OrderStateMachine.canTransition(CANCELLED, to, actor)).isFalse();
            }
        }
    }

    @Test
    void customerMayOnlyCancelWhilePlaced() {
        assertThat(OrderStateMachine.canTransition(PLACED, CANCELLED, ActorType.CUSTOMER)).isTrue();
        assertThat(OrderStateMachine.canTransition(ACCEPTED, CANCELLED, ActorType.CUSTOMER)).isTrue();
        assertThat(OrderStateMachine.canTransition(PLACED, ACCEPTED, ActorType.CUSTOMER)).isFalse();
        assertThat(OrderStateMachine.canTransition(PACKED, CANCELLED, ActorType.CUSTOMER)).isFalse();
        assertThat(OrderStateMachine.canTransition(PENDING_PAYMENT, CANCELLED, ActorType.CUSTOMER)).isFalse();
        assertThat(OrderStateMachine.canTransition(PLACED, PACKED, ActorType.CUSTOMER)).isFalse();
    }

    @Test
    void onlySystemConfirmsPayment() {
        assertThat(OrderStateMachine.canTransition(PENDING_PAYMENT, PLACED, ActorType.SYSTEM)).isTrue();
        assertThat(OrderStateMachine.canTransition(PENDING_PAYMENT, PLACED, ActorType.ADMIN)).isFalse();
        assertThat(OrderStateMachine.canTransition(PENDING_PAYMENT, CANCELLED, ActorType.SYSTEM)).isTrue();
    }

    @Test
    void adminNextStatusesAreInWorkflowOrder() {
        assertThat(OrderStateMachine.next(PLACED, ActorType.ADMIN)).containsExactly(ACCEPTED, CANCELLED);
        assertThat(OrderStateMachine.next(ACCEPTED, ActorType.ADMIN)).containsExactly(PACKED, CANCELLED);
        assertThat(OrderStateMachine.next(OUT_FOR_DELIVERY, ActorType.ADMIN)).containsExactly(DELIVERED, CANCELLED);
        assertThat(OrderStateMachine.next(DELIVERED, ActorType.ADMIN)).isEmpty();
    }
}
