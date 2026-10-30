package com.kirana.settings;

import com.kirana.payment.PaymentMethod;
import java.math.BigDecimal;
import java.util.List;

/** Public store configuration for the customer app. Contains no secrets. */
public record AppConfigResponse(
        String storeName,
        String storePhone,
        String storeAddress,
        BigDecimal storeLat,
        BigDecimal storeLng,
        BigDecimal maxDeliveryRadiusKm,
        BigDecimal minOrderAmount,
        BigDecimal deliveryCharge,
        BigDecimal freeDeliveryAbove,
        boolean codEnabled,
        boolean onlinePaymentEnabled,
        String gatewayKeyId,
        List<PaymentMethod> allowedPaymentMethods,
        boolean storeOpen,
        String storeClosedMessage) {

    static AppConfigResponse from(StoreRules r) {
        boolean online = r.onlinePaymentAvailable();
        return new AppConfigResponse(r.storeName(), r.storePhone(), r.storeAddress(), r.storeLat(), r.storeLng(),
                r.maxDeliveryRadiusKm(), r.minOrderAmount(), r.deliveryCharge(), r.freeDeliveryAbove(),
                r.codEnabled(), online, online ? r.gatewayKeyId() : null, r.allowedPaymentMethods(),
                r.storeOpen(), r.storeClosedMessage());
    }
}
