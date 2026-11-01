package com.kirana.dashboard;

import com.kirana.catalog.ProductVariant;
import com.kirana.catalog.ProductVariantRepository;
import com.kirana.common.Money;
import com.kirana.common.TimeZones;
import com.kirana.order.CustomerOrderRepository;
import com.kirana.order.OrderStatus;
import com.kirana.request.OrderRequestRepository;
import com.kirana.request.OrderRequestStatus;
import com.kirana.settings.StoreSettingsService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardService {

    static final int LOW_STOCK_LIMIT = 20;
    static final int DAYS = 7;

    private final CustomerOrderRepository orders;
    private final ProductVariantRepository variants;
    private final OrderRequestRepository requests;
    private final StoreSettingsService settings;
    private final Clock clock;

    public record LowStockItem(Long variantId, Long productId, String productName, String variantLabel, String sku,
                               int stockQty) {
    }

    public record DayStat(LocalDate date, long orders, BigDecimal revenue) {
    }

    public record DashboardResponse(long todayOrders, BigDecimal todayRevenue, Map<OrderStatus, Long> countsByStatus,
                                    long pendingOrders, int lowStockThreshold, long lowStockCount, List<LowStockItem> lowStock,
                                    List<DayStat> last7Days, long pendingRequests) {
    }

    public DashboardResponse dashboard() {
        LocalDate today = LocalDate.now(clock.withZone(TimeZones.STORE));
        Instant startToday = start(today);
        Instant startTomorrow = start(today.plusDays(1));

        Map<OrderStatus, Long> counts = new EnumMap<>(OrderStatus.class);
        for (OrderStatus status : OrderStatus.values()) {
            counts.put(status, 0L);
        }
        for (Object[] row : orders.countByStatus()) {
            counts.put((OrderStatus) row[0], (Long) row[1]);
        }
        long pending = counts.get(OrderStatus.PLACED) + counts.get(OrderStatus.ACCEPTED) + counts.get(OrderStatus.PACKED)
                + counts.get(OrderStatus.OUT_FOR_DELIVERY);

        int threshold = settings.rules().lowStockThreshold();
        List<LowStockItem> lowStock = variants.findLowStock(threshold, PageRequest.of(0, LOW_STOCK_LIMIT)).stream()
                .map(DashboardService::lowStockItem)
                .toList();

        LocalDate firstDay = today.minusDays(DAYS - 1L);
        Map<LocalDate, long[]> orderCounts = new LinkedHashMap<>();
        Map<LocalDate, BigDecimal> revenue = new LinkedHashMap<>();
        for (int i = 0; i < DAYS; i++) {
            orderCounts.put(firstDay.plusDays(i), new long[1]);
            revenue.put(firstDay.plusDays(i), BigDecimal.ZERO);
        }
        for (Instant placedAt : orders.placedAtSince(start(firstDay))) {
            long[] bucket = orderCounts.get(day(placedAt));
            if (bucket != null) {
                bucket[0]++;
            }
        }
        for (Object[] row : orders.deliveriesSince(start(firstDay))) {
            revenue.computeIfPresent(day((Instant) row[0]), (d, sum) -> sum.add((BigDecimal) row[1]));
        }
        List<DayStat> days = new ArrayList<>();
        orderCounts.forEach((date, count) -> days.add(new DayStat(date, count[0], Money.scale(revenue.get(date)))));

        return new DashboardResponse(orders.countPlacedBetween(startToday, startTomorrow),
                Money.scale(orders.deliveredRevenueBetween(startToday, startTomorrow)), counts, pending, threshold,
                variants.countLowStock(threshold), lowStock, days, requests.countByStatus(OrderRequestStatus.PENDING));
    }

    private static LowStockItem lowStockItem(ProductVariant v) {
        return new LowStockItem(v.getId(), v.getProduct().getId(), v.getProduct().getName(), v.getLabel(), v.getSku(),
                v.getStockQty());
    }

    private static Instant start(LocalDate day) {
        return day.atStartOfDay(TimeZones.STORE).toInstant();
    }

    private static LocalDate day(Instant instant) {
        return instant.atZone(TimeZones.STORE).toLocalDate();
    }
}
