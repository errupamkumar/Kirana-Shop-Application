package com.kirana.checkout;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import org.junit.jupiter.api.Test;

class HaversineCalculatorTest {

    @Test
    void samePointIsZero() {
        assertThat(HaversineCalculator.distanceKm(12.97, 77.59, 12.97, 77.59)).isZero();
    }

    @Test
    void hundredthOfADegreeOfLatitudeIsAboutOnePointOneOneKm() {
        assertThat(HaversineCalculator.distanceKm(12.97, 77.59, 12.98, 77.59)).isCloseTo(1.112, within(0.002));
    }

    @Test
    void oneDegreeOfLongitudeAtTheEquatorIsAbout111Km() {
        assertThat(HaversineCalculator.distanceKm(0, 0, 0, 1)).isCloseTo(111.195, within(0.01));
    }

    @Test
    void bengaluruToMysuruIsAbout126Km() {
        // MG Road, Bengaluru to Mysuru Palace (straight line)
        assertThat(HaversineCalculator.distanceKm(12.9716, 77.5946, 12.3052, 76.6552)).isCloseTo(126.7, within(1.5));
    }

    @Test
    void isSymmetric() {
        double ab = HaversineCalculator.distanceKm(12.9716, 77.5946, 13.0827, 80.2707);
        double ba = HaversineCalculator.distanceKm(13.0827, 80.2707, 12.9716, 77.5946);
        assertThat(ab).isCloseTo(ba, within(1e-9));
    }
}
