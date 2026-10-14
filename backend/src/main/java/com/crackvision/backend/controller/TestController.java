package com.crackvision.backend.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class TestController {

    private static final Logger log = LoggerFactory.getLogger(TestController.class);

    private final DataSource dataSource;

    public TestController(@Autowired(required = false) DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @GetMapping("/test")
    public String test() {
        return "CrackVision Backend is running";
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("service", "CrackVision Backend");
        body.put("timestamp", Instant.now().toString());

        if (dataSource == null) {
            log.warn("Database health probe failed: DataSource bean is null/unconfigured");
            body.put("status", "DOWN");
            body.put("database", "UNCONFIGURED");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(body);
        }

        try (Connection conn = dataSource.getConnection()) {
            boolean valid = conn != null && conn.isValid(2);
            if (valid) {
                body.put("status", "UP");
                body.put("database", "CONNECTED");
                return ResponseEntity.ok(body);
            } else {
                log.warn("Database health probe reported invalid connection");
                body.put("status", "DOWN");
                body.put("database", "UNHEALTHY");
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(body);
            }
        } catch (Exception e) {
            log.error("Database health check probe failed: {}", e.getMessage());
            body.put("status", "DOWN");
            body.put("database", "DISCONNECTED");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(body);
        }
    }
}
