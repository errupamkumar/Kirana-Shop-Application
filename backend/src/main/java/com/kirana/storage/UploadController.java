package com.kirana.storage;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Uploads (admin)")
@RestController
@RequiredArgsConstructor
public class UploadController {

    private final StorageService storage;

    @PostMapping(path = "/api/v1/admin/uploads/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> uploadImage(@RequestParam("file") MultipartFile file) {
        return Map.of("url", storage.storeImage(file));
    }
}
