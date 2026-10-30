package com.kirana.order;

import com.kirana.auth.AuthPrincipal;
import com.kirana.common.PageResponse;
import com.kirana.order.OrderDtos.CancelRequest;
import com.kirana.order.OrderDtos.InvoiceDto;
import com.kirana.order.OrderDtos.OrderDetailDto;
import com.kirana.order.OrderDtos.OrderSummaryDto;
import com.kirana.order.OrderDtos.PlaceOrderRequest;
import com.kirana.order.OrderDtos.StatusUpdateRequest;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

public final class OrderControllers {

    private OrderControllers() {
    }

    @Tag(name = "Orders (app)")
    @RestController
    @RequestMapping("/api/v1/app/orders")
    @RequiredArgsConstructor
    public static class AppOrderController {

        private final OrderPlacementService placement;
        private final OrderService orders;
        private final OrderQueryService queries;

        /** 201 for a new order, 200 when the Idempotency-Key was already used (returns that order). */
        @PostMapping
        public ResponseEntity<OrderDetailDto> place(@AuthenticationPrincipal AuthPrincipal me,
                                                    @RequestHeader("Idempotency-Key") String idempotencyKey,
                                                    @Valid @RequestBody PlaceOrderRequest request) {
            OrderPlacementService.Result result = placement.place(me.id(), request, idempotencyKey);
            return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result.order());
        }

        @GetMapping("/my")
        public PageResponse<OrderSummaryDto> myOrders(@AuthenticationPrincipal AuthPrincipal me,
                                                      @RequestParam(required = false) Integer page,
                                                      @RequestParam(required = false) Integer size) {
            return queries.myOrders(me.id(), page, size);
        }

        @GetMapping("/{id}")
        public OrderDetailDto order(@AuthenticationPrincipal AuthPrincipal me, @PathVariable Long id) {
            return queries.customerOrder(me.id(), id);
        }

        @PostMapping("/{id}/cancel")
        public OrderDetailDto cancel(@AuthenticationPrincipal AuthPrincipal me, @PathVariable Long id,
                                     @Valid @RequestBody(required = false) CancelRequest request) {
            orders.cancelByCustomer(me.id(), id, request == null ? null : request.reason());
            return queries.customerOrder(me.id(), id);
        }
    }

    @Tag(name = "Orders (admin)")
    @RestController
    @RequestMapping("/api/v1/admin/orders")
    @RequiredArgsConstructor
    public static class AdminOrderController {

        private final OrderService orders;
        private final OrderQueryService queries;

        @GetMapping
        public PageResponse<OrderSummaryDto> list(@RequestParam(required = false) OrderStatus status,
                                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                                  @RequestParam(required = false) String q,
                                                  @RequestParam(required = false) Integer page,
                                                  @RequestParam(required = false) Integer size) {
            return queries.adminOrders(status, from, to, q, page, size);
        }

        @GetMapping("/{id}")
        public OrderDetailDto order(@PathVariable Long id) {
            return queries.adminOrder(id);
        }

        @PatchMapping("/{id}/status")
        public OrderDetailDto updateStatus(@AuthenticationPrincipal AuthPrincipal me, @PathVariable Long id,
                                           @Valid @RequestBody StatusUpdateRequest request) {
            orders.updateStatusByAdmin(me.id(), id, request.status(), request.note());
            return queries.adminOrder(id);
        }

        @GetMapping("/{id}/invoice")
        public InvoiceDto invoice(@PathVariable Long id) {
            return queries.invoice(id);
        }
    }
}
