package com.kirana.settings;

import com.kirana.payment.PaymentMethod;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Immutable, cacheable view of the store settings. Never contains the gateway secret, only whether one is set.
 * Also the admin GET /settings response.
 */
public record StoreRules(
        String storeName,
        String storePhone,
        String storeAddress,
        String gstin,
        BigDecimal storeLat,
        BigDecimal storeLng,
        BigDecimal maxDeliveryRadiusKm,
        BigDecimal minOrderAmount,
        BigDecimal deliveryCharge,
        BigDecimal freeDeliveryAbove,
        boolean codEnabled,
        boolean onlinePaymentEnabled,
        String gatewayKeyId,
        boolean gatewaySecretSet,
        boolean storeOpen,
        String storeClosedMessage,
        int lowStockThreshold,
        Instant updatedAt,
        String updatedBy) {

    static StoreRules from(StoreSettings s) {
        return new StoreRules(s.getStoreName(), s.getStorePhone(), s.getStoreAddress(), s.getGstin(),
                s.getStoreLat(), s.getStoreLng(), s.getMaxDeliveryRadiusKm(), s.getMinOrderAmount(),
                s.getDeliveryCharge(), s.getFreeDeliveryAbove(), s.isCodEnabled(), s.isOnlinePaymentEnabled(),
                s.getGatewayKeyId(), s.getGatewaySecretEnc() != null && s.getGatewaySecretEnc().length > 0,
                s.isStoreOpen(), s.getStoreClosedMessage(), s.getLowStockThreshold(), s.getUpdatedAt(),
                s.getUpdatedBy());
    }

    /** Online payment is offered only when switched on and fully configured. */
    public boolean onlinePaymentAvailable() {
        return onlinePaymentEnabled && gatewayKeyId != null && !gatewayKeyId.isBlank() && gatewaySecretSet;
    }

    public List<PaymentMethod> allowedPaymentMethods() {
        List<PaymentMethod> methods = new ArrayList<>(2);
        if (codEnabled) {
            methods.add(PaymentMethod.COD);
        }
        if (onlinePaymentAvailable()) {
            methods.add(PaymentMethod.ONLINE);
        }
        return List.copyOf(methods);
    }
}
