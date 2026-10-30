package com.kirana.common;

import java.util.regex.Pattern;

/** Indian mobile numbers normalised to E.164 (+91XXXXXXXXXX). */
public final class Phones {

    private static final Pattern MOBILE = Pattern.compile("[6-9]\\d{9}");

    private Phones() {
    }

    /** Returns the E.164 form, or throws VALIDATION_ERROR. */
    public static String normalize(String input) {
        if (input == null) {
            throw ApiException.validation("phone", "is required");
        }
        String digits = input.replaceAll("[\\s-]", "");
        if (digits.startsWith("+91")) {
            digits = digits.substring(3);
        } else if (digits.startsWith("91") && digits.length() == 12) {
            digits = digits.substring(2);
        } else if (digits.startsWith("0") && digits.length() == 11) {
            digits = digits.substring(1);
        }
        if (!MOBILE.matcher(digits).matches()) {
            throw ApiException.validation("phone", "must be a valid 10 digit Indian mobile number");
        }
        return "+91" + digits;
    }
}
