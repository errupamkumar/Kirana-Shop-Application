package com.kirana.dashboard;

import com.kirana.dashboard.DashboardService.DashboardResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Dashboard (admin)")
@RestController
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService service;

    @GetMapping("/api/v1/admin/dashboard")
    public DashboardResponse dashboard() {
        return service.dashboard();
    }
}
