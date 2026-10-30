package com.kirana.customer;

import com.kirana.auth.AuthPrincipal;
import com.kirana.customer.AddressDtos.AddressRequest;
import com.kirana.customer.AddressDtos.AddressResponse;
import com.kirana.customer.AddressDtos.UpdateMeRequest;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Customer profile and addresses")
@RestController
@RequestMapping("/api/v1/app")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService service;

    @GetMapping("/me")
    public MeResponse me(@AuthenticationPrincipal AuthPrincipal me) {
        return service.me(me.id());
    }

    @PutMapping("/me")
    public MeResponse updateMe(@AuthenticationPrincipal AuthPrincipal me, @Valid @RequestBody UpdateMeRequest request) {
        return service.updateName(me.id(), request.name());
    }

    @GetMapping("/addresses")
    public List<AddressResponse> addresses(@AuthenticationPrincipal AuthPrincipal me) {
        return service.addresses(me.id());
    }

    @PostMapping("/addresses")
    @ResponseStatus(HttpStatus.CREATED)
    public AddressResponse create(@AuthenticationPrincipal AuthPrincipal me, @Valid @RequestBody AddressRequest request) {
        return service.createAddress(me.id(), request);
    }

    @PutMapping("/addresses/{id}")
    public AddressResponse update(@AuthenticationPrincipal AuthPrincipal me, @PathVariable Long id,
                                  @Valid @RequestBody AddressRequest request) {
        return service.updateAddress(me.id(), id, request);
    }

    @DeleteMapping("/addresses/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthPrincipal me, @PathVariable Long id) {
        service.deleteAddress(me.id(), id);
    }
}
