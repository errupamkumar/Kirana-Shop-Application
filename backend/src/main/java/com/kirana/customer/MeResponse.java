package com.kirana.customer;

public record MeResponse(Long id, String phone, String name) {

    public static MeResponse from(User user) {
        return new MeResponse(user.getId(), user.getPhone(), user.getName());
    }
}
