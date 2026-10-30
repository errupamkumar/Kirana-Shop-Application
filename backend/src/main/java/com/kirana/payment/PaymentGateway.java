package com.kirana.payment;

import java.math.BigDecimal;
import java.util.Map;

/** Online payment provider. Credentials come from store settings (key id) and the encrypted secret. */
public interface PaymentGateway {

    record GatewayOrder(String id, long amountPaise, String currency, Map<String, Object> raw) {
    }

    String name();

    GatewayOrder createOrder(BigDecimal amount, String receipt, String keyId, String secret);

    boolean verifyPaymentSignature(String gatewayOrderId, String gatewayPaymentId, String signature, String secret);

    boolean verifyWebhookSignature(byte[] body, String signature, String webhookSecret);
}
