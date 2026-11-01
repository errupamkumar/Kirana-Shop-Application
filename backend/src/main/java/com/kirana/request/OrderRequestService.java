package com.kirana.request;

import com.kirana.checkout.CheckoutDtos.LocationCheckResponse;
import com.kirana.checkout.StoreValidationService;
import com.kirana.common.ApiException;
import com.kirana.common.ErrorCode;
import com.kirana.common.PageResponse;
import com.kirana.common.Pages;
import com.kirana.customer.CustomerService;
import com.kirana.customer.User;
import com.kirana.customer.UserAddress;
import com.kirana.order.CustomerOrder;
import com.kirana.order.CustomerOrderRepository;
import com.kirana.order.OrderDtos.AddressSnapshot;
import com.kirana.order.OrderDtos.DraftLine;
import com.kirana.order.OrderDtos.RequestOrderDraft;
import com.kirana.order.OrderService;
import com.kirana.request.OrderRequestDtos.AcceptRequest;
import com.kirana.request.OrderRequestDtos.AdminRequestDto;
import com.kirana.request.OrderRequestDtos.CatalogLine;
import com.kirana.request.OrderRequestDtos.RequestDto;
import com.kirana.settings.StoreRules;
import com.kirana.settings.StoreSettingsService;
import com.kirana.storage.PrivateMediaService;
import com.kirana.storage.PrivateMediaService.Kind;
import com.kirana.storage.PrivateMediaService.Stored;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Order requests: a customer sends a photo of a handwritten list and/or a voice note with a delivery address; the
 * store either builds the order from it (accept) or declines with a reason (reject).
 */
@Service
@RequiredArgsConstructor
public class OrderRequestService {

    /** Waiting requests per customer, so one person cannot flood the store's queue. */
    static final int MAX_PENDING_PER_CUSTOMER = 3;
    static final int MAX_AUDIO_SECONDS = 300;
    static final int MAX_NOTE = 500;

    private final OrderRequestRepository requests;
    private final CustomerOrderRepository orders;
    private final OrderService orderService;
    private final CustomerService customers;
    private final StoreSettingsService settings;
    private final StoreValidationService validation;
    private final PrivateMediaService media;
    private final Clock clock;

    // ---------- customer ----------

    @Transactional
    public RequestDto create(Long userId, Long addressId, MultipartFile image, MultipartFile audio, Integer audioSeconds,
                             String note) {
        if ((image == null || image.isEmpty()) && (audio == null || audio.isEmpty())) {
            throw ApiException.validation("image", "send a photo of your list or a voice note");
        }
        if (addressId == null) {
            throw ApiException.validation("addressId", "is required");
        }
        String trimmedNote = note == null || note.isBlank() ? null : note.trim();
        if (trimmedNote != null && trimmedNote.length() > MAX_NOTE) {
            throw ApiException.validation("note", "must be at most " + MAX_NOTE + " characters");
        }
        if (requests.countByUserIdAndStatus(userId, OrderRequestStatus.PENDING) >= MAX_PENDING_PER_CUSTOMER) {
            throw new ApiException(ErrorCode.TOO_MANY_ATTEMPTS,
                    "You already have " + MAX_PENDING_PER_CUSTOMER + " requests waiting. Please wait for the store to reply.");
        }
        StoreRules rules = settings.rules();
        if (!rules.storeOpen()) {
            throw new ApiException(ErrorCode.STORE_CLOSED,
                    rules.storeClosedMessage() == null ? "The store is closed right now" : rules.storeClosedMessage());
        }
        User user = customers.user(userId);
        UserAddress address = customers.address(userId, addressId);
        LocationCheckResponse location = validation.checkLocation(address.getLat(), address.getLng());
        if (!location.serviceable()) {
            throw new ApiException(ErrorCode.OUT_OF_RADIUS, "We don't deliver to this address yet ("
                    + location.distanceKm() + " km away, limit " + location.radiusKm() + " km)");
        }

        Stored photo = media.store(image, Kind.IMAGE, "image");
        Stored voice = media.store(audio, Kind.AUDIO, "audio");

        OrderRequest r = new OrderRequest();
        r.setUserId(userId);
        r.setStatus(OrderRequestStatus.PENDING);
        r.setImagePath(photo == null ? null : photo.name());
        r.setAudioPath(voice == null ? null : voice.name());
        r.setAudioSeconds(voice == null || audioSeconds == null ? null : Math.clamp(audioSeconds, 0, MAX_AUDIO_SECONDS));
        r.setNote(trimmedNote);
        r.setAddrLabel(address.getLabel());
        r.setAddrName(user.getName());
        r.setAddrPhone(user.getPhone());
        r.setAddrLine1(address.getLine1());
        r.setAddrLine2(address.getLine2());
        r.setAddrLandmark(address.getLandmark());
        r.setAddrPincode(address.getPincode());
        r.setAddrLat(address.getLat());
        r.setAddrLng(address.getLng());
        r.setDistanceKm(location.distanceKm());
        requests.saveAndFlush(r);
        return customerDto(r, null);
    }

    @Transactional(readOnly = true)
    public PageResponse<RequestDto> mine(Long userId, Integer page, Integer size) {
        Page<OrderRequest> result = requests.findByUserIdOrderByCreatedAtDesc(userId, Pages.of(page, size, Sort.unsorted()));
        Map<Long, CustomerOrder> linked = linkedOrders(result.getContent());
        return PageResponse.of(result, result.getContent().stream().map(r -> customerDto(r, linkedOrder(linked, r))).toList());
    }

    @Transactional(readOnly = true)
    public RequestDto mine(Long userId, Long id) {
        OrderRequest r = requests.findById(id).filter(x -> x.getUserId().equals(userId))
                .orElseThrow(() -> ApiException.notFound("Order request"));
        return customerDto(r, order(r));
    }

    @Transactional
    public RequestDto cancel(Long userId, Long id) {
        OrderRequest r = lock(id);
        if (!r.getUserId().equals(userId)) {
            throw ApiException.notFound("Order request");
        }
        requirePending(r);
        r.setStatus(OrderRequestStatus.CANCELLED);
        r.setHandledAt(Instant.now(clock));
        return customerDto(r, null);
    }

    // ---------- store ----------

    @Transactional(readOnly = true)
    public PageResponse<AdminRequestDto> list(OrderRequestStatus status, Integer page, Integer size) {
        Page<OrderRequest> result = status == null
                ? requests.findAllByOrderByCreatedAtDesc(Pages.of(page, size, Sort.unsorted()))
                : requests.findByStatusOrderByCreatedAtDesc(status, Pages.of(page, size, Sort.unsorted()));
        Map<Long, CustomerOrder> linked = linkedOrders(result.getContent());
        return PageResponse.of(result, result.getContent().stream().map(r -> adminDto(r, linkedOrder(linked, r))).toList());
    }

    @Transactional(readOnly = true)
    public AdminRequestDto get(Long id) {
        OrderRequest r = requests.findById(id).orElseThrow(() -> ApiException.notFound("Order request"));
        return adminDto(r, order(r));
    }

    @Transactional(readOnly = true)
    public long pendingCount() {
        return requests.countByStatus(OrderRequestStatus.PENDING);
    }

    @Transactional
    public AdminRequestDto reject(Long adminId, Long id, String reason) {
        OrderRequest r = lock(id);
        requirePending(r);
        r.setStatus(OrderRequestStatus.REJECTED);
        r.setRejectReason(reason.trim());
        r.setHandledBy(adminId);
        r.setHandledAt(Instant.now(clock));
        return adminDto(r, null);
    }

    /** Builds the order from what the store found on the list (or heard), then links it to the request. */
    @Transactional
    public AdminRequestDto accept(Long adminId, Long id, AcceptRequest req) {
        OrderRequest r = lock(id);
        requirePending(r);
        Map<Long, Integer> items = new TreeMap<>();
        for (CatalogLine line : req.items() == null ? List.<CatalogLine>of() : req.items()) {
            items.merge(line.variantId(), line.qty(), Integer::sum);
        }
        List<DraftLine> custom = (req.customItems() == null ? List.<OrderRequestDtos.CustomLine>of() : req.customItems())
                .stream()
                .map(c -> new DraftLine(c.name(), c.label(), c.price(), c.qty()))
                .toList();
        CustomerOrder order = orderService.createFromRequest(adminId, new RequestOrderDraft(r.getUserId(), r.getId(),
                r.getCreatedAt(), address(r), r.getDistanceKm(), items, custom, r.getNote(), req.note()));
        r.setStatus(OrderRequestStatus.ACCEPTED);
        r.setOrderId(order.getId());
        r.setHandledBy(adminId);
        r.setHandledAt(Instant.now(clock));
        return adminDto(r, order);
    }

    // ---------- mapping ----------

    private RequestDto customerDto(OrderRequest r, CustomerOrder order) {
        return new RequestDto(r.getId(), r.getStatus(), media.signedUrl(r.getImagePath()), media.signedUrl(r.getAudioPath()),
                r.getAudioSeconds(), r.getNote(), address(r), r.getOrderId(),
                order == null ? null : order.getOrderNumber(), order == null ? null : order.getStatus(),
                order == null ? null : order.getTotal(), r.getRejectReason(), r.getCreatedAt(), r.getHandledAt());
    }

    private AdminRequestDto adminDto(OrderRequest r, CustomerOrder order) {
        return new AdminRequestDto(r.getId(), r.getStatus(), media.signedUrl(r.getImagePath()),
                media.signedUrl(r.getAudioPath()), r.getAudioSeconds(), r.getNote(), r.getAddrName(), r.getAddrPhone(),
                address(r), r.getDistanceKm(), r.getOrderId(), order == null ? null : order.getOrderNumber(),
                order == null ? null : order.getStatus(), order == null ? null : order.getTotal(), r.getRejectReason(),
                r.getCreatedAt(), r.getHandledAt());
    }

    private static AddressSnapshot address(OrderRequest r) {
        return new AddressSnapshot(r.getAddrLabel(), r.getAddrName(), r.getAddrPhone(), r.getAddrLine1(), r.getAddrLine2(),
                r.getAddrLandmark(), r.getAddrPincode(), r.getAddrLat(), r.getAddrLng());
    }

    private CustomerOrder order(OrderRequest r) {
        return r.getOrderId() == null ? null : orders.findById(r.getOrderId()).orElse(null);
    }

    private Map<Long, CustomerOrder> linkedOrders(List<OrderRequest> list) {
        List<Long> ids = list.stream().map(OrderRequest::getOrderId).filter(Objects::nonNull).toList();
        return ids.isEmpty() ? Map.of()
                : orders.findAllById(ids).stream().collect(Collectors.toMap(CustomerOrder::getId, Function.identity()));
    }

    /** Map.of() rejects null keys, and most requests have no order yet. */
    private static CustomerOrder linkedOrder(Map<Long, CustomerOrder> linked, OrderRequest r) {
        return r.getOrderId() == null ? null : linked.get(r.getOrderId());
    }

    private OrderRequest lock(Long id) {
        return requests.findByIdForUpdate(id).orElseThrow(() -> ApiException.notFound("Order request"));
    }

    private static void requirePending(OrderRequest r) {
        if (r.getStatus() != OrderRequestStatus.PENDING) {
            throw new ApiException(ErrorCode.INVALID_STATUS_TRANSITION,
                    "This request was already " + r.getStatus().name().toLowerCase(java.util.Locale.ROOT),
                    Map.of("status", r.getStatus()));
        }
    }
}
