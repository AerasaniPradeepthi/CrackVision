package com.crackvision.backend.security;

import com.crackvision.backend.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.function.Function;

@Service
public class JwtService {

    // 24 hours in milliseconds for development
    private static final long EXPIRATION_TIME_MS = 24 * 60 * 60 * 1000L;

    // Secure 256-bit key configured via CRACKVISION_JWT_SECRET environment variable
    @Value("${crackvision.jwt.secret:}")
    private String jwtSecret;

    @PostConstruct
    public void validateJwtSecret() {
        if (jwtSecret == null || jwtSecret.trim().isEmpty()) {
            throw new IllegalStateException(
                    "CRACKVISION_JWT_SECRET environment variable is missing or blank. " +
                    "A secure 256-bit (or longer) base64-encoded secret must be configured in Render environment variables."
            );
        }
        try {
            byte[] keyBytes = java.util.Base64.getDecoder().decode(jwtSecret.trim());
            if (keyBytes.length < 32) {
                throw new IllegalStateException(
                        "CRACKVISION_JWT_SECRET must provide at least 256 bits (32 bytes) of entropy when base64-decoded. " +
                        "Current length: " + (keyBytes.length * 8) + " bits."
                );
            }
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException(
                    "CRACKVISION_JWT_SECRET must be a valid base64-encoded string.", e
            );
        }
    }

    public void setJwtSecret(String jwtSecret) {
        this.jwtSecret = jwtSecret;
    }

    private SecretKey getSigningKey() {
        validateJwtSecret();
        byte[] keyBytes = java.util.Base64.getDecoder().decode(jwtSecret.trim());
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateToken(User user) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .subject(user.getEmail())
                .claim("role", user.getRole() != null ? user.getRole().name() : null)
                .issuedAt(new Date(now))
                .expiration(new Date(now + EXPIRATION_TIME_MS))
                .signWith(getSigningKey())
                .compact();
    }

    public Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    public String extractEmail(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public String extractUsername(String token) {
        return extractEmail(token);
    }

    public String extractRole(String token) {
        return extractClaim(token, claims -> claims.get("role", String.class));
    }

    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    public boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    public boolean validateToken(String token) {
        try {
            return !isTokenExpired(token);
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public boolean validateToken(String token, String email) {
        try {
            final String extracted = extractEmail(token);
            return (extracted != null && extracted.equals(email) && !isTokenExpired(token));
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }
}
