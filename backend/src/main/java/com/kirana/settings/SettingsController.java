package com.kirana.settings;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.security.Principal;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Settings")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class SettingsController {

    private final StoreSettingsService service;

    @GetMapping("/app/config")
    public AppConfigResponse appConfig() {
        return AppConfigResponse.from(service.rules());
    }

    @GetMapping("/admin/settings")
    public StoreRules getSettings() {
        return service.rules();
    }

    @PutMapping("/admin/settings")
    public StoreRules updateSettings(@Valid @RequestBody UpdateSettingsRequest request, Principal principal) {
        return service.update(request, principal.getName());
    }
}
