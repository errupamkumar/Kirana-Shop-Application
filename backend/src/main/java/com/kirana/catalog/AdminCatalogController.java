package com.kirana.catalog;

import com.kirana.catalog.AdminCatalogDtos.ActiveRequest;
import com.kirana.catalog.AdminCatalogDtos.CategoryRequest;
import com.kirana.catalog.AdminCatalogDtos.CategoryResponse;
import com.kirana.catalog.AdminCatalogDtos.DeleteResult;
import com.kirana.catalog.AdminCatalogDtos.ProductRequest;
import com.kirana.catalog.AdminCatalogDtos.ProductResponse;
import com.kirana.catalog.AdminCatalogDtos.VariantPatchRequest;
import com.kirana.catalog.AdminCatalogDtos.VariantResponse;
import com.kirana.common.PageResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Catalog (admin)")
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminCatalogController {

    private final AdminCatalogService service;

    @GetMapping("/categories")
    public List<CategoryResponse> categories() {
        return service.listCategories();
    }

    @PostMapping("/categories")
    @ResponseStatus(HttpStatus.CREATED)
    public CategoryResponse createCategory(@Valid @RequestBody CategoryRequest request) {
        return service.createCategory(request);
    }

    @PutMapping("/categories/{id}")
    public CategoryResponse updateCategory(@PathVariable Long id, @Valid @RequestBody CategoryRequest request) {
        return service.updateCategory(id, request);
    }

    @DeleteMapping("/categories/{id}")
    public DeleteResult deleteCategory(@PathVariable Long id) {
        return service.deleteCategory(id);
    }

    @GetMapping("/products")
    public PageResponse<ProductResponse> products(@RequestParam(required = false) String q,
                                                  @RequestParam(required = false) Long categoryId,
                                                  @RequestParam(required = false) Boolean active,
                                                  @RequestParam(required = false) Integer page,
                                                  @RequestParam(required = false) Integer size) {
        return service.listProducts(q, categoryId, active, page, size);
    }

    @GetMapping("/products/{id}")
    public ProductResponse product(@PathVariable Long id) {
        return service.getProduct(id);
    }

    @PostMapping("/products")
    @ResponseStatus(HttpStatus.CREATED)
    public ProductResponse createProduct(@Valid @RequestBody ProductRequest request) {
        return service.createProduct(request);
    }

    @PutMapping("/products/{id}")
    public ProductResponse updateProduct(@PathVariable Long id, @Valid @RequestBody ProductRequest request) {
        return service.updateProduct(id, request);
    }

    @PatchMapping("/products/{id}/active")
    public ProductResponse setActive(@PathVariable Long id, @Valid @RequestBody ActiveRequest request) {
        return service.setProductActive(id, request.active());
    }

    @PatchMapping("/variants/{id}")
    public VariantResponse patchVariant(@PathVariable Long id, @Valid @RequestBody VariantPatchRequest request) {
        return service.patchVariant(id, request);
    }
}
