package com.kirana.checkout;

import com.kirana.catalog.ProductVariant;
import com.kirana.catalog.ProductVariantRepository;
import com.kirana.checkout.CheckoutDtos.CartItem;
import com.kirana.checkout.CheckoutDtos.CartQuote;
import com.kirana.checkout.CheckoutDtos.LineIssue;
import com.kirana.checkout.CheckoutDtos.Location;
import com.kirana.checkout.CheckoutDtos.LocationCheckResponse;
import com.kirana.checkout.CheckoutDtos.QuoteLine;
import com.kirana.checkout.CheckoutDtos.Violation;
import com.kirana.common.ApiException;
import com.kirana.common.ErrorCode;
import com.kirana.common.Money;
import com.kirana.payment.PaymentMethod;
import com.kirana.settings.StoreRules;
import com.kirana.settings.StoreSettingsService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Applies every store rule (open, radius, stock, minimum order, fees, payment methods) to a cart. */
@Service
@RequiredArgsConstructor
public class StoreValidationService {

    private final StoreSettingsService settings;
    private final ProductVariantRepository variants;

    public double distanceKm(double lat1, double lng1, double lat2, double lng2) {
        return HaversineCalculator.distanceKm(lat1, lng1, lat2, lng2);
    }

    public boolean isWithinDeliveryRadius(BigDecimal lat, BigDecimal lng) {
        return checkLocation(lat, lng).serviceable();
    }

    public LocationCheckResponse checkLocation(BigDecimal lat, BigDecimal lng) {
        StoreRules rules = settings.rules();
        double distance = distanceKm(rules.storeLat().doubleValue(), rules.storeLng().doubleValue(),
                lat.doubleValue(), lng.doubleValue());
        return new LocationCheckResponse(Pricing.withinRadius(distance, rules.maxDeliveryRadiusKm()),
                roundKm(distance), rules.maxDeliveryRadiusKm());
    }

    /** Quote with current prices; variants are loaded here. */
    @Transactional(readOnly = true)
    public CartQuote validateCart(List<CartItem> items, Location location, PaymentMethod paymentMethod) {
        Map<Long, Integer> merged = merge(items);
        Map<Long, ProductVariant> loaded = variants.findAllWithProductByIdIn(merged.keySet()).stream()
                .collect(Collectors.toMap(ProductVariant::getId, Function.identity()));
        return quote(merged, loaded, location, paymentMethod, settings.rules());
    }

    /** Pure quote over already loaded variants (used by order placement inside its transaction). */
    public CartQuote quote(Map<Long, Integer> items, Map<Long, ProductVariant> loaded, Location location,
                           PaymentMethod paymentMethod, StoreRules rules) {
        List<QuoteLine> lines = new ArrayList<>();
        List<Long> inactive = new ArrayList<>();
        List<Long> outOfStock = new ArrayList<>();
        BigDecimal subtotal = Money.ZERO;

        for (Map.Entry<Long, Integer> item : items.entrySet()) {
            Long variantId = item.getKey();
            int qty = item.getValue();
            ProductVariant v = loaded.get(variantId);
            if (v == null || !v.isListed()) {
                inactive.add(variantId);
                lines.add(v == null
                        ? new QuoteLine(variantId, null, null, null, null, null, null, null, qty, Money.ZERO, LineIssue.VARIANT_INACTIVE)
                        : line(v, qty, LineIssue.VARIANT_INACTIVE));
                continue;
            }
            LineIssue issue = null;
            if (v.getStockQty() < qty) {
                outOfStock.add(variantId);
                issue = LineIssue.OUT_OF_STOCK;
            }
            QuoteLine line = line(v, qty, issue);
            subtotal = subtotal.add(line.lineTotal());
            lines.add(line);
        }
        subtotal = Money.scale(subtotal);

        Boolean serviceable = null;
        BigDecimal distance = null;
        if (location != null && location.lat() != null && location.lng() != null) {
            double km = distanceKm(rules.storeLat().doubleValue(), rules.storeLng().doubleValue(),
                    location.lat().doubleValue(), location.lng().doubleValue());
            serviceable = Pricing.withinRadius(km, rules.maxDeliveryRadiusKm());
            distance = roundKm(km);
        }

        List<PaymentMethod> allowed = rules.allowedPaymentMethods();
        List<Violation> violations = new ArrayList<>();
        if (!rules.storeOpen()) {
            violations.add(new Violation(ErrorCode.STORE_CLOSED,
                    rules.storeClosedMessage() != null ? rules.storeClosedMessage() : "The store is closed right now",
                    List.of()));
        }
        if (!inactive.isEmpty()) {
            violations.add(new Violation(ErrorCode.VARIANT_INACTIVE, "Some items are no longer available", inactive));
        }
        if (!outOfStock.isEmpty()) {
            violations.add(new Violation(ErrorCode.OUT_OF_STOCK, "Some items are out of stock", outOfStock));
        }
        if (Boolean.FALSE.equals(serviceable)) {
            violations.add(new Violation(ErrorCode.OUT_OF_RADIUS, "We don't deliver to this location yet ("
                    + distance + " km away, limit " + rules.maxDeliveryRadiusKm() + " km)", List.of()));
        }
        BigDecimal toMin = Pricing.amountToMinOrder(subtotal, rules.minOrderAmount());
        if (!Pricing.meetsMinimum(subtotal, rules.minOrderAmount())) {
            violations.add(new Violation(ErrorCode.BELOW_MIN_ORDER, "Add ₹" + toMin + " more to enable order", List.of()));
        }
        if (paymentMethod != null && !allowed.contains(paymentMethod)) {
            violations.add(new Violation(ErrorCode.PAYMENT_METHOD_DISABLED,
                    paymentMethod + " payment is not available right now", List.of()));
        }

        BigDecimal fee = Pricing.deliveryFee(subtotal, rules.deliveryCharge(), rules.freeDeliveryAbove());
        return new CartQuote(lines, subtotal, fee, Money.scale(subtotal.add(fee)), rules.minOrderAmount(), toMin,
                rules.freeDeliveryAbove(), Pricing.amountToFreeDelivery(subtotal, rules.freeDeliveryAbove()),
                serviceable, distance, rules.maxDeliveryRadiusKm(), allowed, paymentMethod, rules.storeOpen(),
                rules.storeClosedMessage(), violations);
    }

    static final int MAX_QTY_PER_ITEM = 50;

    /** Sums quantities of repeated variant ids, keeping first-seen order; the per-item limit applies to the sum. */
    public static Map<Long, Integer> merge(List<CartItem> items) {
        Map<Long, Integer> merged = new LinkedHashMap<>();
        for (CartItem item : items) {
            merged.merge(item.variantId(), item.qty(), Integer::sum);
        }
        if (merged.values().stream().anyMatch(qty -> qty > MAX_QTY_PER_ITEM)) {
            throw ApiException.validation("items", "at most " + MAX_QTY_PER_ITEM + " of each item per order");
        }
        return merged;
    }

    private static QuoteLine line(ProductVariant v, int qty, LineIssue issue) {
        return new QuoteLine(v.getId(), v.getProduct().getId(), v.getProduct().getName(), v.getProduct().getNameHi(), v.getLabel(),
                v.getProduct().getImageUrl(), v.getMrp(), v.getSellingPrice(), qty, Money.times(v.getSellingPrice(), qty),
                issue);
    }

    private static BigDecimal roundKm(double km) {
        // Round up so a refused point never displays as exactly the radius (5.004 km -> 5.01, not 5.00)
        return BigDecimal.valueOf(km).setScale(2, RoundingMode.UP);
    }
}
