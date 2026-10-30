package com.kirana.customer;

import com.kirana.common.TimestampedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;

/** A delivery address. lat/lng come from GPS or a map pin and decide serviceability at order time. */
@Getter
@Setter
@Entity
@Table(name = "user_addresses")
public class UserAddress extends TimestampedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;
    private String label;
    private String line1;
    private String line2;
    private String landmark;
    private String pincode;
    private BigDecimal lat;
    private BigDecimal lng;

    @Column(name = "is_default")
    private boolean defaultAddress;
}
