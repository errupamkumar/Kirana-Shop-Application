package com.kirana.checkout;

import com.kirana.auth.AuthPrincipal;
import com.kirana.checkout.CheckoutDtos.CartQuote;
import com.kirana.checkout.CheckoutDtos.CartValidateRequest;
import com.kirana.checkout.CheckoutDtos.Location;
import com.kirana.checkout.CheckoutDtos.LocationCheckRequest;
import com.kirana.checkout.CheckoutDtos.LocationCheckResponse;
import com.kirana.customer.CustomerService;
import com.kirana.customer.UserAddress;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Checkout")
@RestController
@RequestMapping("/api/v1/app")
@RequiredArgsConstructor
public class CheckoutController {

    private final StoreValidationService validation;
    private final CustomerService customers;

    @PostMapping("/location/check")
    public LocationCheckResponse checkLocation(@Valid @RequestBody LocationCheckRequest request) {
        return validation.checkLocation(request.lat(), request.lng());
    }

    @PostMapping("/cart/validate")
    public CartQuote validateCart(@AuthenticationPrincipal AuthPrincipal me, @Valid @RequestBody CartValidateRequest request) {
        Location location = null;
        if (request.addressId() != null) {
            UserAddress address = customers.address(me.id(), request.addressId());
            location = new Location(address.getLat(), address.getLng());
        } else if (request.lat() != null && request.lng() != null) {
            location = new Location(request.lat(), request.lng());
        }
        return validation.validateCart(request.items(), location, request.paymentMethod());
    }
}
