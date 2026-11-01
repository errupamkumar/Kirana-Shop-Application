package com.kirana.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.kirana.IntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockMultipartFile;

class CatalogIntegrationTest extends IntegrationTest {

    @Test
    void publicCatalogListsSeededData() throws Exception {
        JsonNode catalogBody = body(get("/api/v1/app/catalog", null).andExpect(status().isOk()));
        assertThat(catalogBody.get("categories").size()).isGreaterThanOrEqualTo(8);
        assertThat(catalogBody.get("sections").get(0).get("products").size()).isPositive();

        get("/api/v1/app/products?q=basmati", null).andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].name").value("Basmati Rice"))
                .andExpect(jsonPath("$.content[0].variants[0].inStock").value(true))
                .andExpect(jsonPath("$.content[0].variants[0].stockQty").doesNotExist());

        // Seeded shampoo has 0 stock: listed but not in stock
        get("/api/v1/app/products?q=shampoo", null)
                .andExpect(jsonPath("$.content[0].variants[0].inStock").value(false));
    }

    @Test
    void seededCatalogHasStarterPhotosThatAreServed() throws Exception {
        JsonNode catalogBody = body(get("/api/v1/app/catalog", null).andExpect(status().isOk()));
        String categoryImage = catalogBody.at("/categories/0/imageUrl").asText();
        assertThat(categoryImage).startsWith("/media/images/seed/").endsWith(".jpg");
        get(categoryImage, null).andExpect(status().isOk());

        String productImage = body(get("/api/v1/app/products?q=basmati", null)).at("/content/0/imageUrl").asText();
        assertThat(productImage).isEqualTo("/media/images/seed/p13-basmati.jpg");
        get(productImage, null).andExpect(status().isOk());
    }

    @Test
    void hindiNamesAreReturnedAndSearchable() throws Exception {
        JsonNode catalogBody = body(get("/api/v1/app/catalog", null).andExpect(status().isOk()));
        assertThat(catalogBody.at("/categories/2/nameHi").asText()).isEqualTo("आटा, चावल और दाल");

        // Hindi search finds the same product as the English one
        JsonNode hindi = body(get("/api/v1/app/products?q=बासमती", null));
        assertThat(hindi.at("/content/0/name").asText()).isEqualTo("Basmati Rice");
        assertThat(hindi.at("/content/0/nameHi").asText()).isEqualTo("बासमती चावल");

        // Admin can set and clear the Hindi name
        String admin = adminToken();
        String suffix = uniqueSuffix();
        JsonNode created = body(postJson("/api/v1/admin/categories", admin,
                Map.of("name", "Pooja Items " + suffix, "nameHi", "पूजा सामग्री", "sortOrder", 30, "active", true))
                .andExpect(status().isCreated()));
        assertThat(created.get("nameHi").asText()).isEqualTo("पूजा सामग्री");
    }

    @Test
    void categoryCrudAndSoftDelete() throws Exception {
        String admin = adminToken();
        String suffix = uniqueSuffix();
        JsonNode created = body(postJson("/api/v1/admin/categories", admin,
                Map.of("name", "Frozen Foods " + suffix, "sortOrder", 20, "active", true))
                .andExpect(status().isCreated()));
        long id = created.get("id").asLong();
        assertThat(created.get("slug").asText()).isEqualTo("frozen-foods-" + suffix);

        call(HttpMethod.PUT, "/api/v1/admin/categories/" + id, admin,
                Map.of("name", "Frozen " + suffix, "slug", "frozen-" + suffix, "sortOrder", 21, "active", true))
                .andExpect(status().isOk()).andExpect(jsonPath("$.slug").value("frozen-" + suffix));

        // Duplicate slug is rejected
        postJson("/api/v1/admin/categories", admin, Map.of("name", "X", "slug", "frozen-" + suffix, "sortOrder", 1, "active", true))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.details.slug").exists());

        // Empty category is deleted
        call(HttpMethod.DELETE, "/api/v1/admin/categories/" + id, admin, null)
                .andExpect(status().isOk()).andExpect(jsonPath("$.deleted").value(true));

        // Category with products is deactivated, and its products disappear from the app
        long withProducts = createCategory("Bakery " + uniqueSuffix());
        JsonNode product = body(postJson("/api/v1/admin/products", admin, productBody(withProducts, "Rusk " + suffix,
                "RUSK-" + suffix, 40, 35, 10)).andExpect(status().isCreated()));
        get("/api/v1/app/products?categoryId=" + withProducts, null).andExpect(jsonPath("$.totalElements").value(1));
        call(HttpMethod.DELETE, "/api/v1/admin/categories/" + withProducts, admin, null)
                .andExpect(jsonPath("$.deleted").value(false)).andExpect(jsonPath("$.deactivated").value(true));
        get("/api/v1/app/products?categoryId=" + withProducts, null).andExpect(jsonPath("$.totalElements").value(0));
        get("/api/v1/app/products/" + product.get("id").asLong(), null).andExpect(status().isNotFound());
    }

    @Test
    void productCrudWithNestedVariants() throws Exception {
        String admin = adminToken();
        long categoryId = createCategory("Dry Fruits " + uniqueSuffix());
        String suffix = uniqueSuffix();

        JsonNode created = body(postJson("/api/v1/admin/products", admin, Map.of(
                "categoryId", categoryId, "name", "Cashew " + suffix, "brand", "Happilo", "active", true,
                "variants", List.of(
                        variant(null, "250 g", "CASHEW-250-" + suffix, 300, 260, 10),
                        variant(null, "500 g", "CASHEW-500-" + suffix, 590, 499, 5))))
                .andExpect(status().isCreated()));
        long productId = created.get("id").asLong();
        long small = created.at("/variants/0/id").asLong();
        assertThat(created.get("variants").size()).isEqualTo(2);
        assertThat(created.at("/variants/0/discountPercent").asInt()).isEqualTo(13);

        // Update: keep and edit the 250 g, drop the 500 g, add a 1 kg
        JsonNode updated = body(call(HttpMethod.PUT, "/api/v1/admin/products/" + productId, admin, Map.of(
                "categoryId", categoryId, "name", "Cashew W320 " + suffix, "active", true,
                "variants", List.of(
                        variant(small, "250 g", "CASHEW-250-" + suffix, 310, 270, 8),
                        variant(null, "1 kg", "CASHEW-1KG-" + suffix, 1150, 999, 3))))
                .andExpect(status().isOk()));
        assertThat(updated.get("name").asText()).isEqualTo("Cashew W320 " + suffix);
        assertThat(updated.get("variants").size()).isEqualTo(2);
        assertThat(updated.at("/variants/0/id").asLong()).isEqualTo(small);
        assertThat(updated.at("/variants/0/sellingPrice").decimalValue()).isEqualByComparingTo("270");
        assertThat(updated.at("/variants/1/label").asText()).isEqualTo("1 kg");

        // Selling price above MRP is rejected
        postJson("/api/v1/admin/products", admin, productBody(categoryId, "Bad " + suffix, "BAD-" + suffix, 100, 120, 1))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        // SKU used by another product is rejected
        postJson("/api/v1/admin/products", admin, productBody(categoryId, "Dup " + suffix, "CASHEW-1KG-" + suffix, 100, 90, 1))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.details.variants").exists());

        // Inline variant patch and active toggle
        call(HttpMethod.PATCH, "/api/v1/admin/variants/" + small, admin, Map.of("stockQty", 0))
                .andExpect(status().isOk()).andExpect(jsonPath("$.stockQty").value(0));
        call(HttpMethod.PATCH, "/api/v1/admin/variants/" + small, admin, Map.of("sellingPrice", 999))
                .andExpect(status().isBadRequest());
        call(HttpMethod.PATCH, "/api/v1/admin/products/" + productId + "/active", admin, Map.of("active", false))
                .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(false));
        get("/api/v1/app/products/" + productId, null).andExpect(status().isNotFound());

        get("/api/v1/admin/products?q=" + "W320 " + suffix, admin).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].variants[0].stockQty").value(0));
    }

    @Test
    void catalogWritesNeedStaff() throws Exception {
        postJson("/api/v1/admin/categories", null, Map.of("name", "X", "sortOrder", 1, "active", true))
                .andExpect(status().isUnauthorized());
        postJson("/api/v1/admin/categories", newCustomer().token(), Map.of("name", "X", "sortOrder", 1, "active", true))
                .andExpect(status().isForbidden());
    }

    @Test
    void imageUploadChecksTypeBySignature() throws Exception {
        String admin = adminToken();
        byte[] png = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};
        String url = body(mvc.perform(multipart("/api/v1/admin/uploads/image")
                .file(new MockMultipartFile("file", "a.png", "image/png", png))
                .header("Authorization", "Bearer " + admin))
                .andExpect(status().isCreated())).get("url").asText();
        assertThat(url).startsWith("/media/images/").endsWith(".png");
        get(url, null).andExpect(status().isOk());

        // A text file renamed to .jpg is rejected
        mvc.perform(multipart("/api/v1/admin/uploads/image")
                        .file(new MockMultipartFile("file", "evil.jpg", "image/jpeg", "<script>".getBytes()))
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.details.file").exists());
    }

    private static Map<String, Object> productBody(long categoryId, String name, String sku, int mrp, int price, int stock) {
        return Map.of("categoryId", categoryId, "name", name, "active", true,
                "variants", List.of(variant(null, "1 pc", sku, mrp, price, stock)));
    }

    private static Map<String, Object> variant(Long id, String label, String sku, int mrp, int price, int stock) {
        Map<String, Object> v = new java.util.HashMap<>(Map.of("label", label, "sku", sku, "mrp", mrp,
                "sellingPrice", price, "stockQty", stock, "active", true));
        if (id != null) {
            v.put("id", id);
        }
        return v;
    }
}
