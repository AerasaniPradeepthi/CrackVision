package com.crackvision.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@TestPropertySource(properties = {
    "crackvision.jwt.secret=dGVzdC1qd3Qtc2VjcmV0LWtleS1mb3ItY3JhY2t2aXNpb24tdGVzdHMtMjU2Yml0cw=="
})
class CrackVisionBackendApplicationTests {

    @Test
    void contextLoads() {
    }

}
