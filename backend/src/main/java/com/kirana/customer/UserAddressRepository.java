package com.kirana.customer;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserAddressRepository extends JpaRepository<UserAddress, Long> {

    List<UserAddress> findAllByUserIdOrderByDefaultAddressDescIdDesc(Long userId);

    Optional<UserAddress> findByIdAndUserId(Long id, Long userId);

    long countByUserId(Long userId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update UserAddress a set a.defaultAddress = false where a.userId = :userId and a.id <> :keepId")
    int clearDefaultExcept(@Param("userId") Long userId, @Param("keepId") Long keepId);
}
