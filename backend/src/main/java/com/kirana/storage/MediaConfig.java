package com.kirana.storage;

import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Serves catalog images from MEDIA_DIR/images at /media/images/**. Other folders (request photos and voice notes)
 * are private and only reachable through signed links, see {@link PrivateMediaService}.
 */
@Configuration
@RequiredArgsConstructor
public class MediaConfig implements WebMvcConfigurer {

    private final LocalStorageService storage;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/media/images/**")
                // Trailing slash required: toUri() adds it only when the folder already exists
                .addResourceLocations(withSlash(storage.root().resolve("images").toUri().toString()))
                .setCacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic());
    }

    private static String withSlash(String location) {
        return location.endsWith("/") ? location : location + "/";
    }
}
