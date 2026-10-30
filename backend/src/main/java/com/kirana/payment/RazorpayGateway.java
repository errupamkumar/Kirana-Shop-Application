package com.kirana.payment;

import com.kirana.common.ApiException;
import com.kirana.common.ErrorCode;
import com.kirana.common.Money;
import com.kirana.config.AppProperties;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** Razorpay Orders API (https://razorpay.com/docs/api/orders/) over HTTP basic auth. */
@Slf4j
@Component
public class RazorpayGateway implements PaymentGateway {

    private final RestClient client;

    public RazorpayGateway(AppProperties properties, RestClient.Builder builder) {
        this.client = builder.baseUrl(properties.payments().razorpayBaseUrl()).build();
    }

    @Override
    public String name() {
        return Payment.GATEWAY_RAZORPAY;
    }

    @Override
    public GatewayOrder createOrder(BigDecimal amount, String receipt, String keyId, String secret) {
        long paise = Money.toPaise(amount);
        String auth = Base64.getEncoder().encodeToString((keyId + ":" + secret).getBytes(StandardCharsets.UTF_8));
        try {
            Map<String, Object> body = client.post()
                    .uri("/v1/orders")
                    .header(HttpHeaders.AUTHORIZATION, "Basic " + auth)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("amount", paise, "currency", "INR", "receipt", receipt))
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {
                    });
            if (body == null || body.get("id") == null) {
                throw new ApiException(ErrorCode.PAYMENT_GATEWAY_ERROR, "Payment gateway returned no order id");
            }
            return new GatewayOrder((String) body.get("id"), paise, "INR", body);
        } catch (RestClientException e) {
            log.error("Razorpay order creation failed for receipt {}: {}", receipt, e.getMessage());
            throw new ApiException(ErrorCode.PAYMENT_GATEWAY_ERROR, "Could not start online payment, please try again");
        }
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
