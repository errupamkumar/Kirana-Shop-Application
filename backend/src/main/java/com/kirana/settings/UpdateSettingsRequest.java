package com.kirana.settings;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/** PUT /admin/settings. A blank {@code gatewaySecret} keeps the stored secret. */
public record UpdateSettingsRequest(
        @NotBlank @Size(max = 120) String storeName,
        @NotBlank @Size(max = 20) String storePhone,
        @NotBlank @Size(max = 300) String storeAddress,
        @Pattern(regexp = "^$|^[0-9A-Z]{15}$", message = "must be 15 uppercase letters/digits") String gstin,
        @NotNull @DecimalMin("-90") @DecimalMax("90") @Digits(integer = 3, fraction = 6) BigDecimal storeLat,
        @NotNull @DecimalMin("-180") @DecimalMax("180") @Digits(integer = 3, fraction = 6) BigDecimal storeLng,
        @NotNull @DecimalMin("0.5") @DecimalMax("20") @Digits(integer = 2, fraction = 2) BigDecimal maxDeliveryRadiusKm,
        @NotNull @DecimalMin("0") @Digits(integer = 8, fraction = 2) BigDecimal minOrderAmount,
        @NotNull @DecimalMin("0") @Digits(integer = 8, fraction = 2) BigDecimal deliveryCharge,
        @DecimalMin("0.01") @Digits(integer = 8, fraction = 2) BigDecimal freeDeliveryAbove,
        @NotNull Boolean codEnabled,
        @NotNull Boolean onlinePaymentEnabled,
        @Size(max = 100) String gatewayKeyId,
        @Size(max = 200) String gatewaySecret,
        @NotNull Boolean storeOpen,
        @Size(max = 300) String storeClosedMessage,
        @NotNull @Min(0) @Max(1000) Integer lowStockThreshold) {

    /** Hides the secret if this record is ever logged. */
    @Override
    public String toString() {
        return "UpdateSettingsRequest[storeName=" + storeName + ", gatewaySecret=***]";
    }
}
