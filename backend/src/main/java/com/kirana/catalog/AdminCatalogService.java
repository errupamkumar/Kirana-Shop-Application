package com.kirana.catalog;

import com.kirana.catalog.AdminCatalogDtos.CategoryRequest;
import com.kirana.catalog.AdminCatalogDtos.CategoryResponse;
import com.kirana.catalog.AdminCatalogDtos.DeleteResult;
import com.kirana.catalog.AdminCatalogDtos.ProductRequest;
import com.kirana.catalog.AdminCatalogDtos.ProductResponse;
import com.kirana.catalog.AdminCatalogDtos.VariantPatchRequest;
import com.kirana.catalog.AdminCatalogDtos.VariantRequest;
import com.kirana.catalog.AdminCatalogDtos.VariantResponse;
import com.kirana.common.ApiException;
import com.kirana.common.Money;
import com.kirana.common.PageResponse;
import com.kirana.common.Pages;
import java.text.Normalizer;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class AdminCatalogService {

    private final CategoryRepository categories;
    private final ProductRepository products;
    private final ProductVariantRepository variants;

    // ---- Categories ----

    @Transactional(readOnly = true)
    public List<CategoryResponse> listCategories() {
        Map<Long, Long> counts = products.countByCategory();
        return categories.findAllByOrderBySortOrderAscNameAsc().stream()
                .map(c -> CategoryResponse.from(c, counts.getOrDefault(c.getId(), 0L)))
                .toList();
    }

    public CategoryResponse createCategory(CategoryRequest req) {
        Category c = new Category();
        applyCategory(c, req);
        return CategoryResponse.from(categories.save(c), 0);
    }

    public CategoryResponse updateCategory(Long id, CategoryRequest req) {
        Category c = category(id);
        applyCategory(c, req);
        return CategoryResponse.from(c, products.countByCategory().getOrDefault(id, 0L));
    }

    /** Hard delete when empty, otherwise soft deactivate so existing products keep their category. */
    public DeleteResult deleteCategory(Long id) {
        Category c = category(id);
        if (products.existsByCategoryId(id)) {
            c.setActive(false);
            return new DeleteResult(false, true);
        }
        categories.delete(c);
        return new DeleteResult(true, false);
    }

    private void applyCategory(Category c, CategoryRequest req) {
        String slug = req.slug() == null || req.slug().isBlank() ? slugify(req.name()) : req.slug();
        boolean taken = c.getId() == null ? categories.existsBySlug(slug) : categories.existsBySlugAndIdNot(slug, c.getId());
        if (taken) {
            throw ApiException.validation("slug", "is already used by another category");
        }
        c.setName(req.name().trim());
        c.setSlug(slug);
        c.setImageUrl(blankToNull(req.imageUrl()));
        c.setSortOrder(req.sortOrder());
        c.setActive(req.active());
    }

    // ---- Products ----

    @Transactional(readOnly = true)
    public PageResponse<ProductResponse> listProducts(String q, Long categoryId, Boolean active, Integer page, Integer size) {
        Specification<Product> spec = Specification.allOf(ProductSpecs.matching(q), ProductSpecs.inCategory(categoryId),
                ProductSpecs.active(active));
        return PageResponse.from(products.findAll(spec, Pages.of(page, size, Sort.by("name").and(Sort.by("id")))),
                ProductResponse::from);
    }

    @Transactional(readOnly = true)
    public ProductResponse getProduct(Long id) {
        return ProductResponse.from(product(id));
    }

    public ProductResponse createProduct(ProductRequest req) {
        Product p = new Product();
        applyProduct(p, req);
        return ProductResponse.from(products.saveAndFlush(p));
    }

    public ProductResponse updateProduct(Long id, ProductRequest req) {
        Product p = product(id);
        applyProduct(p, req);
        return ProductResponse.from(products.saveAndFlush(p));
    }

    public ProductResponse setProductActive(Long id, boolean active) {
        Product p = product(id);
        p.setActive(active);
        return ProductResponse.from(p);
    }

    public VariantResponse patchVariant(Long id, VariantPatchRequest req) {
        ProductVariant v = variants.findById(id).orElseThrow(() -> ApiException.notFound("Variant"));
        if (req.stockQty() != null) {
            v.setStockQty(req.stockQty());
        }
        if (req.mrp() != null) {
            v.setMrp(Money.scale(req.mrp()));
        }
        if (req.sellingPrice() != null) {
            v.setSellingPrice(Money.scale(req.sellingPrice()));
        }
        if (v.getSellingPrice().compareTo(v.getMrp()) > 0) {
            throw ApiException.validation("sellingPrice", "selling price must not exceed MRP");
        }
        if (req.active() != null) {
            v.setActive(req.active());
        }
        return VariantResponse.from(variants.saveAndFlush(v));
    }

    /**
     * Applies the product fields and reconciles nested variants: entries with an id update that variant,
     * entries without one are created, and variants missing from the request are removed (order lines keep
     * their snapshot; the FK is ON DELETE SET NULL).
     */
    private void applyProduct(Product p, ProductRequest req) {
        p.setCategory(category(req.categoryId()));
        p.setName(req.name().trim());
        p.setDescription(blankToNull(req.description()));
        p.setBrand(blankToNull(req.brand()));
        p.setImageUrl(blankToNull(req.imageUrl()));
        p.setActive(req.active());

        Set<String> skus = new HashSet<>();
        for (VariantRequest vr : req.variants()) {
            if (!skus.add(vr.sku().trim().toUpperCase(Locale.ROOT))) {
                throw ApiException.validation("variants", "SKU " + vr.sku() + " is repeated");
            }
        }

        Map<Long, ProductVariant> existing = p.getVariants().stream()
                .collect(Collectors.toMap(ProductVariant::getId, Function.identity()));
        Set<Long> keep = req.variants().stream().map(VariantRequest::id).filter(Objects::nonNull)
                .collect(Collectors.toSet());
        for (Long requested : keep) {
            if (!existing.containsKey(requested)) {
                throw ApiException.validation("variants", "variant " + requested + " does not belong to this product");
            }
        }
        if (p.getVariants().removeIf(v -> !keep.contains(v.getId())) && p.getId() != null) {
            // Delete removed variants first so their SKUs can be reused in this same request
            products.flush();
        }

        int index = 0;
        for (VariantRequest vr : req.variants()) {
            ProductVariant v = vr.id() == null ? new ProductVariant() : existing.get(vr.id());
            String sku = vr.sku().trim();
            boolean taken = v.getId() == null ? variants.existsBySku(sku) : variants.existsBySkuAndIdNot(sku, v.getId());
            if (taken) {
                throw ApiException.validation("variants", "SKU " + sku + " is already used by another product");
            }
            v.setLabel(vr.label().trim());
            v.setSku(sku);
            v.setMrp(Money.scale(vr.mrp()));
            v.setSellingPrice(Money.scale(vr.sellingPrice()));
            if (vr.id() != null && vr.stockQtyLoaded() != null) {
                // Apply the admin's change as a delta: orders placed while the form was open stay deducted
                v.setStockQty(Math.max(0, v.getStockQty() + vr.stockQty() - vr.stockQtyLoaded()));
            } else {
                v.setStockQty(vr.stockQty());
            }
            v.setActive(vr.active());
            v.setSortOrder(vr.sortOrder() == null ? index : vr.sortOrder());
            if (vr.id() == null) {
                p.addVariant(v);
            }
            index++;
        }
    }

    private Category category(Long id) {
        return categories.findById(id).orElseThrow(() -> ApiException.notFound("Category"));
    }

    private Product product(Long id) {
        return products.findById(id).orElseThrow(() -> ApiException.notFound("Product"));
    }

    static String slugify(String name) {
        String ascii = Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        String slug = ascii.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return slug.isEmpty() ? "category" : slug;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
