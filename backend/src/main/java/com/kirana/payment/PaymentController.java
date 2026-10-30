package com.kirana.payment;

import com.kirana.auth.AuthPrincipal;
import com.kirana.order.OrderDtos.OrderDetailDto;
import com.kirana.order.OrderQueryService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Payments")
@RestController
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService payments;
    private final OrderQueryService queries;

    public record VerifyPaymentRequest(@NotNull Long orderId,
                                       @NotBlank @Size(max = 100) String razorpayOrderId,
                                       @NotBlank @Size(max = 100) String razorpayPaymentId,
                                       @NotBlank @Size(max = 200) String signature) {
    }

    @PostMapping("/api/v1/app/payments/razorpay/verify")
    public OrderDetailDto verify(@AuthenticationPrincipal AuthPrincipal me, @Valid @RequestBody VerifyPaymentRequest request) {
        payments.verify(me.id(), new PaymentService.VerifyRequest(request.orderId(), request.razorpayOrderId(),
                request.razorpayPaymentId(), request.signature()));
        return queries.customerOrder(me.id(), request.orderId());
    }

    @PostMapping("/api/v1/webhooks/razorpay")
    public Map<String, Object> webhook(@RequestBody byte[] body,
                                       @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature) {
        return Map.of("processed", payments.handleWebhook(body, signature));
    }
}
