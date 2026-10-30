package com.kirana.customer;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public final class AddressDtos {

    private AddressDtos() {
    }

    public record AddressRequest(
            @NotBlank @Size(max = 40) String label,
            @NotBlank @Size(max = 200) String line1,
            @Size(max = 200) String line2,
            @Size(max = 120) String landmark,
            @NotBlank @Pattern(regexp = "[1-9]\\d{5}", message = "must be a 6 digit PIN code") String pincode,
            @NotNull @DecimalMin("-90") @DecimalMax("90") @Digits(integer = 3, fraction = 6) BigDecimal lat,
            @NotNull @DecimalMin("-180") @DecimalMax("180") @Digits(integer = 3, fraction = 6) BigDecimal lng,
            Boolean isDefault) {
    }

    public record AddressResponse(Long id, String label, String line1, String line2, String landmark, String pincode,
                                  BigDecimal lat, BigDecimal lng, boolean isDefault) {
        public static AddressResponse from(UserAddress a) {
            return new AddressResponse(a.getId(), a.getLabel(), a.getLine1(), a.getLine2(), a.getLandmark(),
                    a.getPincode(), a.getLat(), a.getLng(), a.isDefaultAddress());
        }
    }

    public record UpdateMeRequest(@NotBlank @Size(max = 120) String name) {
    }
}
