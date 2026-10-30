package com.kirana.catalog;

import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductVariantRepository extends JpaRepository<ProductVariant, Long> {

    @Query("select v from ProductVariant v join fetch v.product p join fetch p.category where v.id in :ids")
    List<ProductVariant> findAllWithProductByIdIn(@Param("ids") Collection<Long> ids);

    boolean existsBySku(String sku);

    boolean existsBySkuAndIdNot(String sku, Long id);

    /** Conditional decrement: returns 0 when not enough stock is left, so stock never goes negative. */
    @Modifying(flushAutomatically = true)
    @Query(value = "UPDATE product_variants SET stock_qty = stock_qty - :qty, updated_at = UTC_TIMESTAMP(6) "
            + "WHERE id = :id AND stock_qty >= :qty", nativeQuery = true)
    int decrementStock(@Param("id") long id, @Param("qty") int qty);

    @Modifying(flushAutomatically = true)
    @Query(value = "UPDATE product_variants SET stock_qty = stock_qty + :qty, updated_at = UTC_TIMESTAMP(6) "
            + "WHERE id = :id", nativeQuery = true)
    int incrementStock(@Param("id") long id, @Param("qty") int qty);

    @Query("select count(v) from ProductVariant v join v.product p "
            + "where v.active = true and p.active = true and v.stockQty <= :threshold")
    long countLowStock(@Param("threshold") int threshold);

    @Query("select v from ProductVariant v join fetch v.product p "
            + "where v.active = true and p.active = true and v.stockQty <= :threshold "
            + "order by v.stockQty asc, p.name asc")
    List<ProductVariant> findLowStock(@Param("threshold") int threshold, Pageable pageable);
}
