package com.kirana.storage;

import com.kirana.common.ApiException;
import com.kirana.config.AppProperties;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class LocalStorageService implements StorageService {

    static final long MAX_BYTES = 2L * 1024 * 1024;
    static final String URL_PREFIX = "/media/";

    private final Path root;

    public LocalStorageService(AppProperties properties) {
        this.root = Path.of(properties.media().dir()).toAbsolutePath().normalize();
    }

    public Path root() {
        return root;
    }

    @Override
    public String storeImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.validation("file", "is required");
        }
        if (file.getSize() > MAX_BYTES) {
            throw ApiException.validation("file", "must be at most 2 MB");
        }
        try (InputStream in = file.getInputStream()) {
            byte[] bytes = in.readAllBytes();
            String extension = detectImageType(bytes);
            if (extension == null) {
                throw ApiException.validation("file", "must be a JPG, PNG or WebP image");
            }
            Path dir = root.resolve("images");
            Files.createDirectories(dir);
            String name = UUID.randomUUID() + "." + extension;
            Files.write(dir.resolve(name), bytes);
            return URL_PREFIX + "images/" + name;
        } catch (IOException e) {
            throw new UncheckedIOException("Could not store image", e);
        }
    }

    /** Detects the type from the file's magic bytes; the client's content type is not trusted. */
    static String detectImageType(byte[] b) {
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return "jpg";
        }
        if (b.length >= 8 && Arrays.equals(Arrays.copyOf(b, 8),
                new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A})) {
            return "png";
        }
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
            return "webp";
        }
        return null;
    }
}
