package com.crackvision.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Pattern;

/**
 * Service for managing Cloudinary storage, SSRF-safe URL validation, and photo uploads.
 */
@Service
public class CloudinaryService {

    private static final Logger log = LoggerFactory.getLogger(CloudinaryService.class);

    private static final Pattern CLOUDINARY_HOST_PATTERN =
            Pattern.compile("^(res|api)\\.cloudinary\\.com$", Pattern.CASE_INSENSITIVE);

    private final String cloudName;
    private final String apiKey;
    private final String apiSecret;
    private final String uploadPreset;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public CloudinaryService(
            @Value("${crackvision.cloudinary.cloud-name:}") String cloudName,
            @Value("${crackvision.cloudinary.api-key:}") String apiKey,
            @Value("${crackvision.cloudinary.api-secret:}") String apiSecret,
            @Value("${crackvision.cloudinary.upload-preset:}") String uploadPreset) {
        this.cloudName = cloudName != null ? cloudName.trim() : "";
        this.apiKey = apiKey != null ? apiKey.trim() : "";
        this.apiSecret = apiSecret != null ? apiSecret.trim() : "";
        this.uploadPreset = uploadPreset != null ? uploadPreset.trim() : "";

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(8000);
        requestFactory.setReadTimeout(30000);

        this.restClient = RestClient.builder()
                .requestFactory(requestFactory)
                .build();
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Checks if Cloudinary is configured for uploads (either via upload preset or API key + secret).
     */
    public boolean isConfigured() {
        return !cloudName.isBlank() && (!uploadPreset.isBlank() || (!apiKey.isBlank() && !apiSecret.isBlank()));
    }

    public String getCloudName() {
        return cloudName;
    }

    /**
     * Determines if a given string looks like a Cloudinary URL.
     */
    public static boolean isCloudinaryUrl(String url) {
        if (url == null || url.isBlank()) {
            return false;
        }
        String trimmed = url.trim().toLowerCase(Locale.ROOT);
        return trimmed.startsWith("https://") && trimmed.contains(".cloudinary.com/");
    }

    /**
     * Strictly validates a remote URL to guarantee it is a trusted HTTPS Cloudinary URL
     * and prevents Server-Side Request Forgery (SSRF) against internal networks.
     */
    public static void validateTrustedCloudinaryUrl(String url) {
        if (url == null || url.trim().isEmpty()) {
            throw new IllegalArgumentException("Image URL cannot be empty");
        }

        URI uri;
        try {
            uri = URI.create(url.trim());
        } catch (Exception e) {
            throw new SecurityException("Invalid image URL format: " + e.getMessage(), e);
        }

        String scheme = uri.getScheme();
        if (scheme == null || !"https".equalsIgnoreCase(scheme)) {
            throw new SecurityException("SSRF Protection: Only secure HTTPS URLs are permitted. Provided scheme: " + scheme);
        }

        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new SecurityException("SSRF Protection: Image URL does not contain a valid host name");
        }

        host = host.toLowerCase(Locale.ROOT);

        // Host must strictly match *.cloudinary.com or res.cloudinary.com
        if (!CLOUDINARY_HOST_PATTERN.matcher(host).matches() && !host.endsWith(".cloudinary.com")) {
            throw new SecurityException("SSRF Protection: Remote host [" + host + "] is not a trusted Cloudinary endpoint");
        }

        // Port must be default or standard 443
        int port = uri.getPort();
        if (port != -1 && port != 443) {
            throw new SecurityException("SSRF Protection: Non-standard HTTPS port [" + port + "] is not allowed");
        }

        // Resolve DNS and ensure the IP is public (never loopback, private RFC1918, link-local, or multicast)
        try {
            InetAddress address = InetAddress.getByName(host);
            if (address.isLoopbackAddress()
                    || address.isSiteLocalAddress()
                    || address.isLinkLocalAddress()
                    || address.isAnyLocalAddress()
                    || address.isMulticastAddress()) {
                throw new SecurityException("SSRF Protection: Cloudinary host resolved to a forbidden private address: " + address.getHostAddress());
            }
        } catch (UnknownHostException e) {
            throw new SecurityException("SSRF Protection: Unable to resolve Cloudinary host: " + host, e);
        }
    }

    /**
     * Uploads an image file to Cloudinary and returns the HTTPS secure_url.
     */
    public String uploadImage(MultipartFile file, String folder) throws IOException {
        if (!isConfigured()) {
            throw new IllegalStateException("Cloudinary is not configured. Set CRACKVISION_CLOUDINARY_CLOUD_NAME and API credentials or upload preset.");
        }

        String uploadUrl = "https://api.cloudinary.com/v1_1/" + cloudName + "/image/upload";

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        ByteArrayResource fileResource = new ByteArrayResource(file.getBytes()) {
            @Override
            public String getFilename() {
                return file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload.jpg";
            }
        };
        body.add("file", fileResource);

        if (!uploadPreset.isBlank()) {
            // Unsigned upload via preset
            body.add("upload_preset", uploadPreset);
            if (folder != null && !folder.isBlank()) {
                body.add("folder", folder);
            }
        } else {
            // Signed upload via API key and Secret
            String timestamp = String.valueOf(Instant.now().getEpochSecond());
            Map<String, String> paramsToSign = new TreeMap<>();
            paramsToSign.put("timestamp", timestamp);
            if (folder != null && !folder.isBlank()) {
                paramsToSign.put("folder", folder);
            }

            String signature = generateSignature(paramsToSign, apiSecret);
            body.add("api_key", apiKey);
            body.add("timestamp", timestamp);
            body.add("signature", signature);
            if (folder != null && !folder.isBlank()) {
                body.add("folder", folder);
            }
        }

        log.info("Uploading image [{}] to Cloudinary cloud [{}]...", file.getOriginalFilename(), cloudName);

        String responseJson;
        try {
            responseJson = restClient.post()
                    .uri(uploadUrl)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body)
                    .retrieve()
                    .body(String.class);
        } catch (Exception e) {
            log.error("Cloudinary upload failed: {}", e.getMessage());
            throw new IOException("Failed to upload image to Cloudinary: " + e.getMessage(), e);
        }

        if (responseJson == null || responseJson.isBlank()) {
            throw new IOException("Empty response received from Cloudinary API");
        }

        JsonNode root = objectMapper.readTree(responseJson);
        if (root.has("error")) {
            String errorMsg = root.path("error").path("message").asText("Unknown Cloudinary error");
            throw new IOException("Cloudinary API returned error: " + errorMsg);
        }

        String secureUrl = root.path("secure_url").asText(null);
        if (secureUrl == null || secureUrl.isBlank()) {
            secureUrl = root.path("url").asText(null);
        }

        if (secureUrl == null || secureUrl.isBlank()) {
            throw new IOException("No secure_url found in Cloudinary upload response");
        }

        log.info("Successfully uploaded image to Cloudinary: {}", secureUrl);
        return secureUrl;
    }

    /**
     * Safely deletes an image from Cloudinary if API key & secret are available.
     */
    public boolean deleteImageByPublicIdOrUrl(String publicIdOrUrl) {
        if (!isConfigured() || apiKey.isBlank() || apiSecret.isBlank()) {
            return false;
        }

        String publicId = extractPublicId(publicIdOrUrl);
        if (publicId == null || publicId.isBlank()) {
            return false;
        }

        try {
            String destroyUrl = "https://api.cloudinary.com/v1_1/" + cloudName + "/image/destroy";
            String timestamp = String.valueOf(Instant.now().getEpochSecond());

            Map<String, String> paramsToSign = new TreeMap<>();
            paramsToSign.put("public_id", publicId);
            paramsToSign.put("timestamp", timestamp);

            String signature = generateSignature(paramsToSign, apiSecret);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("public_id", publicId);
            body.add("api_key", apiKey);
            body.add("timestamp", timestamp);
            body.add("signature", signature);

            restClient.post()
                    .uri(destroyUrl)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();

            log.info("Successfully deleted image [{}] from Cloudinary", publicId);
            return true;
        } catch (Exception e) {
            log.warn("Failed to delete image [{}] from Cloudinary: {}", publicId, e.getMessage());
            return false;
        }
    }

    /**
     * Extracts public_id from Cloudinary URL, e.g.:
     * https://res.cloudinary.com/dudhz46j/image/upload/v1234567/folder/sample.jpg -> folder/sample
     */
    public static String extractPublicId(String urlOrPublicId) {
        if (urlOrPublicId == null || urlOrPublicId.isBlank()) {
            return null;
        }
        if (!urlOrPublicId.contains("cloudinary.com/")) {
            return urlOrPublicId;
        }

        String path = urlOrPublicId;
        int uploadIndex = path.indexOf("/upload/");
        if (uploadIndex != -1) {
            path = path.substring(uploadIndex + "/upload/".length());
            // Strip transformations/version like v12345/ or f_auto,q_auto/
            String[] segments = path.split("/");
            StringBuilder sb = new StringBuilder();
            boolean foundVersion = false;
            for (String segment : segments) {
                if (!foundVersion && (segment.startsWith("v") && segment.matches("v\\d+")
                        || segment.contains(",") || segment.contains("_"))) {
                    continue;
                }
                foundVersion = true;
                if (sb.length() > 0) sb.append("/");
                sb.append(segment);
            }
            path = sb.toString();
        }

        // Strip file extension if any
        int dotIndex = path.lastIndexOf('.');
        if (dotIndex != -1) {
            path = path.substring(0, dotIndex);
        }
        return path;
    }

    /**
     * Computes Cloudinary SHA-1 signature over alphabetically sorted parameters.
     */
    public static String generateSignature(Map<String, String> params, String apiSecret) {
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> entry : params.entrySet()) {
            if (entry.getValue() != null && !entry.getValue().isBlank()) {
                if (sb.length() > 0) {
                    sb.append("&");
                }
                sb.append(entry.getKey()).append("=").append(entry.getValue());
            }
        }
        sb.append(apiSecret);

        try {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            byte[] digest = md.digest(sb.toString().getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : digest) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-1 algorithm not available", e);
        }
    }
}
