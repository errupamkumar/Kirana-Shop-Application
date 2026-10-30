package com.kirana.settings;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

/** Singleton row (id = 1) holding every business rule the clients display and the server enforces. */
@Getter
@Setter
@Entity
@Table(name = "store_settings")
public class StoreSettings {

    public static final byte SINGLETON_ID = 1;

    @Id
    private Byte id;

    private String storeName;
    private String storePhone;
    private String storeAddress;
    private String gstin;
    private BigDecimal storeLat;
    private BigDecimal storeLng;
    private BigDecimal maxDeliveryRadiusKm;
    private BigDecimal minOrderAmount;
    private BigDecimal deliveryCharge;
    private BigDecimal freeDeliveryAbove;
    private boolean codEnabled;
    private boolean onlinePaymentEnabled;
    private String gatewayKeyId;

    @Column(name = "gateway_secret_enc")
    private byte[] gatewaySecretEnc;

    @Column(name = "is_store_open")
    private boolean storeOpen;

    private String storeClosedMessage;
    private int lowStockThreshold;
    private Instant updatedAt;
    private String updatedBy;
}
