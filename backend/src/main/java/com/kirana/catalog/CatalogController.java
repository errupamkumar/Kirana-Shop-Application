package com.kirana.catalog;

import com.kirana.catalog.CatalogDtos.CatalogResponse;
import com.kirana.catalog.CatalogDtos.ProductDto;
import com.kirana.common.PageResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Catalog (app)")
@RestController
@RequestMapping("/api/v1/app")
@RequiredArgsConstructor
public class CatalogController {

    private final CatalogService service;

    @GetMapping("/catalog")
    public CatalogResponse catalog() {
        return service.catalog();
    }

    @GetMapping("/products")
    public PageResponse<ProductDto> products(@RequestParam(required = false) Long categoryId,
                                             @RequestParam(required = false) String q,
                                             @RequestParam(required = false) Integer page,
                                             @RequestParam(required = false) Integer size) {
        return service.products(categoryId, q, page, size);
    }

    @GetMapping("/products/{id}")
    public ProductDto product(@PathVariable Long id) {
        return service.product(id);
    }
}
