package com.kirana.common;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** INR amounts: two decimals, HALF_UP. */
public final class Money {

    public static final BigDecimal ZERO = scale(BigDecimal.ZERO);

    private Money() {
    }

    public static BigDecimal scale(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.HALF_UP);
    }

    public static BigDecimal times(BigDecimal price, int qty) {
        return scale(price.multiply(BigDecimal.valueOf(qty)));
    }

    /** Amount in paise for payment gateways. */
    public static long toPaise(BigDecimal amount) {
        return scale(amount).movePointRight(2).longValueExact();
    }

    /** Whole-number discount percentage of selling price against MRP. */
    public static int discountPercent(BigDecimal mrp, BigDecimal sellingPrice) {
        if (mrp.signum() <= 0 || sellingPrice.compareTo(mrp) >= 0) {
            return 0;
        }
        return mrp.subtract(sellingPrice).multiply(BigDecimal.valueOf(100))
                .divide(mrp, 0, RoundingMode.HALF_UP).intValue();
    }
}
