package com.kirana.catalog;

import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Subquery;
import java.util.Locale;
import org.springframework.data.jpa.domain.Specification;

final class ProductSpecs {

    private ProductSpecs() {
    }

    /** Active product in an active category with at least one active variant. */
    static Specification<Product> listed() {
        return (root, query, cb) -> {
            Join<Product, Category> category = root.join("category");
            Subquery<Long> variants = query.subquery(Long.class);
            var v = variants.from(ProductVariant.class);
            variants.select(v.get("id")).where(cb.equal(v.get("product"), root), cb.isTrue(v.get("active")));
            return cb.and(cb.isTrue(root.get("active")), cb.isTrue(category.get("active")), cb.exists(variants));
        };
    }

    static Specification<Product> inCategory(Long categoryId) {
        return categoryId == null ? null : (root, query, cb) -> cb.equal(root.get("category").get("id"), categoryId);
    }

    static Specification<Product> active(Boolean active) {
        return active == null ? null : (root, query, cb) -> cb.equal(root.get("active"), active);
    }

    /** Case-insensitive match on name or brand. */
    static Specification<Product> matching(String q) {
        if (q == null || q.isBlank()) {
            return null;
        }
        String pattern = "%" + q.trim().toLowerCase(Locale.ROOT).replace("%", "\\%").replace("_", "\\_") + "%";
        return (root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("name")), pattern),
                cb.like(cb.lower(cb.coalesce(root.get("brand"), "")), pattern));
    }
}
