package com.kirana.checkout;

import com.kirana.common.Money;
import java.math.BigDecimal;

/** The money rules, kept pure so the boundaries are easy to test. All comparisons use the item subtotal. */
public final class Pricing {

    private Pricing() {
    }

    /** Free when a threshold is set and the subtotal reaches it; otherwise the flat delivery charge. */
    public static BigDecimal deliveryFee(BigDecimal itemSubtotal, BigDecimal deliveryCharge, BigDecimal freeDeliveryAbove) {
        if (freeDeliveryAbove != null && itemSubtotal.compareTo(freeDeliveryAbove) >= 0) {
            return Money.ZERO;
        }
        return Money.scale(deliveryCharge);
    }

    public static boolean meetsMinimum(BigDecimal itemSubtotal, BigDecimal minOrderAmount) {
        return itemSubtotal.compareTo(minOrderAmount) >= 0;
    }

    /** "Add ₹X more to enable order"; zero once the minimum is met. */
    public static BigDecimal amountToMinOrder(BigDecimal itemSubtotal, BigDecimal minOrderAmount) {
        return Money.scale(minOrderAmount.subtract(itemSubtotal).max(BigDecimal.ZERO));
    }

    /** "Add ₹Y more for free delivery"; null when there is no free-delivery threshold. */
    public static BigDecimal amountToFreeDelivery(BigDecimal itemSubtotal, BigDecimal freeDeliveryAbove) {
        return freeDeliveryAbove == null ? null : Money.scale(freeDeliveryAbove.subtract(itemSubtotal).max(BigDecimal.ZERO));
    }

    /** Serviceable when the distance is at most the radius (the boundary itself is inside). */
    public static boolean withinRadius(double distanceKm, BigDecimal radiusKm) {
        return distanceKm <= radiusKm.doubleValue();
    }
}
