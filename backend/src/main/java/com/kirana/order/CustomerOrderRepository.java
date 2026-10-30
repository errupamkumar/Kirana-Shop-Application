package com.kirana.order;

import jakarta.persistence.LockModeType;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CustomerOrderRepository extends JpaRepository<CustomerOrder, Long>, JpaSpecificationExecutor<CustomerOrder> {

    Page<CustomerOrder> findAllByUserId(Long userId, Pageable pageable);

    Optional<CustomerOrder> findByIdAndUserId(Long id, Long userId);

    /** Row lock so concurrent status changes (e.g. two cancels) cannot both restore stock. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from CustomerOrder o where o.id = :id")
    Optional<CustomerOrder> findByIdForUpdate(@Param("id") Long id);

    @Query("select o.id from CustomerOrder o where o.status = :status and o.placedAt < :before")
    List<Long> findIdsByStatusAndPlacedAtBefore(@Param("status") OrderStatus status, @Param("before") Instant before);

    @Query("select o.status, count(o) from CustomerOrder o group by o.status")
    List<Object[]> countByStatus();

    @Query("select count(o) from CustomerOrder o where o.placedAt >= :from and o.placedAt < :to "
            + "and o.status <> com.kirana.order.OrderStatus.PENDING_PAYMENT")
    long countPlacedBetween(@Param("from") Instant from, @Param("to") Instant to);

    @Query("select coalesce(sum(o.total), 0) from CustomerOrder o where o.status = com.kirana.order.OrderStatus.DELIVERED "
            + "and o.deliveredAt >= :from and o.deliveredAt < :to")
    BigDecimal deliveredRevenueBetween(@Param("from") Instant from, @Param("to") Instant to);

    @Query("select o.placedAt from CustomerOrder o where o.placedAt >= :from "
            + "and o.status <> com.kirana.order.OrderStatus.PENDING_PAYMENT")
    List<Instant> placedAtSince(@Param("from") Instant from);

    @Query("select o.deliveredAt, o.total from CustomerOrder o where o.status = com.kirana.order.OrderStatus.DELIVERED "
            + "and o.deliveredAt >= :from")
    List<Object[]> deliveriesSince(@Param("from") Instant from);
}
