package com.kirana.common;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;

/**
 * Counts events per key inside a sliding time window (in memory, per instance). Used for login lockout and
 * per-IP OTP limits. Idle keys are dropped automatically after one window.
 */
public class SlidingWindowLimiter {

    private final int maxEvents;
    private final Duration window;
    private final Clock clock;
    private final Cache<String, Deque<Instant>> events;

    public SlidingWindowLimiter(int maxEvents, Duration window, Clock clock) {
        this.maxEvents = maxEvents;
        this.window = window;
        this.clock = clock;
        this.events = Caffeine.newBuilder().expireAfterAccess(window).maximumSize(100_000).build();
    }

    /** True when the key already has the maximum number of events inside the window. */
    public boolean isLimited(String key) {
        Deque<Instant> deque = events.getIfPresent(key);
        if (deque == null) {
            return false;
        }
        synchronized (deque) {
            prune(deque);
            return deque.size() >= maxEvents;
        }
    }

    public void record(String key) {
        Deque<Instant> deque = events.get(key, k -> new ArrayDeque<>());
        synchronized (deque) {
            prune(deque);
            deque.addLast(Instant.now(clock));
        }
    }

    /** Records the event unless the key is limited; returns false when it was limited. */
    public boolean tryAcquire(String key) {
        Deque<Instant> deque = events.get(key, k -> new ArrayDeque<>());
        synchronized (deque) {
            prune(deque);
            if (deque.size() >= maxEvents) {
                return false;
            }
            deque.addLast(Instant.now(clock));
            return true;
        }
    }

    public void reset(String key) {
        events.invalidate(key);
    }

    /** Time until the oldest event in the window expires (how long a limited key must wait). */
    public Duration retryAfter(String key) {
        Deque<Instant> deque = events.getIfPresent(key);
        if (deque == null) {
            return Duration.ZERO;
        }
        synchronized (deque) {
            prune(deque);
            Instant oldest = deque.peekFirst();
            if (oldest == null) {
                return Duration.ZERO;
            }
            Duration wait = Duration.between(Instant.now(clock), oldest.plus(window));
            return wait.isNegative() ? Duration.ZERO : wait;
        }
    }

    private void prune(Deque<Instant> deque) {
        Instant cutoff = Instant.now(clock).minus(window);
        while (!deque.isEmpty() && !deque.peekFirst().isAfter(cutoff)) {
            deque.removeFirst();
        }
    }
}
