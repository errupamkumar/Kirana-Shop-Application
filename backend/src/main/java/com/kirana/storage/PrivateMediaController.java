package com.kirana.storage;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Serves request photos and voice notes behind signed, expiring links (Range requests work for audio seeking). */
@Tag(name = "Private media")
@RestController
@RequiredArgsConstructor
public class PrivateMediaController {

    private final PrivateMediaService media;

    @Operation(summary = "A request photo or voice note, by the signed link from the request")
    @GetMapping("/api/v1/media/private/{name}")
    public ResponseEntity<Resource> get(@PathVariable String name, @RequestParam long exp, @RequestParam String sig) {
        return media.open(name, exp, sig)
                .<ResponseEntity<Resource>>map(path -> ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(PrivateMediaService.contentType(name)))
                        .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePrivate())
                        .body(new FileSystemResource(path)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }
}
