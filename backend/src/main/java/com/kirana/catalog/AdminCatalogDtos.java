package com.kirana.catalog;

import com.kirana.common.Money;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Admin catalog requests and responses. */
public final class AdminCatalogDtos {

    private AdminCatalogDtos() {
    }

    public record CategoryRequest(
            @NotBlank @Size(max = 80) String name,
            @Size(max = 80) String nameHi,
            @Size(max = 90) @Pattern(regexp = "^$|^[a-z0-9]+(-[a-z0-9]+)*$", message = "must be lowercase words separated by -")
            String slug,
            @Size(max = 500) String imageUrl,
            @NotNull @Min(0) Integer sortOrder,
            @NotNull Boolean active) {
    }

    public record CategoryResponse(Long id, String name, String nameHi, String slug, String imageUrl, int sortOrder, boolean active,
                                   long productCount) {
        static CategoryResponse from(Category c, long productCount) {
            return new CategoryResponse(c.getId(), c.getName(), c.getNameHi(), c.getSlug(), c.getImageUrl(), c.getSortOrder(),
                    c.isActive(), productCount);
        }
    }

    public record DeleteResult(boolean deleted, boolean deactivated) {
    }

    public record VariantRequest(
            Long id,
            @NotBlank @Size(max = 40) String label,
            @NotBlank @Size(max = 60) @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "may contain letters, digits, . _ -")
            String sku,
            @NotNull @DecimalMin("0.01") @Digits(integer = 8, fraction = 2) BigDecimal mrp,
            @NotNull @DecimalMin("0") @Digits(integer = 8, fraction = 2) BigDecimal sellingPrice,
            @NotNull @Min(0) Integer stockQty,
            @NotNull Boolean active,
            @Min(0) Integer sortOrder,
            /** Stock the form loaded; when set, only the difference is applied so concurrent orders are kept. */
            @Min(0) Integer stockQtyLoaded) {

        @AssertTrue(message = "selling price must not exceed MRP")
        public boolean isSellingPriceValid() {
            return mrp == null || sellingPrice == null || sellingPrice.compareTo(mrp) <= 0;
        }
    }

    public record ProductRequest(
            @NotNull Long categoryId,
            @NotBlank @Size(max = 160) String name,
            @Size(max = 160) String nameHi,
            @Size(max = 2000) String description,
            @Size(max = 80) String brand,
            @Size(max = 500) String imageUrl,
            @NotNull Boolean active,
            @NotEmpty @Size(max = 20) List<@Valid VariantRequest> variants) {
    }

    public record ActiveRequest(@NotNull Boolean active) {
    }

    /** Partial update of a variant from the products table (inline stock edit, quick switches). */
    public record VariantPatchRequest(
            @Min(0) Integer stockQty,
            @DecimalMin("0.01") @Digits(integer = 8, fraction = 2) BigDecimal mrp,
            @DecimalMin("0") @Digits(integer = 8, fraction = 2) BigDecimal sellingPrice,
            Boolean active) {
    }

    public record VariantResponse(Long id, String label, String sku, BigDecimal mrp, BigDecimal sellingPrice,
                                  int discountPercent, int stockQty, boolean active, int sortOrder) {
        static VariantResponse from(ProductVariant v) {
            return new VariantResponse(v.getId(), v.getLabel(), v.getSku(), v.getMrp(), v.getSellingPrice(),
                    Money.discountPercent(v.getMrp(), v.getSellingPrice()), v.getStockQty(), v.isActive(),
                    v.getSortOrder());
        }
    }

    public record ProductResponse(Long id, Long categoryId, String categoryName, String name, String nameHi, String description,
                                  String brand, String imageUrl, boolean active, List<VariantResponse> variants,
                                  Instant createdAt, Instant updatedAt) {
        static ProductResponse from(Product p) {
            return new ProductResponse(p.getId(), p.getCategory().getId(), p.getCategory().getName(), p.getName(), p.getNameHi(),
                    p.getDescription(), p.getBrand(), p.getImageUrl(), p.isActive(),
                    p.getVariants().stream().map(VariantResponse::from).toList(), p.getCreatedAt(), p.getUpdatedAt());
        }
    }
}
