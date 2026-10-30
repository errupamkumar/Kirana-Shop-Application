package com.kirana;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

class KiranaApplicationTests extends IntegrationTest {

    @Test
    void contextLoadsAndHealthIsUp() throws Exception {
        get("/actuator/health", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void openApiDocsArePublic() throws Exception {
        get("/v3/api-docs", null).andExpect(status().isOk()).andExpect(jsonPath("$.info.title").value("Kirana Shop API"));
    }
}
