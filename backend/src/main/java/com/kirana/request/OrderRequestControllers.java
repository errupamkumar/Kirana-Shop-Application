package com.kirana.request;

import com.kirana.auth.AuthPrincipal;
import com.kirana.common.PageResponse;
import com.kirana.request.OrderRequestDtos.AcceptRequest;
import com.kirana.request.OrderRequestDtos.AdminRequestDto;
import com.kirana.request.OrderRequestDtos.CountsDto;
import com.kirana.request.OrderRequestDtos.RejectRequest;
import com.kirana.request.OrderRequestDtos.RequestDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

public final class OrderRequestControllers {

    private OrderRequestControllers() {
    }

    @Tag(name = "Order requests (app)")
    @RestController
    @RequestMapping("/api/v1/app/order-requests")
    @RequiredArgsConstructor
    public static class AppOrderRequestController {

        private final OrderRequestService requests;

        @Operation(summary = "Send a photo of a handwritten list and/or a voice note (multipart)")
        @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
        @ResponseStatus(HttpStatus.CREATED)
        public RequestDto create(@AuthenticationPrincipal AuthPrincipal me,
                                 @RequestParam Long addressId,
                                 @RequestPart(required = false) MultipartFile image,
                                 @RequestPart(required = false) MultipartFile audio,
                                 @RequestParam(required = false) Integer audioSeconds,
                                 @RequestParam(required = false) String note) {
            return requests.create(me.id(), addressId, image, audio, audioSeconds, note);
        }

        @GetMapping("/my")
        public PageResponse<RequestDto> mine(@AuthenticationPrincipal AuthPrincipal me,
                                             @RequestParam(required = false) Integer page,
                                             @RequestParam(required = false) Integer size) {
            return requests.mine(me.id(), page, size);
        }

        @GetMapping("/{id}")
        public RequestDto one(@AuthenticationPrincipal AuthPrincipal me, @PathVariable Long id) {
            return requests.mine(me.id(), id);
        }

        @PostMapping("/{id}/cancel")
        public RequestDto cancel(@AuthenticationPrincipal AuthPrincipal me, @PathVariable Long id) {
            return requests.cancel(me.id(), id);
        }
    }

    @Tag(name = "Order requests (admin)")
    @RestController
    @RequestMapping("/api/v1/admin/order-requests")
    @RequiredArgsConstructor
    public static class AdminOrderRequestController {

        private final OrderRequestService requests;

        @GetMapping
        public PageResponse<AdminRequestDto> list(@RequestParam(required = false) OrderRequestStatus status,
                                                  @RequestParam(required = false) Integer page,
                                                  @RequestParam(required = false) Integer size) {
            return requests.list(status, page, size);
        }

        @GetMapping("/counts")
        public CountsDto counts() {
            return new CountsDto(requests.pendingCount());
        }

        @GetMapping("/{id}")
        public AdminRequestDto one(@PathVariable Long id) {
            return requests.get(id);
        }

        @Operation(summary = "Accept: create the order (catalog items and/or free-text items); it starts as ACCEPTED")
        @PostMapping("/{id}/accept")
        public AdminRequestDto accept(@AuthenticationPrincipal AuthPrincipal me, @PathVariable Long id,
                                      @Valid @RequestBody AcceptRequest request) {
            return requests.accept(me.id(), id, request);
        }

        @PostMapping("/{id}/reject")
        public AdminRequestDto reject(@AuthenticationPrincipal AuthPrincipal me, @PathVariable Long id,
                                      @Valid @RequestBody RejectRequest request) {
            return requests.reject(me.id(), id, request.reason());
        }
    }
}
