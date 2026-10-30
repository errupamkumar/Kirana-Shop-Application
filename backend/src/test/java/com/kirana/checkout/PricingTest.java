package com.kirana.checkout;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class PricingTest {

    private static final BigDecimal MIN = new BigDecimal("500.00");
    private static final BigDecimal CHARGE = new BigDecimal("30.00");
    private static final BigDecimal FREE_ABOVE = new BigDecimal("1000.00");

    @Test
    void minimumOrderBoundary() {
        assertThat(Pricing.meetsMinimum(new BigDecimal("499.99"), MIN)).isFalse();
        assertThat(Pricing.meetsMinimum(new BigDecimal("500.00"), MIN)).isTrue();
        assertThat(Pricing.meetsMinimum(new BigDecimal("500.01"), MIN)).isTrue();
    }

    @Test
    void amountToMinOrder() {
        assertThat(Pricing.amountToMinOrder(new BigDecimal("499.99"), MIN)).isEqualByComparingTo("0.01");
        assertThat(Pricing.amountToMinOrder(new BigDecimal("320.00"), MIN)).isEqualByComparingTo("180.00");
        assertThat(Pricing.amountToMinOrder(new BigDecimal("650.00"), MIN)).isEqualByComparingTo("0.00");
    }

    @Test
    void freeDeliveryBoundary() {
        assertThat(Pricing.deliveryFee(new BigDecimal("999.99"), CHARGE, FREE_ABOVE)).isEqualByComparingTo("30.00");
        assertThat(Pricing.deliveryFee(new BigDecimal("1000.00"), CHARGE, FREE_ABOVE)).isEqualByComparingTo("0.00");
        assertThat(Pricing.deliveryFee(new BigDecimal("1500.00"), CHARGE, FREE_ABOVE)).isEqualByComparingTo("0.00");
    }

    @Test
    void nullThresholdMeansNeverFree() {
        assertThat(Pricing.deliveryFee(new BigDecimal("100000.00"), CHARGE, null)).isEqualByComparingTo("30.00");
        assertThat(Pricing.amountToFreeDelivery(new BigDecimal("100.00"), null)).isNull();
    }

    @Test
    void amountToFreeDelivery() {
        assertThat(Pricing.amountToFreeDelivery(new BigDecimal("640.00"), FREE_ABOVE)).isEqualByComparingTo("360.00");
        assertThat(Pricing.amountToFreeDelivery(new BigDecimal("1200.00"), FREE_ABOVE)).isEqualByComparingTo("0.00");
    }

    @Test
    void radiusBoundaryIsInclusive() {
        BigDecimal radius = new BigDecimal("5.00");
        assertThat(Pricing.withinRadius(4.99, radius)).isTrue();
        assertThat(Pricing.withinRadius(5.00, radius)).isTrue();
        assertThat(Pricing.withinRadius(5.0001, radius)).isFalse();
    }

    @Test
    void pointExactlyOnTheRadiusIsServiceable() {
        double lat1 = 12.971599;
        double lng1 = 77.594566;
        double lat2 = 12.99;
        double exact = HaversineCalculator.distanceKm(lat1, lng1, lat2, lng1);
        BigDecimal radius = BigDecimal.valueOf(exact);
        assertThat(Pricing.withinRadius(HaversineCalculator.distanceKm(lat1, lng1, lat2, lng1), radius)).isTrue();
        assertThat(Pricing.withinRadius(HaversineCalculator.distanceKm(lat1, lng1, lat2 + 0.0001, lng1), radius)).isFalse();
    }
}
