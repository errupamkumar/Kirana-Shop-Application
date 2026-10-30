package com.kirana.settings;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.kirana.IntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;

class SettingsIntegrationTest extends IntegrationTest {

    private static final String SECRET = "super_secret_gateway_value";

    @BeforeEach
    @AfterEach
    void reset() {
        resetSettings();
    }

    @Test
    void appConfigIsPublicAndHasNoSecret() throws Exception {
        String content = get("/api/v1/app/config", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maxDeliveryRadiusKm").value(5.0))
                .andExpect(jsonPath("$.minOrderAmount").value(500.0))
                .andExpect(jsonPath("$.allowedPaymentMethods[0]").value("COD"))
                .andReturn().getResponse().getContentAsString();
        assertThat(content).doesNotContainIgnoringCase("secret");
    }

    @Test
    void secretIsWriteOnlyAndBlankKeepsIt() throws Exception {
        String admin = adminToken();
        ObjectNode req = json.valueToTree(defaultSettings(true, true, "rzp_test_key", SECRET, true));
        call(HttpMethod.PUT, "/api/v1/admin/settings", admin, req)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gatewaySecretSet").value(true));

        String adminView = get("/api/v1/admin/settings", admin).andExpect(status().isOk())
                .andExpect(jsonPath("$.gatewaySecretSet").value(true))
                .andReturn().getResponse().getContentAsString();
        assertThat(adminView).doesNotContain(SECRET).doesNotContain("gatewaySecretEnc");

        String appView = get("/api/v1/app/config", null)
                .andExpect(jsonPath("$.onlinePaymentEnabled").value(true))
                .andExpect(jsonPath("$.gatewayKeyId").value("rzp_test_key"))
                .andReturn().getResponse().getContentAsString();
        assertThat(appView).doesNotContain(SECRET);

        // Blank secret keeps the stored one
        req.put("gatewaySecret", "");
        call(HttpMethod.PUT, "/api/v1/admin/settings", admin, req).andExpect(status().isOk())
                .andExpect(jsonPath("$.gatewaySecretSet").value(true));
        assertThat(settings.gatewaySecret()).contains(SECRET);
    }

    @Test
    void updateIsReflectedInAppConfigImmediately() throws Exception {
        String admin = adminToken();
        ObjectNode req = json.valueToTree(defaultSettings(true, false, null, null, true));
        req.put("minOrderAmount", 250);
        req.put("deliveryCharge", 15);
        req.putNull("freeDeliveryAbove");
        call(HttpMethod.PUT, "/api/v1/admin/settings", admin, req).andExpect(status().isOk());

        get("/api/v1/app/config", null)
                .andExpect(jsonPath("$.minOrderAmount").value(250.0))
                .andExpect(jsonPath("$.deliveryCharge").value(15.0))
                .andExpect(jsonPath("$.freeDeliveryAbove").doesNotExist());
    }

    @Test
    void validationRules() throws Exception {
        String admin = adminToken();

        ObjectNode noPayment = json.valueToTree(defaultSettings(false, false, null, null, true));
        JsonNode error = body(call(HttpMethod.PUT, "/api/v1/admin/settings", admin, noPayment)
                .andExpect(status().isBadRequest()));
        assertThat(error.get("code").asText()).isEqualTo("VALIDATION_ERROR");
        assertThat(error.at("/details/codEnabled").asText()).contains("at least one");

        ObjectNode onlineWithoutKey = json.valueToTree(defaultSettings(true, true, null, null, true));
        JsonNode error2 = body(call(HttpMethod.PUT, "/api/v1/admin/settings", admin, onlineWithoutKey)
                .andExpect(status().isBadRequest()));
        // The secret may already be stored by another test (blank keeps it), so only the key id is certain
        assertThat(error2.get("details").has("gatewayKeyId")).isTrue();

        ObjectNode radius = json.valueToTree(defaultSettings(true, false, null, null, true));
        radius.put("maxDeliveryRadiusKm", 25);
        call(HttpMethod.PUT, "/api/v1/admin/settings", admin, radius).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.maxDeliveryRadiusKm").exists());
        radius.put("maxDeliveryRadiusKm", 0.4);
        call(HttpMethod.PUT, "/api/v1/admin/settings", admin, radius).andExpect(status().isBadRequest());
    }

    @Test
    void settingsAreAdminOnly() throws Exception {
        get("/api/v1/admin/settings", null).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        get("/api/v1/admin/settings", staffToken()).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        // Staff can still use the rest of the admin API
        get("/api/v1/admin/dashboard", staffToken()).andExpect(status().isOk());
    }
}
