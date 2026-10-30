package com.kirana.payment;

import static org.assertj.core.api.Assertions.assertThat;

import com.kirana.common.Hashing;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class RazorpaySignaturesTest {

    private static final String SECRET = "rzp_test_secret";

    @Test
    void validPaymentSignature() {
        String signature = Hashing.hmacSha256Hex(SECRET, "order_123|pay_456");
        assertThat(RazorpaySignatures.verifyPayment("order_123", "pay_456", signature, SECRET)).isTrue();
    }

    @Test
    void tamperedPaymentSignatureIsRejected() {
        String signature = Hashing.hmacSha256Hex(SECRET, "order_123|pay_456");
        assertThat(RazorpaySignatures.verifyPayment("order_123", "pay_999", signature, SECRET)).isFalse();
        assertThat(RazorpaySignatures.verifyPayment("order_999", "pay_456", signature, SECRET)).isFalse();
        assertThat(RazorpaySignatures.verifyPayment("order_123", "pay_456", signature, "other_secret")).isFalse();
        String flipped = (signature.charAt(0) == 'a' ? 'b' : 'a') + signature.substring(1);
        assertThat(RazorpaySignatures.verifyPayment("order_123", "pay_456", flipped, SECRET)).isFalse();
    }

    @Test
    void missingValuesAreRejected() {
        assertThat(RazorpaySignatures.verifyPayment("order_123", "pay_456", null, SECRET)).isFalse();
        assertThat(RazorpaySignatures.verifyPayment("order_123", "pay_456", "abc", "")).isFalse();
    }

    @Test
    void webhookSignature() {
        byte[] body = "{\"event\":\"payment.captured\"}".getBytes(StandardCharsets.UTF_8);
        String signature = Hashing.hmacSha256Hex("whsec", body);
        assertThat(RazorpaySignatures.verifyWebhook(body, signature, "whsec")).isTrue();
        byte[] tampered = "{\"event\":\"payment.failed\"}".getBytes(StandardCharsets.UTF_8);
        assertThat(RazorpaySignatures.verifyWebhook(tampered, signature, "whsec")).isFalse();
        assertThat(RazorpaySignatures.verifyWebhook(body, signature, null)).isFalse();
    }
}
