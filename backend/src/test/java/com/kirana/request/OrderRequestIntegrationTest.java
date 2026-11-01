package com.kirana.request;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.kirana.IntegrationTest;
import com.kirana.catalog.ProductVariantRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;

class OrderRequestIntegrationTest extends IntegrationTest {

    /** Smallest byte patterns the server recognises: JPEG and MP4/M4A magic numbers. */
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0x10, 'J', 'F', 'I', 'F', 0};
    private static final byte[] M4A = {0, 0, 0, 0x20, 'f', 't', 'y', 'p', 'M', '4', 'A', ' ', 0, 0};

    @Autowired
    private ProductVariantRepository variants;

    private int stockOf(long variantId) {
        return variants.findById(variantId).orElseThrow().getStockQty();
    }

    private ResultActions send(Customer c, Long addressId, byte[] image, byte[] audio, String note) throws Exception {
        MockMultipartHttpServletRequestBuilder req = multipart("/api/v1/app/order-requests");
        req.header("Authorization", "Bearer " + c.token());
        if (image != null) {
            req.file(new MockMultipartFile("image", "list.jpg", "image/jpeg", image));
        }
        if (audio != null) {
            req.file(new MockMultipartFile("audio", "voice.m4a", "audio/mp4", audio));
            req.param("audioSeconds", "12");
        }
        if (addressId != null) {
            req.param("addressId", String.valueOf(addressId));
        }
        if (note != null) {
            req.param("note", note);
        }
        return mvc.perform(req);
    }

    @Test
    void photoAndVoiceRequestBecomesAnAcceptedOrder() throws Exception {
        Customer c = newCustomer();
        long address = createAddress(c, NEAR_LAT, NEAR_LNG);
        long variant = variantId(createProduct("100.00", "120.00", 10));

        JsonNode request = body(send(c, address, JPEG, M4A, "Please send fresh atta").andExpect(status().isCreated()));
        long id = request.get("id").asLong();
        assertThat(request.get("status").asText()).isEqualTo("PENDING");
        assertThat(request.get("audioSeconds").asInt()).isEqualTo(12);
        assertThat(request.at("/address/line1").asText()).isNotBlank();

        // Media is private: signed link works, tampering or the public media path does not
        String imageUrl = request.get("imageUrl").asText();
        assertThat(imageUrl).startsWith("/api/v1/media/private/").contains("sig=");
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(imageUrl))
                .andExpect(status().isOk()).andExpect(content().contentType("image/jpeg"));
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(request.get("audioUrl").asText()))
                .andExpect(status().isOk()).andExpect(content().contentType("audio/mp4"));
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(imageUrl.replace("sig=", "sig=x")))
                .andExpect(status().isNotFound());
        String fileName = imageUrl.substring("/api/v1/media/private/".length(), imageUrl.indexOf('?'));
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/media/requests/" + fileName))
                .andExpect(status().isNotFound());

        // The store sees it waiting
        String admin = adminToken();
        get("/api/v1/admin/order-requests?status=PENDING", admin).andExpect(status().isOk());
        assertThat(body(get("/api/v1/admin/order-requests/counts", admin)).get("pending").asLong()).isPositive();
        assertThat(body(get("/api/v1/admin/dashboard", admin)).get("pendingRequests").asLong()).isPositive();
        JsonNode seen = body(get("/api/v1/admin/order-requests/" + id, admin).andExpect(status().isOk()));
        assertThat(seen.get("customerPhone").asText()).isEqualTo(c.phone());

        // Accept with a catalog item and something that is not in the catalog
        JsonNode accepted = body(postJson("/api/v1/admin/order-requests/" + id + "/accept", admin, Map.of(
                "items", List.of(Map.of("variantId", variant, "qty", 2)),
                "customItems", List.of(Map.of("name", "Lux soap", "label", "100 g", "price", "35", "qty", 2)),
                "note", "Packed fresh atta as asked"))
                .andExpect(status().isOk()));
        assertThat(accepted.get("status").asText()).isEqualTo("ACCEPTED");
        assertThat(accepted.get("orderStatus").asText()).isEqualTo("ACCEPTED");
        // 2 x 100 + 2 x 35 = 270, below the free-delivery threshold, so the delivery charge applies
        assertThat(accepted.get("orderTotal").decimalValue()).isEqualByComparingTo(new BigDecimal("300.00"));
        assertThat(stockOf(variant)).isEqualTo(8);
        long orderId = accepted.get("orderId").asLong();

        // The customer gets the order, linked back to the request
        JsonNode order = body(get("/api/v1/app/orders/" + orderId, c.token()).andExpect(status().isOk()));
        assertThat(order.get("status").asText()).isEqualTo("ACCEPTED");
        assertThat(order.get("requestId").asLong()).isEqualTo(id);
        assertThat(order.get("items").size()).isEqualTo(2);
        assertThat(order.at("/history/0/toStatus").asText()).isEqualTo("PLACED");
        assertThat(order.at("/history/1/toStatus").asText()).isEqualTo("ACCEPTED");
        assertThat(order.get("customerNote").asText()).isEqualTo("Please send fresh atta");
        assertThat(order.get("canCancel").asBoolean()).isTrue();
        JsonNode mine = body(get("/api/v1/app/order-requests/" + id, c.token()));
        assertThat(mine.get("orderNumber").asText()).isEqualTo(order.get("orderNumber").asText());

        // Handled once only
        postJson("/api/v1/admin/order-requests/" + id + "/accept", admin,
                Map.of("items", List.of(Map.of("variantId", variant, "qty", 1))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INVALID_STATUS_TRANSITION"));

        // The store then packs and dispatches as usual; a customer cancel before packing returns the stock
        postJson("/api/v1/app/orders/" + orderId + "/cancel", c.token(), null).andExpect(status().isOk());
        assertThat(stockOf(variant)).isEqualTo(10);
    }

    @Test
    void rejectAndCancelAndLimits() throws Exception {
        Customer c = newCustomer();
        long address = createAddress(c, NEAR_LAT, NEAR_LNG);
        String admin = adminToken();

        // Needs a photo or a voice note, an address, and an address inside the delivery area
        send(c, address, null, null, "just text").andExpect(status().isBadRequest());
        send(c, null, JPEG, null, null).andExpect(status().isBadRequest());
        send(c, address, "not an image".getBytes(), null, null).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        long far = createAddress(c, FAR_LAT, FAR_LNG);
        send(c, far, JPEG, null, null).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("OUT_OF_RADIUS"));

        long voiceOnly = body(send(c, address, null, M4A, null).andExpect(status().isCreated())).get("id").asLong();
        JsonNode rejected = body(postJson("/api/v1/admin/order-requests/" + voiceOnly + "/reject", admin,
                Map.of("reason", "Could not hear the recording, please send again")).andExpect(status().isOk()));
        assertThat(rejected.get("status").asText()).isEqualTo("REJECTED");
        assertThat(body(get("/api/v1/app/order-requests/" + voiceOnly, c.token())).get("rejectReason").asText())
                .startsWith("Could not hear");
        postJson("/api/v1/admin/order-requests/" + voiceOnly + "/reject", admin, Map.of()).andExpect(status().isBadRequest());

        long photo = body(send(c, address, JPEG, null, null)).get("id").asLong();
        assertThat(body(postJson("/api/v1/app/order-requests/" + photo + "/cancel", c.token(), null)
                .andExpect(status().isOk())).get("status").asText()).isEqualTo("CANCELLED");
        postJson("/api/v1/admin/order-requests/" + photo + "/accept", admin,
                Map.of("customItems", List.of(Map.of("name", "Sugar", "price", "45", "qty", 1))))
                .andExpect(status().isConflict());

        // Other customers can't see it
        Customer other = newCustomer();
        get("/api/v1/app/order-requests/" + photo, other.token()).andExpect(status().isNotFound());
        assertThat(body(get("/api/v1/app/order-requests/my", c.token())).get("totalElements").asLong()).isEqualTo(2);

        // At most 3 waiting requests per customer
        for (int i = 0; i < 3; i++) {
            send(c, address, JPEG, null, null).andExpect(status().isCreated());
        }
        send(c, address, JPEG, null, null).andExpect(status().isTooManyRequests());

        // Accepting needs at least one item
        long waiting = body(get("/api/v1/app/order-requests/my", c.token())).at("/content/0/id").asLong();
        postJson("/api/v1/admin/order-requests/" + waiting + "/accept", admin, Map.of()).andExpect(status().isBadRequest());
    }
}
