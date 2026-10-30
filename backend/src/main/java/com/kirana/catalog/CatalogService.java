package com.kirana.catalog;

import com.kirana.catalog.CatalogDtos.CatalogResponse;
import com.kirana.catalog.CatalogDtos.CategoryDto;
import com.kirana.catalog.CatalogDtos.CategorySection;
import com.kirana.catalog.CatalogDtos.ProductDto;
import com.kirana.common.ApiException;
import com.kirana.common.PageResponse;
import com.kirana.common.Pages;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read-only catalog for the customer app. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CatalogService {

    static final int PRODUCTS_PER_SECTION = 8;
    private static final Sort BY_NAME = Sort.by("name").ascending().and(Sort.by("id"));

    private final CategoryRepository categories;
    private final ProductRepository products;

    public CatalogResponse catalog() {
        List<Category> active = categories.findAllByActiveTrueOrderBySortOrderAscNameAsc();
        List<CategorySection> sections = active.stream()
                .map(c -> new CategorySection(CategoryDto.from(c), products
                        .findAll(listedIn(c.getId(), null), PageRequest.of(0, PRODUCTS_PER_SECTION, BY_NAME))
                        .map(ProductDto::from).getContent()))
                .filter(section -> !section.products().isEmpty())
                .toList();
        return new CatalogResponse(active.stream().map(CategoryDto::from).toList(), sections);
    }

    public PageResponse<ProductDto> products(Long categoryId, String q, Integer page, Integer size) {
        return PageResponse.from(products.findAll(listedIn(categoryId, q), Pages.of(page, size, BY_NAME)),
                ProductDto::from);
    }

    public ProductDto product(Long id) {
        return products.findOne(ProductSpecs.listed().and((root, query, cb) -> cb.equal(root.get("id"), id)))
                .map(ProductDto::from)
                .orElseThrow(() -> ApiException.notFound("Product"));
    }

    private static Specification<Product> listedIn(Long categoryId, String q) {
        return Specification.allOf(ProductSpecs.listed(), ProductSpecs.inCategory(categoryId), ProductSpecs.matching(q));
    }
}
