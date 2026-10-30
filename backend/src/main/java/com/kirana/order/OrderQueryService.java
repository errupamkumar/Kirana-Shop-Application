package com.kirana.order;

import com.kirana.common.ApiException;
import com.kirana.common.PageResponse;
import com.kirana.common.Pages;
import com.kirana.common.TimeZones;
import com.kirana.order.OrderDtos.InvoiceDto;
import com.kirana.order.OrderDtos.OrderDetailDto;
import com.kirana.order.OrderDtos.OrderSummaryDto;
import com.kirana.order.OrderDtos.StoreInfo;
import com.kirana.settings.StoreRules;
import com.kirana.settings.StoreSettingsService;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OrderQueryService {

    private static final Sort NEWEST_FIRST = Sort.by(Sort.Direction.DESC, "placedAt").and(Sort.by(Sort.Direction.DESC, "id"));

    private final CustomerOrderRepository orders;
    private final OrderMapper mapper;
    private final StoreSettingsService settings;
    private final Clock clock;

    public PageResponse<OrderSummaryDto> myOrders(Long userId, Integer page, Integer size) {
        return PageResponse.from(orders.findAllByUserId(userId, Pages.of(page, size, NEWEST_FIRST)), mapper::summary);
    }

    public OrderDetailDto customerOrder(Long userId, Long orderId) {
        return orders.findByIdAndUserId(orderId, userId)
                .map(o -> mapper.detail(o, ActorType.CUSTOMER))
                .orElseThrow(() -> ApiException.notFound("Order"));
    }

    /** Admin list. {@code from}/{@code to} are inclusive India-time dates; {@code q} matches order number or phone. */
    public PageResponse<OrderSummaryDto> adminOrders(OrderStatus status, LocalDate from, LocalDate to, String q,
                                                     Integer page, Integer size) {
        Specification<CustomerOrder> spec = Specification.allOf(
                status == null ? null : (root, query, cb) -> cb.equal(root.get("status"), status),
                from == null ? null : (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("placedAt"), startOf(from)),
                to == null ? null : (root, query, cb) -> cb.lessThan(root.get("placedAt"), startOf(to.plusDays(1))),
                q == null || q.isBlank() ? null : (root, query, cb) -> {
                    String pattern = "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
                    return cb.or(cb.like(cb.lower(root.get("orderNumber")), pattern),
                            cb.like(root.get("addrPhone"), pattern));
                });
        return PageResponse.from(orders.findAll(spec, Pages.of(page, size, NEWEST_FIRST)), mapper::summary);
    }

    public OrderDetailDto adminOrder(Long orderId) {
        return mapper.detail(order(orderId), ActorType.ADMIN);
    }

    public InvoiceDto invoice(Long orderId) {
        StoreRules rules = settings.rules();
        return new InvoiceDto(new StoreInfo(rules.storeName(), rules.storeAddress(), rules.storePhone(), rules.gstin()),
                mapper.detail(order(orderId), ActorType.ADMIN), Instant.now(clock));
    }

    public OrderDetailDto detailFor(Long orderId, ActorType viewer) {
        return mapper.detail(order(orderId), viewer);
    }

    private CustomerOrder order(Long orderId) {
        return orders.findById(orderId).orElseThrow(() -> ApiException.notFound("Order"));
    }

    private static Instant startOf(LocalDate day) {
        return day.atStartOfDay(TimeZones.STORE).toInstant();
    }
}
