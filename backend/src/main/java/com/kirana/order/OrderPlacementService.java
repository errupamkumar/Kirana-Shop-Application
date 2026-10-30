package com.kirana.order;

import com.kirana.common.ApiException;
import com.kirana.common.ErrorCode;
import com.kirana.order.OrderDtos.OrderDetailDto;
import com.kirana.order.OrderDtos.PlaceOrderRequest;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

/** Idempotent wrapper around {@link OrderService#place}: a repeated Idempotency-Key returns the original order. */
@Service
@RequiredArgsConstructor
public class OrderPlacementService {

    private final OrderService orderService;
    private final OrderQueryService queries;
    private final IdempotencyKeyRepository idempotencyKeys;

    public record Result(OrderDetailDto order, boolean created) {
    }

    public Result place(Long userId, PlaceOrderRequest request, String key) {
        String idempotencyKey = key.trim();
        if (idempotencyKey.isEmpty() || idempotencyKey.length() > 100) {
            throw ApiException.validation("Idempotency-Key", "must be 1 to 100 characters");
        }
        Optional<Result> replay = replay(userId, idempotencyKey);
        if (replay.isPresent()) {
            return replay.get();
        }
        try {
            CustomerOrder order = orderService.place(userId, request, idempotencyKey);
            return new Result(queries.customerOrder(userId, order.getId()), true);
        } catch (DataIntegrityViolationException e) {
            // A concurrent request with the same key committed first
            return replay(userId, idempotencyKey).orElseThrow(() -> new ApiException(ErrorCode.VALIDATION_ERROR,
                    "This order is already being processed, please refresh"));
        }
    }

    private Optional<Result> replay(Long userId, String key) {
        return idempotencyKeys.findByUserIdAndKey(userId, key)
                .filter(k -> k.getOrderId() != null)
                .map(k -> new Result(queries.customerOrder(userId, k.getOrderId()), false));
    }
}
