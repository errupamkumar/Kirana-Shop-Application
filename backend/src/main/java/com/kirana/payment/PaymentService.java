package com.kirana.payment;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kirana.common.ApiException;
import com.kirana.common.ErrorCode;
import com.kirana.config.AppProperties;
import com.kirana.order.CustomerOrderRepository;
import com.kirana.order.OrderService;
import com.kirana.settings.StoreSettingsService;
import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Confirms online payments from the app callback (signature) or the Razorpay webhook. Both paths are idempotent. */
@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository payments;
    private final CustomerOrderRepository orders;
    private final OrderService orderService;
    private final PaymentGateway gateway;
    private final StoreSettingsService settings;
    private final AppProperties properties;
    private final ObjectMapper objectMapper;

    public record VerifyRequest(Long orderId, String razorpayOrderId, String razorpayPaymentId, String signature) {
    }

    @Transactional
    public void verify(Long userId, VerifyRequest req) {
        orders.findByIdAndUserId(req.orderId(), userId).orElseThrow(() -> ApiException.notFound("Order"));
        Payment payment = payments.findByGatewayOrderId(req.razorpayOrderId())
                .filter(p -> p.getOrderId().equals(req.orderId()))
                .orElseThrow(() -> new ApiException(ErrorCode.PAYMENT_VERIFICATION_FAILED, "Payment does not match this order"));
        String secret = settings.gatewaySecret()
                .orElseThrow(() -> new ApiException(ErrorCode.PAYMENT_METHOD_DISABLED, "Online payment is not configured"));
        if (!gateway.verifyPaymentSignature(req.razorpayOrderId(), req.razorpayPaymentId(), req.signature(), secret)) {
            log.warn("Invalid payment signature for order {}", req.orderId());
            throw new ApiException(ErrorCode.PAYMENT_VERIFICATION_FAILED, "Payment could not be verified");
        }
        markPaid(payment, req.razorpayPaymentId(), Map.of("source", "checkout", "razorpay_payment_id", req.razorpayPaymentId()));
    }

    /** Razorpay webhook; handles payment.captured and order.paid. Returns false for ignored events. */
    @Transactional
    public boolean handleWebhook(byte[] body, String signature) {
        String secret = properties.payments().razorpayWebhookSecret();
        if (!gateway.verifyWebhookSignature(body, signature, secret)) {
            throw new ApiException(ErrorCode.PAYMENT_VERIFICATION_FAILED, "Invalid webhook signature");
        }
        Map<String, Object> event;
        try {
            event = objectMapper.readValue(body, new TypeReference<>() {
            });
        } catch (IOException e) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Malformed webhook body");
        }
        String type = String.valueOf(event.get("event"));
        if (!"payment.captured".equals(type) && !"order.paid".equals(type)) {
            return false;
        }
        Map<String, Object> entity = paymentEntity(event).orElse(Map.of());
        String gatewayOrderId = (String) entity.get("order_id");
        String gatewayPaymentId = (String) entity.get("id");
        if (gatewayOrderId == null) {
            return false;
        }
        Optional<Payment> payment = payments.findByGatewayOrderId(gatewayOrderId);
        if (payment.isEmpty()) {
            log.warn("Webhook for unknown Razorpay order {}", gatewayOrderId);
            return false;
        }
        markPaid(payment.get(), gatewayPaymentId, event);
        return true;
    }

    private void markPaid(Payment payment, String gatewayPaymentId, Map<String, Object> raw) {
        if (payment.getStatus() != PaymentStatus.PAID && payment.getStatus() != PaymentStatus.REFUND_PENDING) {
            payment.setStatus(PaymentStatus.PAID);
            payment.setGatewayPaymentId(gatewayPaymentId);
            payment.setRawResponse(raw);
        }
        orderService.onPaymentCaptured(payment.getOrderId());
        orders.findById(payment.getOrderId())
                .filter(o -> o.getPaymentStatus() == PaymentStatus.REFUND_PENDING)
                .ifPresent(o -> payment.setStatus(PaymentStatus.REFUND_PENDING));
    }

    @SuppressWarnings("unchecked")
    private static Optional<Map<String, Object>> paymentEntity(Map<String, Object> event) {
        try {
            Map<String, Object> payload = (Map<String, Object>) event.get("payload");
            Map<String, Object> paymentWrapper = (Map<String, Object>) payload.get("payment");
            return Optional.ofNullable((Map<String, Object>) paymentWrapper.get("entity"));
        } catch (ClassCastException | NullPointerException e) {
            return Optional.empty();
        }
    }
}
