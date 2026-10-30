package com.kirana.payment;

import com.kirana.common.TimestampedEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Getter
@Setter
@Entity
@Table(name = "payments")
public class Payment extends TimestampedEntity {

    public static final String GATEWAY_RAZORPAY = "RAZORPAY";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long orderId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private PaymentMethod method;

    private String gateway;
    private String gatewayOrderId;
    private String gatewayPaymentId;
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private PaymentStatus status;

    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> rawResponse;
}
