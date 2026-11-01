package com.kirana.request;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderRequestRepository extends JpaRepository<OrderRequest, Long> {

    Page<OrderRequest> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    Page<OrderRequest> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<OrderRequest> findByStatusOrderByCreatedAtDesc(OrderRequestStatus status, Pageable pageable);

    long countByStatus(OrderRequestStatus status);

    long countByUserIdAndStatus(Long userId, OrderRequestStatus status);

    Optional<OrderRequest> findByOrderId(Long orderId);

    /** Row lock so the store cannot accept a request the customer is cancelling (or accept it twice). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from OrderRequest r where r.id = :id")
    Optional<OrderRequest> findByIdForUpdate(@Param("id") Long id);
}
