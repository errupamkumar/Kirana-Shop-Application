package com.kirana.customer;

import com.kirana.common.ApiException;
import com.kirana.customer.AddressDtos.AddressRequest;
import com.kirana.customer.AddressDtos.AddressResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class CustomerService {

    static final int MAX_ADDRESSES = 10;

    private final UserRepository users;
    private final UserAddressRepository addresses;

    @Transactional(readOnly = true)
    public MeResponse me(Long userId) {
        return MeResponse.from(user(userId));
    }

    public MeResponse updateName(Long userId, String name) {
        User user = user(userId);
        user.setName(name.trim());
        return MeResponse.from(user);
    }

    @Transactional(readOnly = true)
    public List<AddressResponse> addresses(Long userId) {
        return addresses.findAllByUserIdOrderByDefaultAddressDescIdDesc(userId).stream()
                .map(AddressResponse::from).toList();
    }

    public AddressResponse createAddress(Long userId, AddressRequest req) {
        long count = addresses.countByUserId(userId);
        if (count >= MAX_ADDRESSES) {
            throw ApiException.validation("addresses", "you can save at most " + MAX_ADDRESSES + " addresses");
        }
        UserAddress a = new UserAddress();
        a.setUserId(userId);
        apply(a, req);
        // The first address is always the default
        a.setDefaultAddress(count == 0 || Boolean.TRUE.equals(req.isDefault()));
        addresses.saveAndFlush(a);
        if (a.isDefaultAddress()) {
            addresses.clearDefaultExcept(userId, a.getId());
        }
        return AddressResponse.from(a);
    }

    public AddressResponse updateAddress(Long userId, Long id, AddressRequest req) {
        UserAddress a = address(userId, id);
        apply(a, req);
        if (Boolean.TRUE.equals(req.isDefault())) {
            a.setDefaultAddress(true);
        }
        addresses.saveAndFlush(a);
        if (a.isDefaultAddress()) {
            addresses.clearDefaultExcept(userId, a.getId());
        }
        return AddressResponse.from(a);
    }

    public void deleteAddress(Long userId, Long id) {
        UserAddress a = address(userId, id);
        boolean wasDefault = a.isDefaultAddress();
        addresses.delete(a);
        addresses.flush();
        if (wasDefault) {
            addresses.findAllByUserIdOrderByDefaultAddressDescIdDesc(userId).stream().findFirst()
                    .ifPresent(next -> next.setDefaultAddress(true));
        }
    }

    /** Address owned by the user, or NOT_FOUND (never reveals other users' addresses). */
    @Transactional(readOnly = true)
    public UserAddress address(Long userId, Long id) {
        return addresses.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("Address"));
    }

    @Transactional(readOnly = true)
    public User user(Long userId) {
        return users.findById(userId).orElseThrow(() -> ApiException.notFound("User"));
    }

    private static void apply(UserAddress a, AddressRequest req) {
        a.setLabel(req.label().trim());
        a.setLine1(req.line1().trim());
        a.setLine2(blankToNull(req.line2()));
        a.setLandmark(blankToNull(req.landmark()));
        a.setPincode(req.pincode());
        a.setLat(req.lat());
        a.setLng(req.lng());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
