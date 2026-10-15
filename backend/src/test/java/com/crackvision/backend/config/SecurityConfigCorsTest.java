package com.crackvision.backend.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import static org.junit.jupiter.api.Assertions.*;

class SecurityConfigCorsTest {

    @Test
    @DisplayName("CORS configuration properly validates explicit domains and *.vercel.app wildcards with credentials")
    void testCorsAllowedOriginPatterns() {
        SecurityConfig securityConfig = new SecurityConfig(null);
        String origins = "https://crack-vision.vercel.app,https://*.vercel.app,https://crackvision.vercel.app,http://localhost:3000,http://localhost:5173";
        ReflectionTestUtils.setField(securityConfig, "allowedOrigins", origins);

        CorsConfigurationSource source = securityConfig.corsConfigurationSource();
        assertNotNull(source);

        MockHttpServletRequest request = new MockHttpServletRequest();
        CorsConfiguration config = source.getCorsConfiguration(request);
        assertNotNull(config);

        // 1. Verify exact production frontend matches
        assertEquals("https://crack-vision.vercel.app", config.checkOrigin("https://crack-vision.vercel.app"));

        // 2. Verify Vercel preview deployments (*.vercel.app) match
        assertEquals("https://preview-abc123.vercel.app", config.checkOrigin("https://preview-abc123.vercel.app"));
        assertEquals("https://my-branch.vercel.app", config.checkOrigin("https://my-branch.vercel.app"));

        // 3. Verify local development origins match
        assertEquals("http://localhost:3000", config.checkOrigin("http://localhost:3000"));
        assertEquals("http://localhost:5173", config.checkOrigin("http://localhost:5173"));

        // 4. Verify unpermitted domains are strictly rejected (return null)
        assertNull(config.checkOrigin("https://evil.com"));
        assertNull(config.checkOrigin("https://attacker.vercel.app.fake.com"));
        assertNull(config.checkOrigin("http://crack-vision.vercel.app")); // HTTP rejected when HTTPS configured
    }
}
