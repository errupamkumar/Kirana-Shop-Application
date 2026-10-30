package com.kirana.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Clock;
import java.time.Duration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableCaching
@EnableScheduling
@EnableConfigurationProperties(AppProperties.class)
public class AppConfig {

    public static final String SETTINGS_CACHE = "storeSettings";

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager(SETTINGS_CACHE);
        // Evicted on every settings update; the TTL only bounds staleness across instances
        manager.setCaffeine(Caffeine.newBuilder().expireAfterWrite(Duration.ofMinutes(10)).maximumSize(10));
        return manager;
    }
}
