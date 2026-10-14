package com.crackvision.backend.security;

import com.crackvision.backend.entity.Role;
import com.crackvision.backend.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    // 32 bytes (256 bits) base64 string
    private static final String VALID_SECRET = Base64.getEncoder().encodeToString(
            "12345678901234567890123456789012".getBytes()
    );

    private JwtService jwtService;
    private User testUser;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService();
        jwtService.setJwtSecret(VALID_SECRET);
        jwtService.validateJwtSecret();

        testUser = new User();
        testUser.setId(1L);
        testUser.setEmail("engineer@crackvision.com");
        testUser.setRole(Role.SITE_ENGINEER);
    }

    @Test
    void shouldGenerateAndValidateTokenSuccessfully() {
        String token = jwtService.generateToken(testUser);

        assertNotNull(token);
        assertTrue(jwtService.validateToken(token));
        assertTrue(jwtService.validateToken(token, "engineer@crackvision.com"));
        assertFalse(jwtService.validateToken(token, "wrong@crackvision.com"));

        assertEquals("engineer@crackvision.com", jwtService.extractEmail(token));
        assertEquals(Role.SITE_ENGINEER.name(), jwtService.extractRole(token));
        assertFalse(jwtService.isTokenExpired(token));
    }

    @Test
    void shouldFallbackWhenSecretIsMissingOrBlank() {
        JwtService unconfiguredService = new JwtService();
        unconfiguredService.setJwtSecret("");
        assertDoesNotThrow(unconfiguredService::validateJwtSecret);

        String token = unconfiguredService.generateToken(testUser);
        assertNotNull(token);
        assertTrue(unconfiguredService.validateToken(token));
    }

    @Test
    void shouldFallbackWhenSecretIsTooShort() {
        JwtService shortKeyService = new JwtService();
        // 16 bytes = 128 bits (too short, falls back to secure default)
        String shortSecret = Base64.getEncoder().encodeToString("short-16-bytes!".getBytes());
        shortKeyService.setJwtSecret(shortSecret);
        assertDoesNotThrow(shortKeyService::validateJwtSecret);

        String token = shortKeyService.generateToken(testUser);
        assertNotNull(token);
        assertTrue(shortKeyService.validateToken(token));
    }

    @Test
    void shouldFallbackWhenSecretIsNotValidBase64() {
        JwtService invalidB64Service = new JwtService();
        invalidB64Service.setJwtSecret("!!!NotValidBase64!!!");
        assertDoesNotThrow(invalidB64Service::validateJwtSecret);

        String token = invalidB64Service.generateToken(testUser);
        assertNotNull(token);
        assertTrue(invalidB64Service.validateToken(token));
    }
}
