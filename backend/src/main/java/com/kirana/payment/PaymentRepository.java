package com.kirana.payment;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    Optional<Payment> findFirstByOrderIdOrderByIdDesc(Long orderId);

    Optional<Payment> findByGatewayOrderId(String gatewayOrderId);

    List<Payment> findAllByOrderIdIn(Collection<Long> orderIds);
}
