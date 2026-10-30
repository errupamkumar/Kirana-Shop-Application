package com.kirana.auth;

import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OtpRequestRepository extends JpaRepository<OtpRequest, Long> {

    Optional<OtpRequest> findFirstByPhoneOrderByCreatedAtDescIdDesc(String phone);

    Optional<OtpRequest> findFirstByPhoneAndConsumedFalseOrderByCreatedAtDescIdDesc(String phone);

    long countByPhoneAndCreatedAtAfter(String phone, Instant after);

    @Modifying
    @Query("update OtpRequest o set o.consumed = true where o.phone = :phone and o.consumed = false")
    int consumeAllForPhone(@Param("phone") String phone);
}
