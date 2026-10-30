package com.kirana.storage;

import org.springframework.web.multipart.MultipartFile;

/** Stores uploaded media and returns the path clients use to load it. Local disk now, S3 later. */
public interface StorageService {

    /** Validates (jpg/png/webp, max 2 MB) and stores an image; returns e.g. {@code /media/images/<uuid>.jpg}. */
    String storeImage(MultipartFile file);
}
