package com.crackvision.backend.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/**
 * Controller to serve and proxy AI screening highlighted images.
 * Serves generated overlay images from local disk in development,
 * and proxies from the Python computer-vision service if running as an external microservice.
 */
@RestController
public class AiOutputImageController {

    private static final Logger log = LoggerFactory.getLogger(AiOutputImageController.class);

    private static final Pattern SAFE_FILENAME_PATTERN =
            Pattern.compile("^[a-zA-Z0-9_-]+\\.(png|jpg|jpeg|webp)$", Pattern.CASE_INSENSITIVE);

    private static final List<String> LOCAL_OUTPUT_DIRS =
            List.of("ai-service/outputs", "outputs", "../ai-service/outputs");

    private final RestClient aiRestClient;

    @Autowired
    public AiOutputImageController(
            @Value("${crackvision.ai-service.url:http://127.0.0.1:8000}") String aiServiceUrl,
            @Value("${crackvision.ai-service.connect-timeout-ms:15000}") int connectTimeoutMs,
            @Value("${crackvision.ai-service.read-timeout-ms:60000}") int readTimeoutMs) {

        String resolvedUrl = com.crackvision.backend.service.AiAnalysisService.normalizeAiServiceUrl(aiServiceUrl);
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Math.max(connectTimeoutMs, 10000));
        requestFactory.setReadTimeout(Math.max(readTimeoutMs, 30000));

        this.aiRestClient = RestClient.builder()
                .baseUrl(resolvedUrl)
                .requestFactory(requestFactory)
                .build();
    }

    // Constructor for testing with custom RestClient
    public AiOutputImageController(RestClient aiRestClient) {
        this.aiRestClient = aiRestClient;
    }

    /**
     * Serves an AI detection highlighted output image.
     * Enforces strict filename pattern, extension verification, and path-traversal protection.
     */
    @GetMapping(value = {"/outputs/{filename}", "/api/outputs/{filename}"})
    public ResponseEntity<byte[]> getHighlightedImage(@PathVariable String filename) {
        if (filename == null || filename.isBlank() || !SAFE_FILENAME_PATTERN.matcher(filename).matches() || filename.contains("..")) {
            return ResponseEntity.badRequest().build();
        }

        MediaType mediaType = resolveMediaType(filename);

        // 1. Check local directories on disk (for local dev and local container volumes)
        for (String dir : LOCAL_OUTPUT_DIRS) {
            try {
                Path baseDir = Paths.get(dir).toAbsolutePath().normalize();
                Path filePath = baseDir.resolve(filename).normalize();

                // Enforce directory containment
                if (!filePath.startsWith(baseDir)) {
                    continue;
                }

                if (Files.exists(filePath) && Files.isReadable(filePath) && !Files.isDirectory(filePath)) {
                    byte[] bytes = Files.readAllBytes(filePath);
                    return ResponseEntity.ok()
                            .contentType(mediaType)
                            .cacheControl(CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic())
                            .body(bytes);
                }
            } catch (Exception ignored) {
            }
        }

        // 2. Proxy request to Python AI microservice if running remotely or on another port
        try {
            byte[] remoteBytes = aiRestClient.get()
                    .uri("/outputs/" + filename)
                    .retrieve()
                    .body(byte[].class);

            if (remoteBytes != null && remoteBytes.length > 0) {
                return ResponseEntity.ok()
                        .contentType(mediaType)
                        .cacheControl(CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic())
                        .body(remoteBytes);
            }
        } catch (Exception e) {
            log.debug("Remote AI service proxy could not resolve overlay [{}]: {}", filename, e.getMessage());
        }

        // 3. Not found
        return ResponseEntity.notFound().build();
    }

    private MediaType resolveMediaType(String filename) {
        String lower = filename.toLowerCase();
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
            return MediaType.IMAGE_JPEG;
        }
        if (lower.endsWith(".webp")) {
            return MediaType.valueOf("image/webp");
        }
        return MediaType.IMAGE_PNG;
    }
}
