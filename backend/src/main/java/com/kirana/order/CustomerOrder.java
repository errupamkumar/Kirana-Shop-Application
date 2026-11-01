package com.kirana.order;

import com.kirana.common.TimestampedEntity;
import com.kirana.payment.PaymentMethod;
import com.kirana.payment.PaymentStatus;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** An order with price and address snapshots taken at placement time (table {@code orders}). */
@Getter
@Setter
@Entity
@Table(name = "orders")
public class CustomerOrder extends TimestampedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String orderNumber;
    private Long userId;
    /** Set when the store built this order from a customer list photo or voice note. */
    private Long requestId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private OrderStatus status;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private PaymentStatus paymentStatus;

    private BigDecimal itemSubtotal;
    private BigDecimal deliveryFee;
    private BigDecimal total;
    private BigDecimal minOrderAmountApplied;

    private String addrLabel;
    private String addrName;
    private String addrPhone;
    private String addrLine1;
    private String addrLine2;
    private String addrLandmark;
    private String addrPincode;
    private BigDecimal addrLat;
    private BigDecimal addrLng;
    private BigDecimal distanceKm;

    private String customerNote;
    private String cancelReason;
    private Instant placedAt;
    private Instant deliveredAt;

    @BatchSize(size = 50)
    @OrderBy("id ASC")
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();

    @BatchSize(size = 50)
    @OrderBy("createdAt ASC, id ASC")
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderStatusHistory> history = new ArrayList<>();

    public void addItem(OrderItem item) {
        item.setOrder(this);
        items.add(item);
    }

    public void addHistory(OrderStatusHistory entry) {
        entry.setOrder(this);
        history.add(entry);
    }

    public int itemCount() {
        return items.stream().mapToInt(OrderItem::getQty).sum();
    }
}
