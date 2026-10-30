package com.kirana.storage;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

/**
 * Copies the starter catalog photos bundled in the jar (seed-images/) to MEDIA_DIR/images/seed/ when they are
 * missing, so the image URLs set by the V3 migration work on a fresh server. Existing files are never overwritten.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CatalogImageSeeder implements ApplicationRunner {

    static final String CLASSPATH_PATTERN = "classpath*:seed-images/*.*";

    private final LocalStorageService storage;

    @Override
    public void run(ApplicationArguments args) throws IOException {
        Path target = storage.root().resolve("images").resolve("seed");
        Files.createDirectories(target);
        int copied = 0;
        for (Resource resource : new PathMatchingResourcePatternResolver().getResources(CLASSPATH_PATTERN)) {
            String name = resource.getFilename();
            if (name == null || !name.matches("[a-z0-9-]+\\.(jpg|png|webp)")) {
                continue;
            }
            Path file = target.resolve(name);
            if (Files.exists(file)) {
                continue;
            }
            try (InputStream in = resource.getInputStream()) {
                Files.copy(in, file);
                copied++;
            }
        }
        if (copied > 0) {
            log.info("Copied {} starter catalog image(s) to {}", copied, target);
        }
    }
}
