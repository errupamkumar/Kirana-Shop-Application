package com.kirana.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.kirana.config.AppProperties;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class CommonUtilsTest {

    private static AppProperties withKey(String key) {
        return new AppProperties(null, key, null, null, null, null, null, null);
    }

    @Test
    void secretCipherRoundTripsAndUsesRandomIv() {
        SecretCipher cipher = new SecretCipher(withKey("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="));
        byte[] a = cipher.encrypt("rzp_secret_value");
        byte[] b = cipher.encrypt("rzp_secret_value");
        assertThat(a).isNotEqualTo(b);
        assertThat(cipher.decrypt(a)).isEqualTo("rzp_secret_value");
        assertThat(new String(a)).doesNotContain("rzp_secret_value");
    }

    @Test
    void secretCipherRejectsTamperingAndBadKeys() {
        SecretCipher cipher = new SecretCipher(withKey("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="));
        byte[] enc = cipher.encrypt("value");
        enc[enc.length - 1] ^= 1;
        assertThatThrownBy(() -> cipher.decrypt(enc)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new SecretCipher(withKey(""))).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new SecretCipher(withKey("c2hvcnQ="))).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void phonesNormaliseToE164() {
        assertThat(Phones.normalize("9876543210")).isEqualTo("+919876543210");
        assertThat(Phones.normalize("+91 98765-43210")).isEqualTo("+919876543210");
        assertThat(Phones.normalize("919876543210")).isEqualTo("+919876543210");
        assertThat(Phones.normalize("09876543210")).isEqualTo("+919876543210");
        assertThatThrownBy(() -> Phones.normalize("1234567890")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> Phones.normalize("98765")).isInstanceOf(ApiException.class);
    }

    @Test
    void moneyHelpers() {
        assertThat(Money.times(new BigDecimal("33.33"), 3)).isEqualByComparingTo("99.99");
        assertThat(Money.toPaise(new BigDecimal("530.50"))).isEqualTo(53050L);
        assertThat(Money.discountPercent(new BigDecimal("180.00"), new BigDecimal("149.00"))).isEqualTo(17);
        assertThat(Money.discountPercent(new BigDecimal("20.00"), new BigDecimal("20.00"))).isZero();
    }
}
