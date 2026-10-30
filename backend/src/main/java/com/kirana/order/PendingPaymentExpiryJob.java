package com.kirana.order;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Cancels online orders still unpaid after the expiry window (default 15 min) and releases their stock. */
@Slf4j
@Component
@RequiredArgsConstructor
public class PendingPaymentExpiryJob {

    private final OrderService orders;

    @Scheduled(fixedDelayString = "PT1M", initialDelayString = "PT1M")
    public int run() {
        int expired = 0;
        for (Long id : orders.findExpiredPendingPaymentIds()) {
            try {
                if (orders.expireIfPending(id)) {
                    expired++;
                }
            } catch (RuntimeException e) {
                log.error("Could not expire pending order {}", id, e);
            }
        }
        if (expired > 0) {
            log.info("Expired {} unpaid online order(s)", expired);
        }
        return expired;
    }
}
