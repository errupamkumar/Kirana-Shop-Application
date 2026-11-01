package com.kirana.request;

import com.kirana.common.TimestampedEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

/** A list photo and/or voice note the store turns into an order. The delivery address is a snapshot. */
@Getter
@Setter
@Entity
@Table(name = "order_requests")
public class OrderRequest extends TimestampedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;

    @Enumerated(EnumType.STRING)
    private OrderRequestStatus status;

    /** File names under MEDIA_DIR/requests, served only through signed links. */
    private String imagePath;
    private String audioPath;
    private Integer audioSeconds;
    private String note;

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

    private Long orderId;
    private String rejectReason;
    private Long handledBy;
    private Instant handledAt;
}
