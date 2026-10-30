package com.kirana;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.utility.DockerImageName;

@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    /** Oracle's official MySQL image; override with MYSQL_IMAGE (e.g. mysql:8.4). */
    static final String DEFAULT_MYSQL_IMAGE = "container-registry.oracle.com/mysql/community-server:8.4";

    @Bean
    @ServiceConnection
    MySQLContainer<?> mysqlContainer() {
        String image = System.getenv().getOrDefault("MYSQL_IMAGE", DEFAULT_MYSQL_IMAGE);
        return new MySQLContainer<>(DockerImageName.parse(image).asCompatibleSubstituteFor("mysql"));
    }
}
