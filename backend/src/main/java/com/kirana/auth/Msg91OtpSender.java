package com.kirana.auth;

import com.kirana.common.ApiException;
import com.kirana.common.ErrorCode;
import com.kirana.config.AppProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** Sends the OTP through MSG91's OTP API (v5) using a DLT approved template with an ##OTP## variable. */
@Slf4j
@Component
@ConditionalOnProperty(name = "app.otp.provider", havingValue = "msg91")
public class Msg91OtpSender implements OtpSender {

    private final RestClient client;
    private final AppProperties.Msg91 config;

    public Msg91OtpSender(AppProperties properties, RestClient.Builder builder) {
        this.config = properties.otp().msg91();
        if (config.authKey() == null || config.authKey().isBlank()
                || config.templateId() == null || config.templateId().isBlank()) {
            throw new IllegalStateException("MSG91_AUTH_KEY and MSG91_TEMPLATE_ID are required when OTP_PROVIDER=msg91");
        }
        this.client = builder.baseUrl(config.baseUrl()).build();
    }

    @Override
    public void send(String phoneE164, String code) {
        try {
            client.post()
                    .uri(uri -> uri.path("/api/v5/otp")
                            .queryParam("template_id", config.templateId())
                            .queryParam("mobile", phoneE164.substring(1))
                            .queryParam("otp", code)
                            .build())
                    .header("authkey", config.authKey())
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException e) {
            log.error("MSG91 OTP send failed for {}: {}", phoneE164, e.getMessage());
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "Could not send OTP, please try again");
        }
    }
}
