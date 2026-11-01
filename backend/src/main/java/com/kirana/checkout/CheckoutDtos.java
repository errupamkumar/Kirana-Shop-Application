package com.kirana.checkout;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.kirana.common.ErrorCode;
import com.kirana.payment.PaymentMethod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

public final class CheckoutDtos {

    private CheckoutDtos() {
    }

    public record CartItem(@NotNull Long variantId, @NotNull @Min(1) @Max(50) Integer qty) {
    }

    /** Location: either {@code addressId} (preferred) or a raw {@code lat}/{@code lng}. */
    public record CartValidateRequest(
            @NotEmpty @Size(max = 50) List<@Valid CartItem> items,
            Long addressId,
            @DecimalMin("-90") @DecimalMax("90") BigDecimal lat,
            @DecimalMin("-180") @DecimalMax("180") BigDecimal lng,
            PaymentMethod paymentMethod) {
    }

    public record LocationCheckRequest(@NotNull @DecimalMin("-90") @DecimalMax("90") BigDecimal lat,
                                       @NotNull @DecimalMin("-180") @DecimalMax("180") BigDecimal lng) {
    }

    public record LocationCheckResponse(boolean serviceable, BigDecimal distanceKm, BigDecimal radiusKm) {
    }

    public record Location(BigDecimal lat, BigDecimal lng) {
    }

    public enum LineIssue {
        OUT_OF_STOCK,
        VARIANT_INACTIVE
    }

    public record QuoteLine(Long variantId, Long productId, String productName, String productNameHi, String variantLabel, String imageUrl,
                            BigDecimal mrp, BigDecimal sellingPrice, int qty, BigDecimal lineTotal, LineIssue issue) {
    }

    public record Violation(ErrorCode code, String message, List<Long> variantIds) {
    }

    /**
     * Server-side price and rule check for a cart. Business problems are listed in {@code violations}
     * instead of thrown, so the app can show them all.
     */
    public record CartQuote(
            List<QuoteLine> lines,
            BigDecimal itemSubtotal,
            BigDecimal deliveryFee,
            BigDecimal total,
            BigDecimal minOrderAmount,
            BigDecimal amountToMinOrder,
            BigDecimal freeDeliveryAbove,
            BigDecimal amountToFreeDelivery,
            Boolean serviceable,
            BigDecimal distanceKm,
            BigDecimal radiusKm,
            List<PaymentMethod> allowedPaymentMethods,
            PaymentMethod paymentMethod,
            boolean storeOpen,
            String storeClosedMessage,
            List<Violation> violations) {

        @JsonProperty("canPlaceOrder")
        public boolean canPlaceOrder() {
            return violations.isEmpty() && Boolean.TRUE.equals(serviceable) && paymentMethod != null;
        }
    }
}
