package com.kirana.order;

import com.kirana.checkout.CheckoutDtos.CartItem;
import com.kirana.payment.PaymentMethod;
import com.kirana.payment.PaymentStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class OrderDtos {

    private OrderDtos() {
    }

    /** The client sends only variant ids and quantities; the server prices everything. */
    public record PlaceOrderRequest(
            @NotEmpty @Size(max = 50) List<@Valid CartItem> items,
            @NotNull Long addressId,
            @NotNull PaymentMethod paymentMethod,
            @NotNull @DecimalMin("0") BigDecimal expectedTotal,
            @Size(max = 300) String note) {
    }

    public record CancelRequest(@Size(max = 300) String reason) {
    }

    public record StatusUpdateRequest(@NotNull OrderStatus status, @Size(max = 300) String note) {
    }

    public record OrderItemDto(Long variantId, String productName, String variantLabel, String imageUrl,
                               BigDecimal mrp, BigDecimal sellingPrice, int qty, BigDecimal lineTotal) {
    }

    public record StatusHistoryDto(OrderStatus fromStatus, OrderStatus toStatus, ActorType changedByType, String note,
                                   Instant createdAt) {
    }

    public record AddressSnapshot(String label, String name, String phone, String line1, String line2, String landmark,
                                  String pincode, BigDecimal lat, BigDecimal lng) {
    }

    /** Present for ONLINE orders: what the app needs to open (or reopen) Razorpay checkout. */
    public record OnlinePaymentDto(String gateway, String gatewayOrderId, String keyId, long amountPaise,
                                   String currency, PaymentStatus status) {
    }

    public record OrderSummaryDto(Long id, String orderNumber, OrderStatus status, PaymentMethod paymentMethod,
                                  PaymentStatus paymentStatus, BigDecimal total, int itemCount, String customerName,
                                  String customerPhone, Instant placedAt) {
    }

    public record OrderDetailDto(
            Long id,
            String orderNumber,
            OrderStatus status,
            PaymentMethod paymentMethod,
            PaymentStatus paymentStatus,
            BigDecimal itemSubtotal,
            BigDecimal deliveryFee,
            BigDecimal total,
            BigDecimal distanceKm,
            String customerNote,
            String cancelReason,
            Instant placedAt,
            Instant deliveredAt,
            AddressSnapshot address,
            List<OrderItemDto> items,
            List<StatusHistoryDto> history,
            boolean canCancel,
            List<OrderStatus> allowedNextStatuses,
            OnlinePaymentDto payment) {
    }

    public record StoreInfo(String name, String address, String phone, String gstin) {
    }

    public record InvoiceDto(StoreInfo store, OrderDetailDto order, Instant generatedAt) {
    }
}
