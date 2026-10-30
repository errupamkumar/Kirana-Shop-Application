package com.kirana.order;

import com.kirana.catalog.ProductVariant;
import com.kirana.catalog.ProductVariantRepository;
import com.kirana.checkout.CheckoutDtos.CartQuote;
import com.kirana.checkout.CheckoutDtos.Location;
import com.kirana.checkout.CheckoutDtos.QuoteLine;
import com.kirana.checkout.CheckoutDtos.Violation;
import com.kirana.checkout.StoreValidationService;
import com.kirana.common.ApiException;
import com.kirana.common.ErrorCode;
import com.kirana.config.AppProperties;
import com.kirana.customer.CustomerService;
import com.kirana.customer.User;
import com.kirana.customer.UserAddress;
import com.kirana.order.OrderDtos.PlaceOrderRequest;
import com.kirana.payment.Payment;
import com.kirana.payment.PaymentGateway;
import com.kirana.payment.PaymentGateway.GatewayOrder;
import com.kirana.payment.PaymentMethod;
import com.kirana.payment.PaymentRepository;
import com.kirana.payment.PaymentStatus;
import com.kirana.settings.StoreRules;
import com.kirana.settings.StoreSettingsService;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Order placement and every status change. All writes go through the state machine. */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final CustomerOrderRepository orders;
    private final IdempotencyKeyRepository idempotencyKeys;
    private final ProductVariantRepository variants;
    private final PaymentRepository payments;
    private final PaymentGateway gateway;
    private final CustomerService customers;
    private final StoreSettingsService settings;
    private final StoreValidationService validation;
    private final OrderNumberGenerator orderNumbers;
    private final AppProperties properties;
    private final Clock clock;

    /**
     * Places an order in one transaction. The idempotency key row is inserted first so a concurrent duplicate
     * blocks on the unique index and then fails; {@link OrderPlacementService} turns that into a replay.
     */
    @Transactional
    public CustomerOrder place(Long userId, PlaceOrderRequest req, String idempotencyKey) {
        Instant now = Instant.now(clock);
        IdempotencyKey key = new IdempotencyKey();
        key.setUserId(userId);
        key.setKey(idempotencyKey);
        key.setCreatedAt(now);
        idempotencyKeys.saveAndFlush(key);

        User user = customers.user(userId);
        UserAddress address = customers.address(userId, req.addressId());
        StoreRules rules = settings.rules();
        Map<Long, Integer> items = StoreValidationService.merge(req.items());
        Map<Long, ProductVariant> loaded = variants.findAllWithProductByIdIn(items.keySet()).stream()
                .collect(Collectors.toMap(ProductVariant::getId, Function.identity()));
        CartQuote quote = validation.quote(items, loaded, new Location(address.getLat(), address.getLng()),
                req.paymentMethod(), rules);

        if (!quote.violations().isEmpty()) {
            Violation first = quote.violations().getFirst();
            throw new ApiException(first.code(), first.message(),
                    Map.of("violations", quote.violations(), "quote", quote));
        }
        if (quote.total().compareTo(req.expectedTotal()) != 0) {
            throw new ApiException(ErrorCode.PRICE_CHANGED, "Prices or charges have changed, please review your order",
                    Map.of("quote", quote));
        }

        // Conditional decrements in id order (consistent lock order); any miss rolls everything back
        List<Long> failed = new ArrayList<>();
        new TreeMap<>(items).forEach((variantId, qty) -> {
            if (variants.decrementStock(variantId, qty) == 0) {
                failed.add(variantId);
            }
        });
        if (!failed.isEmpty()) {
            throw new ApiException(ErrorCode.OUT_OF_STOCK, "Some items just went out of stock",
                    Map.of("variantIds", failed));
        }

        boolean online = req.paymentMethod() == PaymentMethod.ONLINE;
        CustomerOrder order = new CustomerOrder();
        order.setOrderNumber(orderNumbers.next());
        order.setUserId(userId);
        order.setStatus(online ? OrderStatus.PENDING_PAYMENT : OrderStatus.PLACED);
        order.setPaymentMethod(req.paymentMethod());
        order.setPaymentStatus(online ? PaymentStatus.PENDING : PaymentStatus.COD_PENDING);
        order.setItemSubtotal(quote.itemSubtotal());
        order.setDeliveryFee(quote.deliveryFee());
        order.setTotal(quote.total());
        order.setMinOrderAmountApplied(rules.minOrderAmount());
        order.setAddrLabel(address.getLabel());
        order.setAddrName(user.getName());
        order.setAddrPhone(user.getPhone());
        order.setAddrLine1(address.getLine1());
        order.setAddrLine2(address.getLine2());
        order.setAddrLandmark(address.getLandmark());
        order.setAddrPincode(address.getPincode());
        order.setAddrLat(address.getLat());
        order.setAddrLng(address.getLng());
        order.setDistanceKm(quote.distanceKm());
        order.setCustomerNote(req.note() == null || req.note().isBlank() ? null : req.note().trim());
        order.setPlacedAt(now);
        for (QuoteLine line : quote.lines()) {
            OrderItem item = new OrderItem();
            item.setVariantId(line.variantId());
            item.setProductName(line.productName());
            item.setVariantLabel(line.variantLabel());
            item.setImageUrl(line.imageUrl());
            item.setMrp(line.mrp());
            item.setSellingPrice(line.sellingPrice());
            item.setQty(line.qty());
            item.setLineTotal(line.lineTotal());
            order.addItem(item);
        }
        order.addHistory(history(null, order.getStatus(), ActorType.CUSTOMER, userId, null, now));
        orders.saveAndFlush(order);
        key.setOrderId(order.getId());

        Payment payment = new Payment();
        payment.setOrderId(order.getId());
        payment.setMethod(req.paymentMethod());
        payment.setAmount(order.getTotal());
        if (online) {
            String secret = settings.gatewaySecret()
                    .orElseThrow(() -> new ApiException(ErrorCode.PAYMENT_METHOD_DISABLED, "Online payment is not configured"));
            GatewayOrder gatewayOrder = gateway.createOrder(order.getTotal(), order.getOrderNumber(), rules.gatewayKeyId(), secret);
            payment.setGateway(gateway.name());
            payment.setGatewayOrderId(gatewayOrder.id());
            payment.setStatus(PaymentStatus.PENDING);
            payment.setRawResponse(gatewayOrder.raw());
        } else {
            payment.setStatus(PaymentStatus.COD_PENDING);
        }
        payments.save(payment);
        return order;
    }

    @Transactional
    public CustomerOrder cancelByCustomer(Long userId, Long orderId, String reason) {
        CustomerOrder order = lock(orderId);
        if (!order.getUserId().equals(userId)) {
            throw ApiException.notFound("Order");
        }
        transition(order, OrderStatus.CANCELLED, ActorType.CUSTOMER, userId,
                reason == null || reason.isBlank() ? "Cancelled by customer" : reason.trim());
        return order;
    }

    @Transactional
    public CustomerOrder updateStatusByAdmin(Long adminId, Long orderId, OrderStatus to, String note) {
        CustomerOrder order = lock(orderId);
        if (to == OrderStatus.CANCELLED && (note == null || note.isBlank())) {
            throw ApiException.validation("note", "a cancel reason is required");
        }
        transition(order, to, ActorType.ADMIN, adminId, note == null || note.isBlank() ? null : note.trim());
        return order;
    }

    /** Called once a payment is verified (checkout callback or webhook). Idempotent. */
    @Transactional
    public void onPaymentCaptured(Long orderId) {
        CustomerOrder order = lock(orderId);
        if (order.getStatus() == OrderStatus.PENDING_PAYMENT) {
            order.setPaymentStatus(PaymentStatus.PAID);
            transition(order, OrderStatus.PLACED, ActorType.SYSTEM, null, "Payment received");
        } else if (order.getStatus() == OrderStatus.CANCELLED && order.getPaymentStatus() != PaymentStatus.REFUND_PENDING) {
            // Paid after the order expired: stock was released, so the money must be refunded
            order.setPaymentStatus(PaymentStatus.REFUND_PENDING);
        } else if (order.getPaymentStatus() == PaymentStatus.PENDING) {
            order.setPaymentStatus(PaymentStatus.PAID);
        }
    }

    @Transactional(readOnly = true)
    public List<Long> findExpiredPendingPaymentIds() {
        return orders.findIdsByStatusAndPlacedAtBefore(OrderStatus.PENDING_PAYMENT,
                Instant.now(clock).minus(properties.orders().pendingPaymentExpiry()));
    }

    /** Cancels an unpaid online order and releases its stock; no-op if it was paid meanwhile. */
    @Transactional
    public boolean expireIfPending(Long orderId) {
        CustomerOrder order = lock(orderId);
        if (order.getStatus() != OrderStatus.PENDING_PAYMENT) {
            return false;
        }
        transition(order, OrderStatus.CANCELLED, ActorType.SYSTEM, null, "Payment not completed in time");
        return true;
    }

    private void transition(CustomerOrder order, OrderStatus to, ActorType actor, Long actorId, String note) {
        OrderStatus from = order.getStatus();
        if (!OrderStateMachine.canTransition(from, to, actor)) {
            throw new ApiException(ErrorCode.INVALID_STATUS_TRANSITION,
                    "Cannot change order from " + from + " to " + to,
                    Map.of("from", from, "to", to, "allowed", OrderStateMachine.next(from, actor)));
        }
        Instant now = Instant.now(clock);
        order.setStatus(to);
        if (to == OrderStatus.CANCELLED) {
            order.setCancelReason(note);
            restoreStock(order);
            PaymentStatus paymentStatus = switch (order.getPaymentStatus()) {
                case PAID -> PaymentStatus.REFUND_PENDING;
                case PENDING -> PaymentStatus.FAILED;
                default -> order.getPaymentStatus();
            };
            order.setPaymentStatus(paymentStatus);
            syncPaymentRow(order, paymentStatus);
        } else if (to == OrderStatus.DELIVERED) {
            order.setDeliveredAt(now);
            if (order.getPaymentMethod() == PaymentMethod.COD) {
                order.setPaymentStatus(PaymentStatus.COD_COLLECTED);
                syncPaymentRow(order, PaymentStatus.COD_COLLECTED);
            }
        }
        order.addHistory(history(from, to, actor, actorId, note, now));
    }

    private void restoreStock(CustomerOrder order) {
        for (OrderItem item : order.getItems()) {
            if (item.getVariantId() != null) {
                variants.incrementStock(item.getVariantId(), item.getQty());
            }
        }
    }

    private void syncPaymentRow(CustomerOrder order, PaymentStatus status) {
        payments.findFirstByOrderIdOrderByIdDesc(order.getId()).ifPresent(p -> {
            if (p.getStatus() != PaymentStatus.PAID || status == PaymentStatus.REFUND_PENDING) {
                p.setStatus(status);
            }
        });
    }

    private CustomerOrder lock(Long orderId) {
        return orders.findByIdForUpdate(orderId).orElseThrow(() -> ApiException.notFound("Order"));
    }

    private static OrderStatusHistory history(OrderStatus from, OrderStatus to, ActorType actor, Long actorId,
                                              String note, Instant at) {
        OrderStatusHistory h = new OrderStatusHistory();
        h.setFromStatus(from);
        h.setToStatus(to);
        h.setChangedByType(actor);
        h.setChangedById(actorId);
        h.setNote(note);
        h.setCreatedAt(at);
        return h;
    }
}
