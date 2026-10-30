package com.kirana.order;

import com.kirana.common.Money;
import com.kirana.order.OrderDtos.AddressSnapshot;
import com.kirana.order.OrderDtos.OnlinePaymentDto;
import com.kirana.order.OrderDtos.OrderDetailDto;
import com.kirana.order.OrderDtos.OrderItemDto;
import com.kirana.order.OrderDtos.OrderSummaryDto;
import com.kirana.order.OrderDtos.StatusHistoryDto;
import com.kirana.payment.PaymentMethod;
import com.kirana.payment.PaymentRepository;
import com.kirana.settings.StoreSettingsService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class OrderMapper {

    private final PaymentRepository payments;
    private final StoreSettingsService settings;

    public OrderSummaryDto summary(CustomerOrder o) {
        return new OrderSummaryDto(o.getId(), o.getOrderNumber(), o.getStatus(), o.getPaymentMethod(),
                o.getPaymentStatus(), o.getTotal(), o.itemCount(), o.getAddrName(), o.getAddrPhone(), o.getPlacedAt());
    }

    /** Detail as seen by {@code viewer}: customers get {@code canCancel}, staff get the next allowed statuses. */
    public OrderDetailDto detail(CustomerOrder o, ActorType viewer) {
        List<OrderItemDto> items = o.getItems().stream()
                .map(i -> new OrderItemDto(i.getVariantId(), i.getProductName(), i.getVariantLabel(), i.getImageUrl(),
                        i.getMrp(), i.getSellingPrice(), i.getQty(), i.getLineTotal()))
                .toList();
        List<StatusHistoryDto> history = o.getHistory().stream()
                .map(h -> new StatusHistoryDto(h.getFromStatus(), h.getToStatus(), h.getChangedByType(), h.getNote(),
                        h.getCreatedAt()))
                .toList();
        AddressSnapshot address = new AddressSnapshot(o.getAddrLabel(), o.getAddrName(), o.getAddrPhone(),
                o.getAddrLine1(), o.getAddrLine2(), o.getAddrLandmark(), o.getAddrPincode(), o.getAddrLat(), o.getAddrLng());
        boolean canCancel = viewer == ActorType.CUSTOMER
                && OrderStateMachine.canTransition(o.getStatus(), OrderStatus.CANCELLED, ActorType.CUSTOMER);
        List<OrderStatus> next = viewer == ActorType.ADMIN ? OrderStateMachine.next(o.getStatus(), ActorType.ADMIN) : List.of();
        return new OrderDetailDto(o.getId(), o.getOrderNumber(), o.getStatus(), o.getPaymentMethod(), o.getPaymentStatus(),
                o.getItemSubtotal(), o.getDeliveryFee(), o.getTotal(), o.getDistanceKm(), o.getCustomerNote(),
                o.getCancelReason(), o.getPlacedAt(), o.getDeliveredAt(), address, items, history, canCancel, next,
                onlinePayment(o));
    }

    private OnlinePaymentDto onlinePayment(CustomerOrder o) {
        if (o.getPaymentMethod() != PaymentMethod.ONLINE || o.getId() == null) {
            return null;
        }
        return payments.findFirstByOrderIdOrderByIdDesc(o.getId())
                .map(p -> new OnlinePaymentDto(p.getGateway(), p.getGatewayOrderId(), settings.rules().gatewayKeyId(),
                        Money.toPaise(p.getAmount()), "INR", p.getStatus()))
                .orElse(null);
    }
}
