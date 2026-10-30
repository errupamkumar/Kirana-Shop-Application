package com.kirana.settings;

import com.kirana.common.ApiException;
import com.kirana.common.ErrorCode;
import com.kirana.common.Money;
import com.kirana.common.SecretCipher;
import com.kirana.config.AppConfig;
import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class StoreSettingsService {

    private final StoreSettingsRepository repository;
    private final SecretCipher cipher;
    private final Clock clock;

    @Cacheable(AppConfig.SETTINGS_CACHE)
    @Transactional(readOnly = true)
    public StoreRules rules() {
        return StoreRules.from(load());
    }

    /** Decrypted gateway secret, never cached or returned by an API. */
    @Transactional(readOnly = true)
    public Optional<String> gatewaySecret() {
        byte[] enc = load().getGatewaySecretEnc();
        return enc == null || enc.length == 0 ? Optional.empty() : Optional.of(cipher.decrypt(enc));
    }

    @CacheEvict(cacheNames = AppConfig.SETTINGS_CACHE, allEntries = true)
    @Transactional
    public StoreRules update(UpdateSettingsRequest req, String actor) {
        StoreSettings s = load();
        boolean newSecret = req.gatewaySecret() != null && !req.gatewaySecret().isBlank();
        boolean secretSet = newSecret || (s.getGatewaySecretEnc() != null && s.getGatewaySecretEnc().length > 0);
        String keyId = blankToNull(req.gatewayKeyId());

        Map<String, Object> errors = new LinkedHashMap<>();
        if (!req.codEnabled() && !req.onlinePaymentEnabled()) {
            errors.put("codEnabled", "at least one payment method must stay enabled");
        }
        if (req.onlinePaymentEnabled()) {
            if (keyId == null) {
                errors.put("gatewayKeyId", "is required when online payment is enabled");
            }
            if (!secretSet) {
                errors.put("gatewaySecret", "is required when online payment is enabled");
            }
        }
        if (!errors.isEmpty()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Validation failed", errors);
        }

        s.setStoreName(req.storeName().trim());
        s.setStorePhone(req.storePhone().trim());
        s.setStoreAddress(req.storeAddress().trim());
        s.setGstin(blankToNull(req.gstin()));
        s.setStoreLat(req.storeLat());
        s.setStoreLng(req.storeLng());
        s.setMaxDeliveryRadiusKm(Money.scale(req.maxDeliveryRadiusKm()));
        s.setMinOrderAmount(Money.scale(req.minOrderAmount()));
        s.setDeliveryCharge(Money.scale(req.deliveryCharge()));
        s.setFreeDeliveryAbove(req.freeDeliveryAbove() == null ? null : Money.scale(req.freeDeliveryAbove()));
        s.setCodEnabled(req.codEnabled());
        s.setOnlinePaymentEnabled(req.onlinePaymentEnabled());
        s.setGatewayKeyId(keyId);
        if (newSecret) {
            s.setGatewaySecretEnc(cipher.encrypt(req.gatewaySecret().trim()));
        }
        s.setStoreOpen(req.storeOpen());
        s.setStoreClosedMessage(blankToNull(req.storeClosedMessage()));
        s.setLowStockThreshold(req.lowStockThreshold());
        s.setUpdatedAt(Instant.now(clock));
        s.setUpdatedBy(actor);
        return StoreRules.from(repository.saveAndFlush(s));
    }

    private StoreSettings load() {
        return repository.findById(StoreSettings.SINGLETON_ID)
                .orElseThrow(() -> new IllegalStateException("store_settings row (id = 1) is missing"));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
