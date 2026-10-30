package com.kirana.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.kirana.IntegrationTest;
import com.kirana.catalog.ProductVariantRepository;
import com.kirana.common.Hashing;
import com.kirana.order.PendingPaymentExpiryJob;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

class PaymentIntegrationTest extends IntegrationTest {

    private static final String KEY_ID = "rzp_test_key";
    private static final String SECRET = "rzp_test_secret_value";
    private static final String WEBHOOK_SECRET = "test-webhook-secret";

    @Autowired
    PendingPaymentExpiryJob expiryJob;
    @Autowired
    ProductVariantRepository variants;

    @BeforeEach
    void enableOnline() {
        settings.update(defaultSettings(true, true, KEY_ID, SECRET, true), "test");
    }

    @AfterEach
    void reset() {
        resetSettings();
    }

    record Placed(Customer customer, long orderId, String gatewayOrderId, long variantId) {
    }

    private Placed placeOnline() throws Exception {
        Customer c = newCustomer();
        long address = createAddress(c, NEAR_LAT, NEAR_LNG);
        long variant = variantId(createProduct("600.00", "650.00", 3));
        JsonNode order = body(placeOrder(c, "pay-" + uniqueSuffix(), orderRequest(variant, 1, address, "ONLINE", "630.00"))
                .andExpect(status().isCreated()));
        assertThat(order.get("status").asText()).isEqualTo("PENDING_PAYMENT");
        assertThat(order.get("paymentStatus").asText()).isEqualTo("PENDING");
        assertThat(order.at("/payment/keyId").asText()).isEqualTo(KEY_ID);
        assertThat(order.at("/payment/amountPaise").asLong()).isEqualTo(63000L);
        assertThat(order.toString()).doesNotContain(SECRET);
        return new Placed(c, order.get("id").asLong(), order.at("/payment/gatewayOrderId").asText(), variant);
    }

    @Test
    void validSignatureConfirmsThePayment() throws Exception {
        Placed p = placeOnline();
        assertThat(variants.findById(p.variantId()).orElseThrow().getStockQty()).isEqualTo(2);
        String signature = Hashing.hmacSha256Hex(SECRET, p.gatewayOrderId() + "|pay_123");
        postJson("/api/v1/app/payments/razorpay/verify", p.customer().token(), Map.of("orderId", p.orderId(),
                "razorpayOrderId", p.gatewayOrderId(), "razorpayPaymentId", "pay_123", "signature", signature))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PLACED"))
                .andExpect(jsonPath("$.paymentStatus").value("PAID"))
                .andExpect(jsonPath("$.payment.status").value("PAID"));

        // Verifying again (e.g. app retry) is harmless
        postJson("/api/v1/app/payments/razorpay/verify", p.customer().token(), Map.of("orderId", p.orderId(),
                "razorpayOrderId", p.gatewayOrderId(), "razorpayPaymentId", "pay_123", "signature", signature))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PLACED"));
    }

    @Test
    void tamperedSignatureIsRejected() throws Exception {
        Placed p = placeOnline();
        String signature = Hashing.hmacSha256Hex(SECRET, p.gatewayOrderId() + "|pay_123");
        postJson("/api/v1/app/payments/razorpay/verify", p.customer().token(), Map.of("orderId", p.orderId(),
                "razorpayOrderId", p.gatewayOrderId(), "razorpayPaymentId", "pay_999", "signature", signature))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PAYMENT_VERIFICATION_FAILED"));
        get("/api/v1/app/orders/" + p.orderId(), p.customer().token()).andExpect(jsonPath("$.status").value("PENDING_PAYMENT"));
    }

    @Test
    void webhookConfirmsPaymentAndChecksSignature() throws Exception {
        Placed p = placeOnline();
        String event = "{\"event\":\"payment.captured\",\"payload\":{\"payment\":{\"entity\":{\"id\":\"pay_wh_1\","
                + "\"order_id\":\"" + p.gatewayOrderId() + "\",\"status\":\"captured\"}}}}";
        byte[] bytes = event.getBytes(StandardCharsets.UTF_8);

        mvc.perform(post("/api/v1/webhooks/razorpay").contentType(MediaType.APPLICATION_JSON).content(bytes)
                        .header("X-Razorpay-Signature", "bad"))
                .andExpect(status().isBadRequest());

        mvc.perform(post("/api/v1/webhooks/razorpay").contentType(MediaType.APPLICATION_JSON).content(bytes)
                        .header("X-Razorpay-Signature", Hashing.hmacSha256Hex(WEBHOOK_SECRET, bytes)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.processed").value(true));
        get("/api/v1/app/orders/" + p.orderId(), p.customer().token())
                .andExpect(jsonPath("$.status").value("PLACED")).andExpect(jsonPath("$.paymentStatus").value("PAID"));
    }

    @Test
    void unpaidOrdersExpireAndReleaseStock() throws Exception {
        Placed p = placeOnline();
        assertThat(expiryJob.run()).isZero();
        clock.advance(Duration.ofMinutes(16));
        assertThat(expiryJob.run()).isGreaterThanOrEqualTo(1);
        clock.reset();

        get("/api/v1/app/orders/" + p.orderId(), p.customer().token())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.paymentStatus").value("FAILED"));
        assertThat(variants.findById(p.variantId()).orElseThrow().getStockQty()).isEqualTo(3);

        // Paying after expiry flags a refund instead of reviving the order
        String signature = Hashing.hmacSha256Hex(SECRET, p.gatewayOrderId() + "|pay_late");
        postJson("/api/v1/app/payments/razorpay/verify", p.customer().token(), Map.of("orderId", p.orderId(),
                "razorpayOrderId", p.gatewayOrderId(), "razorpayPaymentId", "pay_late", "signature", signature))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.paymentStatus").value("REFUND_PENDING"));
    }

    @Test
    void onlineIsRejectedServerSideWhenToggledOff() throws Exception {
        resetSettings();
        Customer c = newCustomer();
        long address = createAddress(c, NEAR_LAT, NEAR_LNG);
        long variant = variantId(createProduct("600.00", "650.00", 3));
        placeOrder(c, "off-" + uniqueSuffix(), orderRequest(variant, 1, address, "ONLINE", "630.00"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("PAYMENT_METHOD_DISABLED"));
        get("/api/v1/app/config", null).andExpect(jsonPath("$.onlinePaymentEnabled").value(false))
                .andExpect(jsonPath("$.allowedPaymentMethods.length()").value(1));
    }
}
