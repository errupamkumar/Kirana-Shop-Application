package com.kirana.catalog;

import com.kirana.common.Money;
import java.math.BigDecimal;
import java.util.List;

/** Customer-facing catalog responses. Raw stock numbers are never exposed, only {@code inStock}. */
public final class CatalogDtos {

    private CatalogDtos() {
    }

    public record CategoryDto(Long id, String name, String slug, String imageUrl) {
        static CategoryDto from(Category c) {
            return new CategoryDto(c.getId(), c.getName(), c.getSlug(), c.getImageUrl());
        }
    }

    public record VariantDto(Long id, String label, BigDecimal mrp, BigDecimal sellingPrice, int discountPercent,
                             boolean inStock) {
        static VariantDto from(ProductVariant v) {
            return new VariantDto(v.getId(), v.getLabel(), v.getMrp(), v.getSellingPrice(),
                    Money.discountPercent(v.getMrp(), v.getSellingPrice()), v.getStockQty() > 0);
        }
    }

    public record ProductDto(Long id, Long categoryId, String name, String description, String brand,
                             String imageUrl, List<VariantDto> variants) {
        static ProductDto from(Product p) {
            List<VariantDto> variants = p.getVariants().stream()
                    .filter(ProductVariant::isActive)
                    .map(VariantDto::from)
                    .toList();
            return new ProductDto(p.getId(), p.getCategory().getId(), p.getName(), p.getDescription(),
                    p.getBrand(), p.getImageUrl(), variants);
        }
    }

    public record CategorySection(CategoryDto category, List<ProductDto> products) {
    }

    public record CatalogResponse(List<CategoryDto> categories, List<CategorySection> sections) {
    }
}
