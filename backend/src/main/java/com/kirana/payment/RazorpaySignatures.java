package com.kirana.payment;

import com.kirana.common.Hashing;

/** Razorpay signature checks (HMAC-SHA256, hex). */
public final class RazorpaySignatures {

    private RazorpaySignatures() {
    }

    /** Checkout callback: HMAC(order_id + "|" + payment_id, key secret). */
    public static boolean verifyPayment(String orderId, String paymentId, String signature, String secret) {
        if (orderId == null || paymentId == null || signature == null || secret == null || secret.isBlank()) {
            return false;
        }
        return Hashing.constantTimeEquals(Hashing.hmacSha256Hex(secret, orderId + "|" + paymentId), signature);
    }

    /** Webhook: HMAC(raw request body, webhook secret) sent in X-Razorpay-Signature. */
    public static boolean verifyWebhook(byte[] body, String signature, String webhookSecret) {
        if (body == null || signature == null || webhookSecret == null || webhookSecret.isBlank()) {
            return false;
        }
        return Hashing.constantTimeEquals(Hashing.hmacSha256Hex(webhookSecret, body), signature);
    }
}
