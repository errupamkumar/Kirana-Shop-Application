package com.kirana.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.kirana.IntegrationTest;
import com.kirana.catalog.AdminCatalogDtos.ProductResponse;
import com.kirana.catalog.AdminCatalogDtos.VariantPatchRequest;
import com.kirana.catalog.ProductVariantRepository;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;

class OrderIntegrationTest extends IntegrationTest {

    @Autowired
    ProductVariantRepository variants;

    @BeforeEach
    @AfterEach
    void reset() {
        resetSettings();
    }

    private int stockOf(long variantId) {
        return variants.findById(variantId).orElseThrow().getStockQty();
    }

    // ---- Cart validation: every violation code ----

    @Test
    void cartQuoteComputesFeesAndThresholds() throws Exception {
        Customer c = newCustomer();
        long address = createAddress(c, NEAR_LAT, NEAR_LNG);
        long variant = variantId(createProduct("320.00", "350.00", 20));

        JsonNode quote = body(postJson("/api/v1/app/cart/validate", c.token(), Map.of(
                "items", List.of(Map.of("variantId", variant, "qty", 1)), "addressId", address, "paymentMethod", "COD"))
                .andExpect(status().isOk()));
        assertThat(quote.get("itemSubtotal").decimalValue()).isEqualByComparingTo("320.00");
        assertThat(quote.get("deliveryFee").decimalValue()).isEqualByComparingTo("30.00");
        assertThat(quote.get("amountToMinOrder").decimalValue()).isEqualByComparingTo("180.00");
        assertThat(quote.get("serviceable").asBoolean()).isTrue();
        assertThat(codes(quote)).containsExactly("BELOW_MIN_ORDER");

        // 4 x 320 = 1280 is above the free-delivery threshold
        JsonNode free = body(postJson("/api/v1/app/cart/validate", c.token(), Map.of(
                "items", List.of(Map.of("variantId", variant, "qty", 4)), "addressId", address, "paymentMethod", "COD")));
        assertThat(free.get("deliveryFee").decimalValue()).isEqualByComparingTo("0.00");
        assertThat(free.get("total").decimalValue()).isEqualByComparingTo("1280.00");
        assertThat(free.get("violations").size()).isZero();
        assertThat(free.get("canPlaceOrder").asBoolean()).isTrue();
    }

    @Test
    void eachViolationCodeIsReported() throws Exception {
        Customer c = newCustomer();
        long near = createAddress(c, NEAR_LAT, NEAR_LNG);
        long far = createAddress(c, FAR_LAT, FAR_LNG);
        long variant = variantId(createProduct("600.00", "650.00", 2));

        assertThat(placeAndGetCode(c, orderRequest(variant, 1, far, "COD", "630.00"))).isEqualTo("OUT_OF_RADIUS");
        assertThat(placeAndGetCode(c, orderRequest(variant, 3, near, "COD", "1800.00"))).isEqualTo("OUT_OF_STOCK");
        assertThat(placeAndGetCode(c, orderRequest(variant, 1, near, "ONLINE", "630.00"))).isEqualTo("PAYMENT_METHOD_DISABLED");

        long cheap = variantId(createProduct("100.00", "100.00", 10));
        assertThat(placeAndGetCode(c, orderRequest(cheap, 1, near, "COD", "130.00"))).isEqualTo("BELOW_MIN_ORDER");

        ProductResponse inactive = createProduct("600.00", "650.00", 10);
        catalog.setProductActive(inactive.id(), false);
        assertThat(placeAndGetCode(c, orderRequest(variantId(inactive), 1, near, "COD", "630.00"))).isEqualTo("VARIANT_INACTIVE");

        settings.update(defaultSettings(true, false, null, null, false), "test");
        JsonNode closed = body(placeOrder(c, key(), orderRequest(variant, 1, near, "COD", "630.00"))
                .andExpect(status().isUnprocessableEntity()));
        assertThat(closed.get("code").asText()).isEqualTo("STORE_CLOSED");
        assertThat(closed.get("message").asText()).isEqualTo("Closed for Diwali");

        // Nothing was decremented by the rejected attempts
        assertThat(stockOf(variant)).isEqualTo(2);
    }

    @Test
    void locationCheckIsPublic() throws Exception {
        postJson("/api/v1/app/location/check", null, Map.of("lat", NEAR_LAT, "lng", NEAR_LNG))
                .andExpect(status().isOk()).andExpect(jsonPath("$.serviceable").value(true))
                .andExpect(jsonPath("$.radiusKm").value(5.0));
        postJson("/api/v1/app/location/check", null, Map.of("lat", FAR_LAT, "lng", FAR_LNG))
                .andExpect(jsonPath("$.serviceable").value(false))
                .andExpect(jsonPath("$.distanceKm").value(org.hamcrest.Matchers.closeTo(14.28, 0.02)));
    }

    // ---- Placement ----

    @Test
    void codOrderIsPlacedWithSnapshotsAndStockDecrement() throws Exception {
        Customer c = newCustomer();
        long address = createAddress(c, NEAR_LAT, NEAR_LNG);
        long variant = variantId(createProduct("600.00", "650.00", 5));

        JsonNode order = body(placeOrder(c, key(), orderRequest(variant, 1, address, "COD", "630.00"))
                .andExpect(status().isCreated()));
        assertThat(order.get("orderNumber").asText()).matches("KS-\\d{8}-\\d{4}");
        assertThat(order.get("status").asText()).isEqualTo("PLACED");
        assertThat(order.get("paymentStatus").asText()).isEqualTo("COD_PENDING");
        assertThat(order.get("total").decimalValue()).isEqualByComparingTo("630.00");
        assertThat(order.at("/address/phone").asText()).isEqualTo(c.phone());
        assertThat(order.at("/history/0/toStatus").asText()).isEqualTo("PLACED");
        assertThat(order.get("canCancel").asBoolean()).isTrue();
        assertThat(stockOf(variant)).isEqualTo(4);

        get("/api/v1/app/orders/my", c.token()).andExpect(jsonPath("$.content[0].id").value(order.get("id").asLong()));
        // Other customers cannot see it
        get("/api/v1/app/orders/" + order.get("id").asLong(), newCustomer().token()).andExpect(status().isNotFound());
    }

    @Test
    void priceChangeIsDetected() throws Exception {
        Customer c = newCustomer();
        long address = createAddress(c, NEAR_LAT, NEAR_LNG);
        long variant = variantId(createProduct("600.00", "650.00", 5));
        JsonNode error = body(placeOrder(c, key(), orderRequest(variant, 1, address, "COD", "600.00"))
                .andExpect(status().isConflict()));
        assertThat(error.get("code").asText()).isEqualTo("PRICE_CHANGED");
        assertThat(error.at("/details/quote/total").decimalValue()).isEqualByComparingTo("630.00");
        assertThat(stockOf(variant)).isEqualTo(5);
    }

    @Test
    void duplicateIdempotencyKeyReturnsTheSameOrder() throws Exception {
        Customer c = newCustomer();
        long address = createAddress(c, NEAR_LAT, NEAR_LNG);
        long variant = variantId(createProduct("600.00", "650.00", 5));
        String key = key();
        Map<String, Object> request = orderRequest(variant, 1, address, "COD", "630.00");

        long first = body(placeOrder(c, key, request).andExpect(status().isCreated())).get("id").asLong();
        long second = body(placeOrder(c, key, request).andExpect(status().isOk())).get("id").asLong();
        assertThat(second).isEqualTo(first);
        assertThat(stockOf(variant)).isEqualTo(4);

        // A failed attempt does not burn the key
        String retryKey = key();
        placeOrder(c, retryKey, orderRequest(variant, 1, address, "COD", "1.00")).andExpect(status().isConflict());
        placeOrder(c, retryKey, request).andExpect(status().isCreated());

        placeOrder(c, "   ", request).andExpect(status().isBadRequest());
    }

    @Test
    void concurrentSubmitsWithTheSameKeyCreateOneOrder() throws Exception {
        Customer c = newCustomer();
        long address = createAddress(c, NEAR_LAT, NEAR_LNG);
        long variant = variantId(createProduct("600.00", "650.00", 5));
        String key = key();
        List<JsonNode> results = runConcurrently(2, () -> body(placeOrder(c, key, orderRequest(variant, 1, address, "COD", "630.00"))));
        assertThat(results.get(0).get("id").asLong()).isEqualTo(results.get(1).get("id").asLong());
        assertThat(stockOf(variant)).isEqualTo(4);
    }

    @Test
    void lastUnitCanOnlyBeSoldOnce() throws Exception {
        long variant = variantId(createProduct("600.00", "650.00", 1));
        Customer a = newCustomer();
        Customer b = newCustomer();
        long addressA = createAddress(a, NEAR_LAT, NEAR_LNG);
        long addressB = createAddress(b, NEAR_LAT, NEAR_LNG);
        List<Customer> buyers = List.of(a, b);
        List<Long> addresses = List.of(addressA, addressB);

        List<Integer> statuses = runConcurrentlyIndexed(2, i -> placeOrder(buyers.get(i), key(),
                orderRequest(variant, 1, addresses.get(i), "COD", "630.00")).andReturn().getResponse().getStatus());
        assertThat(statuses).containsExactlyInAnyOrder(201, 409);
        assertThat(stockOf(variant)).isZero();
    }

    @Test
    void orderSnapshotIsUnchangedByLaterPriceEdits() throws Exception {
        Customer c = newCustomer();
        long address = createAddress(c, NEAR_LAT, NEAR_LNG);
        ProductResponse product = createProduct("600.00", "650.00", 5);
        long variant = variantId(product);
        long orderId = body(placeOrder(c, key(), orderRequest(variant, 1, address, "COD", "630.00"))).get("id").asLong();

        catalog.patchVariant(variant, new VariantPatchRequest(null, new BigDecimal("900.00"), new BigDecimal("850.00"), null));

        JsonNode order = body(get("/api/v1/app/orders/" + orderId, c.token()));
        assertThat(order.at("/items/0/sellingPrice").decimalValue()).isEqualByComparingTo("600.00");
        assertThat(order.at("/items/0/mrp").decimalValue()).isEqualByComparingTo("650.00");
        assertThat(order.at("/items/0/productName").asText()).isEqualTo(product.name());
        assertThat(order.get("total").decimalValue()).isEqualByComparingTo("630.00");
    }

    // ---- Status machine ----

    @Test
    void adminWorkflowToDeliveredCollectsCod() throws Exception {
        String admin = adminToken();
        long orderId = placeSimpleOrder();

        JsonNode detail = body(get("/api/v1/admin/orders/" + orderId, admin));
        assertThat(detail.get("allowedNextStatuses").toString()).isEqualTo("[\"ACCEPTED\",\"CANCELLED\"]");

        // Every order is accepted before it is packed
        setStatus(admin, orderId, "PACKED").andExpect(status().isConflict());
        JsonNode accepted = body(setStatus(admin, orderId, "ACCEPTED").andExpect(status().isOk()));
        assertThat(accepted.get("allowedNextStatuses").toString()).isEqualTo("[\"PACKED\",\"CANCELLED\"]");
        setStatus(admin, orderId, "PACKED").andExpect(status().isOk());
        setStatus(admin, orderId, "OUT_FOR_DELIVERY").andExpect(status().isOk());
        JsonNode delivered = body(setStatus(admin, orderId, "DELIVERED").andExpect(status().isOk()));
        assertThat(delivered.get("paymentStatus").asText()).isEqualTo("COD_COLLECTED");
        assertThat(delivered.get("deliveredAt").isNull()).isFalse();
        assertThat(delivered.get("history").size()).isEqualTo(5);
        assertThat(delivered.get("allowedNextStatuses").size()).isZero();

        // Terminal: nothing else is allowed
        setStatus(admin, orderId, "CANCELLED", "too late").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATUS_TRANSITION"));

        get("/api/v1/admin/orders/" + orderId + "/invoice", admin).andExpect(status().isOk())
                .andExpect(jsonPath("$.store.name").value("Sharma Kirana Store"))
                .andExpect(jsonPath("$.order.id").value(orderId));
    }

    @Test
    void invalidTransitionsAreRejected() throws Exception {
        String admin = adminToken();
        long orderId = placeSimpleOrder();
        setStatus(admin, orderId, "DELIVERED").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATUS_TRANSITION"));
        setStatus(admin, orderId, "OUT_FOR_DELIVERY").andExpect(status().isConflict());
        setStatus(admin, orderId, "PLACED").andExpect(status().isConflict());
        // Admin cancel needs a reason
        setStatus(admin, orderId, "CANCELLED").andExpect(status().isBadRequest());
    }

    @Test
    void cancelRestoresStockAndCustomerCanCancelUntilPacked() throws Exception {
        Customer c = newCustomer();
        long address = createAddress(c, NEAR_LAT, NEAR_LNG);
        long variant = variantId(createProduct("300.00", "300.00", 10));
        long orderId = body(placeOrder(c, key(), orderRequest(variant, 2, address, "COD", "630.00"))
                .andExpect(status().isCreated())).get("id").asLong();
        assertThat(stockOf(variant)).isEqualTo(8);

        JsonNode cancelled = body(postJson("/api/v1/app/orders/" + orderId + "/cancel", c.token(), Map.of("reason", "Ordered by mistake"))
                .andExpect(status().isOk()));
        assertThat(cancelled.get("status").asText()).isEqualTo("CANCELLED");
        assertThat(cancelled.get("cancelReason").asText()).isEqualTo("Ordered by mistake");
        assertThat(stockOf(variant)).isEqualTo(10);

        // Cancelling twice does not restore stock twice
        postJson("/api/v1/app/orders/" + orderId + "/cancel", c.token(), null).andExpect(status().isConflict());
        assertThat(stockOf(variant)).isEqualTo(10);

        // Accepted: the customer can still cancel (nothing is packed yet)
        String admin = adminToken();
        long accepted = body(placeOrder(c, key(), orderRequest(variant, 2, address, "COD", "630.00"))).get("id").asLong();
        assertThat(body(setStatus(admin, accepted, "ACCEPTED")).get("status").asText()).isEqualTo("ACCEPTED");
        assertThat(body(get("/api/v1/app/orders/" + accepted, c.token())).get("canCancel").asBoolean()).isTrue();
        postJson("/api/v1/app/orders/" + accepted + "/cancel", c.token(), null).andExpect(status().isOk());
        assertThat(stockOf(variant)).isEqualTo(10);

        // Once packed, only the store can cancel
        long packed = body(placeOrder(c, key(), orderRequest(variant, 2, address, "COD", "630.00"))).get("id").asLong();
        setStatus(admin, packed, "ACCEPTED").andExpect(status().isOk());
        setStatus(admin, packed, "PACKED").andExpect(status().isOk());
        assertThat(body(get("/api/v1/app/orders/" + packed, c.token())).get("canCancel").asBoolean()).isFalse();
        postJson("/api/v1/app/orders/" + packed + "/cancel", c.token(), null).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATUS_TRANSITION"));
        setStatus(admin, packed, "CANCELLED", "Customer unreachable").andExpect(status().isOk());
        assertThat(stockOf(variant)).isEqualTo(10);
    }

    @Test
    void adminListFiltersAndDashboard() throws Exception {
        String admin = adminToken();
        long orderId = placeSimpleOrder();
        String number = body(get("/api/v1/admin/orders/" + orderId, admin)).get("orderNumber").asText();

        get("/api/v1/admin/orders?q=" + number, admin).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].orderNumber").value(number));
        get("/api/v1/admin/orders?status=PLACED&q=" + number, admin).andExpect(jsonPath("$.totalElements").value(1));
        get("/api/v1/admin/orders?status=DELIVERED&q=" + number, admin).andExpect(jsonPath("$.totalElements").value(0));
        get("/api/v1/admin/orders?from=2000-01-01&to=2000-01-02", admin).andExpect(jsonPath("$.totalElements").value(0));

        JsonNode before = body(get("/api/v1/admin/dashboard", admin));
        setStatus(admin, orderId, "ACCEPTED");
        setStatus(admin, orderId, "PACKED");
        setStatus(admin, orderId, "OUT_FOR_DELIVERY");
        setStatus(admin, orderId, "DELIVERED");
        JsonNode after = body(get("/api/v1/admin/dashboard", admin).andExpect(status().isOk()));
        assertThat(after.get("todayRevenue").decimalValue())
                .isEqualByComparingTo(before.get("todayRevenue").decimalValue().add(new BigDecimal("630.00")));
        assertThat(after.get("todayOrders").asLong()).isGreaterThanOrEqualTo(1);
        assertThat(after.get("last7Days").size()).isEqualTo(7);
        assertThat(after.get("lowStockCount").asLong()).isGreaterThanOrEqualTo(after.get("lowStock").size());
        assertThat(after.at("/countsByStatus/DELIVERED").asLong())
                .isEqualTo(before.at("/countsByStatus/DELIVERED").asLong() + 1);
    }

    @Test
    void productSaveKeepsStockSoldWhileTheFormWasOpen() throws Exception {
        Customer c = newCustomer();
        long address = createAddress(c, NEAR_LAT, NEAR_LNG);
        ProductResponse product = createProduct("300.00", "300.00", 10);
        long variant = variantId(product);
        // The admin opens the edit form (sees 10), then a customer buys 2
        placeOrder(c, key(), orderRequest(variant, 2, address, "COD", "630.00")).andExpect(status().isCreated());
        assertThat(stockOf(variant)).isEqualTo(8);

        String admin = adminToken();
        Map<String, Object> edited = new java.util.HashMap<>(Map.of("id", variant, "label", "1 pc",
                "sku", product.variants().getFirst().sku(), "mrp", 300, "sellingPrice", 300, "stockQty", 10,
                "active", true, "stockQtyLoaded", 10));
        Map<String, Object> body = Map.of("categoryId", product.categoryId(), "name", product.name(), "active", true,
                "variants", List.of(edited));
        // Saving without touching stock keeps the sale deducted
        call(HttpMethod.PUT, "/api/v1/admin/products/" + product.id(), admin, body).andExpect(status().isOk());
        assertThat(stockOf(variant)).isEqualTo(8);
        // Adding 5 in the form adds 5 to the current stock
        edited.put("stockQty", 15);
        call(HttpMethod.PUT, "/api/v1/admin/products/" + product.id(), admin, body).andExpect(status().isOk());
        assertThat(stockOf(variant)).isEqualTo(13);
    }

    @Test
    void repeatedLinesCannotExceedTheItemLimit() throws Exception {
        Customer c = newCustomer();
        long variant = variantId(createProduct("10.00", "10.00", 200));
        postJson("/api/v1/app/cart/validate", c.token(), Map.of("items", List.of(
                Map.of("variantId", variant, "qty", 30), Map.of("variantId", variant, "qty", 30))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.items").exists());
    }

    // ---- Addresses ----

    @Test
    void addressCrudAndDefaults() throws Exception {
        Customer c = newCustomer();
        long first = createAddress(c, NEAR_LAT, NEAR_LNG);
        long second = createAddress(c, NEAR_LAT, NEAR_LNG);
        JsonNode list = body(get("/api/v1/app/addresses", c.token()));
        assertThat(list.get(0).get("id").asLong()).isEqualTo(first);
        assertThat(list.get(0).get("isDefault").asBoolean()).isTrue();

        call(HttpMethod.PUT, "/api/v1/app/addresses/" + second, c.token(), Map.of("label", "Work", "line1", "2 Office Rd",
                "pincode", "560002", "lat", NEAR_LAT, "lng", NEAR_LNG, "isDefault", true)).andExpect(status().isOk());
        list = body(get("/api/v1/app/addresses", c.token()));
        assertThat(list.get(0).get("id").asLong()).isEqualTo(second);
        assertThat(list.get(1).get("isDefault").asBoolean()).isFalse();

        call(HttpMethod.DELETE, "/api/v1/app/addresses/" + second, c.token(), null).andExpect(status().isNoContent());
        list = body(get("/api/v1/app/addresses", c.token()));
        assertThat(list.size()).isEqualTo(1);
        assertThat(list.get(0).get("isDefault").asBoolean()).isTrue();

        // Another customer's address is not found, and invalid PIN codes are rejected
        call(HttpMethod.DELETE, "/api/v1/app/addresses/" + first, newCustomer().token(), null).andExpect(status().isNotFound());
        postJson("/api/v1/app/addresses", c.token(), Map.of("label", "X", "line1", "Y", "pincode", "12", "lat", 1, "lng", 1))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.details.pincode").exists());
    }

    // ---- helpers ----

    private long placeSimpleOrder() throws Exception {
        Customer c = newCustomer();
        long address = createAddress(c, NEAR_LAT, NEAR_LNG);
        long variant = variantId(createProduct("600.00", "650.00", 5));
        return body(placeOrder(c, key(), orderRequest(variant, 1, address, "COD", "630.00"))
                .andExpect(status().isCreated())).get("id").asLong();
    }

    private org.springframework.test.web.servlet.ResultActions setStatus(String admin, long orderId, String status)
            throws Exception {
        return call(HttpMethod.PATCH, "/api/v1/admin/orders/" + orderId + "/status", admin, Map.of("status", status));
    }

    private org.springframework.test.web.servlet.ResultActions setStatus(String admin, long orderId, String status,
                                                                         String note) throws Exception {
        return call(HttpMethod.PATCH, "/api/v1/admin/orders/" + orderId + "/status", admin,
                Map.of("status", status, "note", note));
    }

    private String placeAndGetCode(Customer c, Map<String, Object> request) throws Exception {
        return body(placeOrder(c, key(), request)).get("code").asText();
    }

    private static List<String> codes(JsonNode quote) {
        List<String> codes = new ArrayList<>();
        quote.get("violations").forEach(v -> codes.add(v.get("code").asText()));
        return codes;
    }

    private static String key() {
        return "test-" + uniqueSuffix();
    }

    private static <T> List<T> runConcurrently(int threads, Callable<T> task) throws Exception {
        return runConcurrentlyIndexed(threads, i -> task.call());
    }

    interface IndexedTask<T> {
        T run(int index) throws Exception;
    }

    private static <T> List<T> runConcurrentlyIndexed(int threads, IndexedTask<T> task) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<T>> futures = new ArrayList<>();
            for (int i = 0; i < threads; i++) {
                int index = i;
                futures.add(pool.submit(() -> {
                    start.await();
                    return task.run(index);
                }));
            }
            start.countDown();
            List<T> results = new ArrayList<>();
            for (Future<T> f : futures) {
                results.add(f.get());
            }
            return results;
        } finally {
            pool.shutdownNow();
        }
    }
}
