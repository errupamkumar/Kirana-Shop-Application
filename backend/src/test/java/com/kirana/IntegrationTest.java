package com.kirana;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kirana.auth.AdminRole;
import com.kirana.auth.AdminUser;
import com.kirana.auth.AdminUserRepository;
import com.kirana.catalog.AdminCatalogDtos.CategoryRequest;
import com.kirana.catalog.AdminCatalogDtos.ProductRequest;
import com.kirana.catalog.AdminCatalogDtos.ProductResponse;
import com.kirana.catalog.AdminCatalogDtos.VariantRequest;
import com.kirana.catalog.AdminCatalogService;
import com.kirana.settings.StoreSettingsService;
import com.kirana.settings.UpdateSettingsRequest;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Base for HTTP-level integration tests. All subclasses share one Spring context and one MySQL container,
 * so tests create their own data (unique phones, SKUs) and reset any settings they change.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import({TestcontainersConfiguration.class, TestBeans.class})
public abstract class IntegrationTest {

    protected static final String ADMIN_EMAIL = "admin@test.local";
    protected static final String ADMIN_PASSWORD = "test-admin-pass";
    protected static final String STAFF_EMAIL = "staff@test.local";

    /** Store is seeded at 12.971599, 77.594566 with a 5 km radius. */
    protected static final double NEAR_LAT = 12.975;
    protected static final double NEAR_LNG = 77.600;
    protected static final double FAR_LAT = 13.100;
    protected static final double FAR_LNG = 77.594566;

    private static final AtomicInteger SEQ = new AtomicInteger();

    @Autowired
    protected MockMvc mvc;
    @Autowired
    protected ObjectMapper json;
    @Autowired
    protected TestBeans.MutableClock clock;
    @Autowired
    protected TestBeans.CapturingOtpSender otpSender;
    @Autowired
    protected AdminCatalogService catalog;
    @Autowired
    protected StoreSettingsService settings;
    @Autowired
    protected AdminUserRepository adminUsers;
    @Autowired
    protected PasswordEncoder passwordEncoder;

    @AfterEach
    void resetClock() {
        clock.reset();
    }

    // ---- HTTP helpers ----

    protected ResultActions call(HttpMethod method, String url, String token, Object body) throws Exception {
        MockHttpServletRequestBuilder req = request(method, url).contentType(MediaType.APPLICATION_JSON);
        if (token != null) {
            req.header("Authorization", "Bearer " + token);
        }
        if (body != null) {
            req.content(body instanceof String s ? s : json.writeValueAsString(body));
        }
        return mvc.perform(req);
    }

    protected ResultActions get(String url, String token) throws Exception {
        return call(HttpMethod.GET, url, token, null);
    }

    protected ResultActions postJson(String url, String token, Object body) throws Exception {
        return call(HttpMethod.POST, url, token, body);
    }

    protected JsonNode body(ResultActions result) throws Exception {
        MvcResult r = result.andReturn();
        String content = r.getResponse().getContentAsString();
        return content.isEmpty() ? json.nullNode() : json.readTree(content);
    }

    // ---- Auth helpers ----

    protected record Customer(long userId, String phone, String token, String refreshToken) {
    }

    /** A unique, valid Indian mobile number (10 digits starting with 8). */
    protected static String newPhone() {
        return String.format("8%09d", 100_000_000 + SEQ.incrementAndGet() * 7 + (int) (System.nanoTime() % 7));
    }

    protected static String uniqueSuffix() {
        return Integer.toString(SEQ.incrementAndGet()) + Long.toString(System.nanoTime() % 100_000);
    }

    protected Customer newCustomer() throws Exception {
        String phone = newPhone();
        postJson("/api/v1/app/auth/otp/send", null, Map.of("phone", phone)).andExpect(status().isOk());
        String code = otpSender.lastCode("+91" + phone);
        JsonNode auth = body(postJson("/api/v1/app/auth/otp/verify", null, Map.of("phone", phone, "otp", code))
                .andExpect(status().isOk()));
        return new Customer(auth.at("/user/id").asLong(), "+91" + phone, auth.get("accessToken").asText(),
                auth.get("refreshToken").asText());
    }

    protected String adminToken() throws Exception {
        return login(ADMIN_EMAIL, ADMIN_PASSWORD);
    }

    protected String staffToken() throws Exception {
        if (adminUsers.findByEmailIgnoreCase(STAFF_EMAIL).isEmpty()) {
            AdminUser staff = new AdminUser();
            staff.setEmail(STAFF_EMAIL);
            staff.setName("Staff");
            staff.setRole(AdminRole.STAFF);
            staff.setPasswordHash(passwordEncoder.encode("staff-pass-123"));
            adminUsers.save(staff);
        }
        return login(STAFF_EMAIL, "staff-pass-123");
    }

    private String login(String email, String password) throws Exception {
        return body(postJson("/api/v1/admin/auth/login", null, Map.of("email", email, "password", password))
                .andExpect(status().isOk())).get("accessToken").asText();
    }

    // ---- Data helpers ----

    protected long createAddress(Customer customer, double lat, double lng) throws Exception {
        Map<String, Object> address = Map.of("label", "Home", "line1", "1 Test Street", "pincode", "560001",
                "lat", lat, "lng", lng);
        return body(postJson("/api/v1/app/addresses", customer.token(), address).andExpect(status().isCreated()))
                .get("id").asLong();
    }

    /** Creates an active product with one variant and returns it. */
    protected ProductResponse createProduct(String price, String mrp, int stock) {
        long categoryId = catalog.listCategories().getFirst().id();
        String suffix = uniqueSuffix();
        return catalog.createProduct(new ProductRequest(categoryId, "Test Product " + suffix, null, null, null, true,
                List.of(new VariantRequest(null, "1 pc", "TEST-" + suffix, new BigDecimal(mrp), new BigDecimal(price),
                        stock, true, 0, null))));
    }

    protected long variantId(ProductResponse product) {
        return product.variants().getFirst().id();
    }

    protected long createCategory(String name) {
        return catalog.createCategory(new CategoryRequest(name, null, null, 99, true)).id();
    }

    /** Restores the seeded store rules. */
    protected void resetSettings() {
        settings.update(defaultSettings(true, false, null, null, true), "test");
    }

    protected static UpdateSettingsRequest defaultSettings(boolean cod, boolean online, String keyId, String secret,
                                                           boolean open) {
        return new UpdateSettingsRequest("Sharma Kirana Store", "+919876543210",
                "12, MG Road, Shivaji Nagar, Bengaluru 560001", null, new BigDecimal("12.971599"),
                new BigDecimal("77.594566"), new BigDecimal("5.00"), new BigDecimal("500.00"), new BigDecimal("30.00"),
                new BigDecimal("1000.00"), cod, online, keyId, secret, open, open ? null : "Closed for Diwali", 5);
    }

    protected ResultActions placeOrder(Customer customer, String idempotencyKey, Map<String, Object> request)
            throws Exception {
        return mvc.perform(post("/api/v1/app/orders")
                .header("Authorization", "Bearer " + customer.token())
                .header("Idempotency-Key", idempotencyKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(request)));
    }

    protected static Map<String, Object> orderRequest(long variantId, int qty, long addressId, String paymentMethod,
                                                      String expectedTotal) {
        return Map.of("items", List.of(Map.of("variantId", variantId, "qty", qty)), "addressId", addressId,
                "paymentMethod", paymentMethod, "expectedTotal", new BigDecimal(expectedTotal));
    }
}
