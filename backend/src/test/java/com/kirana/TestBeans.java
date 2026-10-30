package com.kirana;

import com.kirana.auth.OtpSender;
import com.kirana.common.Money;
import com.kirana.payment.Payment;
import com.kirana.payment.PaymentGateway;
import com.kirana.payment.RazorpaySignatures;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** Test doubles shared by every integration test (one Spring context, one MySQL container). */
@TestConfiguration(proxyBeanMethods = false)
public class TestBeans {

    @Bean
    @Primary
    MutableClock testClock() {
        return new MutableClock();
    }

    @Bean
    @Primary
    CapturingOtpSender capturingOtpSender() {
        return new CapturingOtpSender();
    }

    @Bean
    @Primary
    FakePaymentGateway fakePaymentGateway() {
        return new FakePaymentGateway();
    }

    /** System time shifted by an adjustable offset. */
    public static class MutableClock extends Clock {

        private volatile Duration offset = Duration.ZERO;

        public void advance(Duration duration) {
            offset = offset.plus(duration);
        }

        public void reset() {
            offset = Duration.ZERO;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return Clock.offset(Clock.system(zone), offset);
        }

        @Override
        public Instant instant() {
            return Instant.now().plus(offset);
        }
    }

    /** Remembers the last OTP sent to each phone. */
    public static class CapturingOtpSender implements OtpSender {

        private final Map<String, String> codes = new ConcurrentHashMap<>();

        @Override
        public void send(String phoneE164, String code) {
            codes.put(phoneE164, code);
        }

        public String lastCode(String phoneE164) {
            return codes.get(phoneE164);
        }
    }

    /** Creates fake Razorpay orders locally; signature checks are the real ones. */
    public static class FakePaymentGateway implements PaymentGateway {

        private final AtomicInteger seq = new AtomicInteger();

        @Override
        public String name() {
            return Payment.GATEWAY_RAZORPAY;
        }

        @Override
        public GatewayOrder createOrder(BigDecimal amount, String receipt, String keyId, String secret) {
            String id = "order_test_" + seq.incrementAndGet();
            return new GatewayOrder(id, Money.toPaise(amount), "INR", Map.of("id", id, "receipt", receipt));
        }

        @Override
        public boolean verifyPaymentSignature(String gatewayOrderId, String gatewayPaymentId, String signature, String secret) {
            return RazorpaySignatures.verifyPayment(gatewayOrderId, gatewayPaymentId, signature, secret);
        }

        @Override
        public boolean verifyWebhookSignature(byte[] body, String signature, String webhookSecret) {
            return RazorpaySignatures.verifyWebhook(body, signature, webhookSecret);
        }
    }
}
