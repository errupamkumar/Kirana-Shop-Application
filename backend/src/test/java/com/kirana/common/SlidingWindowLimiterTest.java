package com.kirana.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class SlidingWindowLimiterTest {

    /** Minimal adjustable clock. */
    static final class TestClock extends Clock {
        private Instant now = Instant.parse("2026-10-30T10:00:00Z");

        void advance(Duration d) {
            now = now.plus(d);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    @Test
    void limitsInsideTheWindowAndRecoversAfterIt() {
        TestClock clock = new TestClock();
        SlidingWindowLimiter limiter = new SlidingWindowLimiter(3, Duration.ofMinutes(15), clock);
        assertThat(limiter.tryAcquire("k")).isTrue();
        assertThat(limiter.tryAcquire("k")).isTrue();
        assertThat(limiter.tryAcquire("k")).isTrue();
        assertThat(limiter.tryAcquire("k")).isFalse();
        assertThat(limiter.isLimited("k")).isTrue();
        assertThat(limiter.retryAfter("k")).isEqualTo(Duration.ofMinutes(15));

        clock.advance(Duration.ofMinutes(10));
        assertThat(limiter.retryAfter("k")).isEqualTo(Duration.ofMinutes(5));
        clock.advance(Duration.ofMinutes(5));
        assertThat(limiter.isLimited("k")).isFalse();
        assertThat(limiter.tryAcquire("k")).isTrue();
    }

    @Test
    void keysAreIndependentAndResetClears() {
        SlidingWindowLimiter limiter = new SlidingWindowLimiter(1, Duration.ofMinutes(1), new TestClock());
        limiter.record("a");
        assertThat(limiter.isLimited("a")).isTrue();
        assertThat(limiter.isLimited("b")).isFalse();
        limiter.reset("a");
        assertThat(limiter.isLimited("a")).isFalse();
    }

    @Test
    void slidingNotFixed() {
        TestClock clock = new TestClock();
        SlidingWindowLimiter limiter = new SlidingWindowLimiter(2, Duration.ofMinutes(10), clock);
        limiter.record("k");
        clock.advance(Duration.ofMinutes(6));
        limiter.record("k");
        assertThat(limiter.isLimited("k")).isTrue();
        clock.advance(Duration.ofMinutes(5));
        // The first event left the window, the second is still inside it
        assertThat(limiter.isLimited("k")).isFalse();
        limiter.record("k");
        assertThat(limiter.isLimited("k")).isTrue();
    }
}
