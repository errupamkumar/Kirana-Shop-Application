package com.kirana.request;

import com.kirana.order.OrderDtos.AddressSnapshot;
import com.kirana.order.OrderStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Order request requests and responses. Media URLs are signed links that expire after a few hours. */
public final class OrderRequestDtos {

    private OrderRequestDtos() {
    }

    /** What the customer sees: their request and, once accepted, the order it became. */
    public record RequestDto(
            Long id,
            OrderRequestStatus status,
            String imageUrl,
            String audioUrl,
            Integer audioSeconds,
            String note,
            AddressSnapshot address,
            Long orderId,
            String orderNumber,
            OrderStatus orderStatus,
            BigDecimal orderTotal,
            String rejectReason,
            Instant createdAt,
            Instant handledAt) {
    }

    /** What the store sees: the same plus the customer and the distance. */
    public record AdminRequestDto(
            Long id,
            OrderRequestStatus status,
            String imageUrl,
            String audioUrl,
            Integer audioSeconds,
            String note,
            String customerName,
            String customerPhone,
            AddressSnapshot address,
            BigDecimal distanceKm,
            Long orderId,
            String orderNumber,
            OrderStatus orderStatus,
            BigDecimal orderTotal,
            String rejectReason,
            Instant createdAt,
            Instant handledAt) {
    }

    /** A catalog item at today's price (stock is taken from inventory). */
    public record CatalogLine(@NotNull Long variantId, @NotNull @Min(1) @Max(50) Integer qty) {
    }

    /** Something not in the catalog, priced by the store (no stock tracking), e.g. "Lux soap" ₹35 x 2. */
    public record CustomLine(
            @NotBlank @Size(max = 160) String name,
            @Size(max = 40) String label,
            @NotNull @DecimalMin("0.01") @Digits(integer = 8, fraction = 2) BigDecimal price,
            @NotNull @Min(1) @Max(99) Integer qty) {
    }

    /** The store accepts a request by listing what it will deliver. */
    public record AcceptRequest(
            @Size(max = 60) List<@Valid CatalogLine> items,
            @Size(max = 40) List<@Valid CustomLine> customItems,
            /** Shown to the customer on the order, e.g. "Amul butter was out, sent Mother Dairy". */
            @Size(max = 300) String note) {
    }

    public record RejectRequest(@NotBlank @Size(max = 300) String reason) {
    }

    public record CountsDto(long pending) {
    }
}
