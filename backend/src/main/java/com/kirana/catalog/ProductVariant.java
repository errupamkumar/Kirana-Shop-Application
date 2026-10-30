package com.kirana.catalog;

import com.kirana.common.TimestampedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "product_variants")
public class ProductVariant extends TimestampedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id")
    private Product product;

    private String label;
    private String sku;
    private BigDecimal mrp;
    private BigDecimal sellingPrice;
    private int stockQty;

    @Column(name = "is_active")
    private boolean active = true;

    private int sortOrder;

    /** Orderable when the variant, its product and its category are active and stock is left. */
    public boolean isOrderable() {
        return active && stockQty > 0 && product.isActive() && product.getCategory().isActive();
    }

    public boolean isListed() {
        return active && product.isActive() && product.getCategory().isActive();
    }
}
