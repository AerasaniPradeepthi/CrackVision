package com.crackvision.backend.service;

import com.crackvision.backend.dto.ai.PythonAnalysisResponse;
import com.crackvision.backend.entity.AiAnalysisResult;
import com.crackvision.backend.entity.Inspection;
import com.crackvision.backend.entity.InspectionImage;
import com.crackvision.backend.exception.AiServiceException;
import com.crackvision.backend.repository.AiAnalysisResultRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class AiAnalysisService {

    private static final Logger log = LoggerFactory.getLogger(AiAnalysisService.class);

    private final InspectionService inspectionService;
    private final InspectionImageService inspectionImageService;
    private final AiAnalysisResultRepository aiAnalysisResultRepository;
    private final RestClient restClient;
    private final CloudinaryService cloudinaryService;
    private final String aiServiceUrl;
    private final String apiKey;

    @Value("${crackvision.ai-service.read-timeout-ms:30000}")
    private int readTimeoutMs;

    @Autowired
    public AiAnalysisService(
            InspectionService inspectionService,
            InspectionImageService inspectionImageService,
            AiAnalysisResultRepository aiAnalysisResultRepository,
            @Autowired(required = false) CloudinaryService cloudinaryService,
            @Value("${crackvision.ai-service.url:http://127.0.0.1:8000}") String aiServiceUrl,
            @Value("${crackvision.ai-service.api-key:}") String apiKey,
            @Value("${crackvision.ai-service.connect-timeout-ms:5000}") int connectTimeoutMs,
            @Value("${crackvision.ai-service.read-timeout-ms:30000}") int readTimeoutMs) {
        this.inspectionService = inspectionService;
        this.inspectionImageService = inspectionImageService;
        this.aiAnalysisResultRepository = aiAnalysisResultRepository;
        this.cloudinaryService = cloudinaryService;
        this.aiServiceUrl = aiServiceUrl;
        this.apiKey = apiKey != null ? apiKey.trim() : "";
        this.readTimeoutMs = readTimeoutMs;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeoutMs);
        requestFactory.setReadTimeout(readTimeoutMs);

        this.restClient = RestClient.builder()
                .baseUrl(aiServiceUrl)
                .requestFactory(requestFactory)
                .build();
    }

    // Constructor for testing with mock RestClient
    public AiAnalysisService(
            InspectionService inspectionService,
            InspectionImageService inspectionImageService,
            AiAnalysisResultRepository aiAnalysisResultRepository,
            RestClient restClient) {
        this(inspectionService, inspectionImageService, aiAnalysisResultRepository, null, restClient, "http://127.0.0.1:8000", "");
    }

    // Constructor for testing with mock RestClient and CloudinaryService
    public AiAnalysisService(
            InspectionService inspectionService,
            InspectionImageService inspectionImageService,
            AiAnalysisResultRepository aiAnalysisResultRepository,
            CloudinaryService cloudinaryService,
            RestClient restClient) {
        this(inspectionService, inspectionImageService, aiAnalysisResultRepository, cloudinaryService, restClient, "http://127.0.0.1:8000", "");
    }

    public AiAnalysisService(
            InspectionService inspectionService,
            InspectionImageService inspectionImageService,
            AiAnalysisResultRepository aiAnalysisResultRepository,
            CloudinaryService cloudinaryService,
            RestClient restClient,
            String aiServiceUrl,
            String apiKey) {
        this.inspectionService = inspectionService;
        this.inspectionImageService = inspectionImageService;
        this.aiAnalysisResultRepository = aiAnalysisResultRepository;
        this.cloudinaryService = cloudinaryService;
        this.restClient = restClient;
        this.aiServiceUrl = aiServiceUrl != null ? aiServiceUrl : "http://127.0.0.1:8000";
        this.apiKey = apiKey != null ? apiKey.trim() : "";
        this.readTimeoutMs = 30000;
    }

    /**
     * Executes AI crack detection on an already stored inspection image.
     * Preserves image and inspection integrity if AI microservice times out or fails.
     * Preserves historical analysis records (each run creates a new audit trail entry).
     */
    public AiAnalysisResult analyzeImage(Long inspectionId, Long imageId) {
        // 1. Verify inspection and image existence
        Inspection inspection = inspectionService.getInspectionById(inspectionId);
        InspectionImage image = inspectionImageService.getImageMetadata(inspectionId, imageId);

        // 2. Load stored original image from disk
        Resource resource = inspectionImageService.loadResource(image);
        byte[] imageBytes;
        try {
            imageBytes = resource.getInputStream().readAllBytes();
        } catch (IOException e) {
            throw new RuntimeException("Could not read stored image bytes from disk: " + e.getMessage(), e);
        }

        // 3. Prepare multipart payload
        ByteArrayResource filePayload = new ByteArrayResource(imageBytes) {
            @Override
            public String getFilename() {
                return image.getStoredFilename();
            }
        };

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", filePayload);

        // 4. Dispatch request to Python FastAPI microservice
        PythonAnalysisResponse pythonResponse;
        try {
            var requestSpec = restClient.post()
                    .uri("/analyze")
                    .contentType(MediaType.MULTIPART_FORM_DATA);
            if (apiKey != null && !apiKey.isBlank()) {
                requestSpec.header("X-API-Key", apiKey);
                requestSpec.header("Authorization", "Bearer " + apiKey);
            }
            pythonResponse = requestSpec
                    .body(body)
                    .retrieve()
                    .body(PythonAnalysisResponse.class);
        } catch (ResourceAccessException e) {
            boolean isTimeout = e.getCause() instanceof SocketTimeoutException
                    || (e.getMessage() != null && e.getMessage().toLowerCase().contains("timeout"));
            String errorMsg = isTimeout
                    ? "AI service request timed out after " + readTimeoutMs + "ms"
                    : "AI service connection refused or unreachable";

            recordFailedAnalysis(inspection, image, errorMsg);
            throw new AiServiceException(errorMsg, e, isTimeout);
        } catch (RestClientResponseException e) {
            int statusCode = e.getStatusCode().value();
            String responseBody = "";
            try {
                responseBody = e.getResponseBodyAsString();
            } catch (Exception ignored) {}

            String errorMsg;
            if (statusCode == 403) {
                if (responseBody != null && (responseBody.toLowerCase().contains("streamlit") || responseBody.toLowerCase().contains("<!doctype html>"))) {
                    errorMsg = "AI service returned HTTP 403 FORBIDDEN. The configured AI URL (" + sanitizeUrl(aiServiceUrl) + ") points to an external web application (Streamlit). Please configure CRACKVISION_AI_SERVICE_URL to the valid FastAPI microservice endpoint.";
                } else {
                    errorMsg = "AI service returned HTTP 403 FORBIDDEN. Please verify CRACKVISION_AI_SERVICE_URL and optional CRACKVISION_AI_SERVICE_API_KEY.";
                }
            } else if (statusCode == 404) {
                errorMsg = "AI service returned HTTP 404. Endpoint /analyze not found on " + sanitizeUrl(aiServiceUrl);
            } else {
                errorMsg = "AI service returned HTTP " + e.getStatusCode();
            }
            log.error("AI service analysis failed: {} | response preview: {}", errorMsg, responseBody != null && responseBody.length() > 200 ? responseBody.substring(0, 200) : responseBody);
            recordFailedAnalysis(inspection, image, errorMsg);
            throw new AiServiceException(errorMsg, e, false);
        } catch (Exception e) {
            String errorMsg = "Failed to communicate with AI service: " + e.getMessage();
            recordFailedAnalysis(inspection, image, errorMsg);
            throw new AiServiceException(errorMsg, e, false);
        }

        if (pythonResponse == null) {
            String errorMsg = "AI service returned empty response payload";
            recordFailedAnalysis(inspection, image, errorMsg);
            throw new AiServiceException(errorMsg, false);
        }

        // 5. Persist successful analysis result in history without modifying Inspection.status
        AiAnalysisResult result = new AiAnalysisResult();
        result.setInspection(inspection);
        result.setInspectionImage(image);
        result.setCrackDetected(Boolean.TRUE.equals(pythonResponse.getCrackDetected()));
        result.setScreeningCategory(pythonResponse.getScreeningCategory() != null
                ? pythonResponse.getScreeningCategory()
                : "REVIEW_REQUIRED");
        result.setConfidence(pythonResponse.getConfidence());
        result.setCrackAreaPercentage(pythonResponse.getCrackAreaPercentage() != null
                ? pythonResponse.getCrackAreaPercentage()
                : 0.0);
        result.setRegionsCount(pythonResponse.getRegionsCount() != null
                ? pythonResponse.getRegionsCount()
                : 0);
        String finalHighlightedUrl = pythonResponse.getHighlightedImageUrl();

        // If an overlay was produced and Cloudinary is configured, upload the overlay for persistent HTTPS delivery
        if (finalHighlightedUrl != null && !finalHighlightedUrl.isBlank() && cloudinaryService != null && cloudinaryService.isConfigured()) {
            try {
                String overlayPath = finalHighlightedUrl.startsWith("/") ? finalHighlightedUrl : "/" + finalHighlightedUrl;
                var overlaySpec = restClient.get().uri(overlayPath);
                if (apiKey != null && !apiKey.isBlank()) {
                    overlaySpec.header("X-API-Key", apiKey);
                    overlaySpec.header("Authorization", "Bearer " + apiKey);
                }
                byte[] overlayBytes = overlaySpec
                        .retrieve()
                        .body(byte[].class);

                if (overlayBytes != null && overlayBytes.length > 0) {
                    String baseName = image.getStoredFilename() != null ? image.getStoredFilename() : "image_" + image.getId();
                    if (baseName.contains(".")) {
                        baseName = baseName.substring(0, baseName.lastIndexOf("."));
                    }
                    String overlayFilename = "overlay_" + baseName + ".png";
                    String cloudinaryOverlayUrl = cloudinaryService.uploadBytes(overlayBytes, overlayFilename, "inspections/overlays");
                    if (cloudinaryOverlayUrl != null && !cloudinaryOverlayUrl.isBlank()) {
                        finalHighlightedUrl = cloudinaryOverlayUrl;
                        log.info("Persisted AI overlay to Cloudinary: {}", finalHighlightedUrl);
                    }
                }
            } catch (Exception e) {
                // Non-fatal: if Cloudinary upload fails, retain original relative URL
                log.warn("Failed to persist AI overlay to Cloudinary, retaining relative URL [{}]: {}", finalHighlightedUrl, e.getMessage());
            }
        }

        result.setHighlightedImageUrl(finalHighlightedUrl);

        if (pythonResponse.getModelInfo() != null) {
            result.setModelName(pythonResponse.getModelInfo().getName());
            result.setModelVersion(pythonResponse.getModelInfo().getVersion());
            result.setModelType(pythonResponse.getModelInfo().getModelType());
        }

        result.setStatus("SUCCESS");
        result.setDisclaimer(pythonResponse.getDisclaimer());
        result.setAnalyzedAt(LocalDateTime.now());
        result.setCreatedAt(LocalDateTime.now());

        AiAnalysisResult savedResult = aiAnalysisResultRepository.save(result);

        // Transition inspection status to PENDING_REVIEW if currently in preliminary state
        if (inspection.getStatus() == null
                || "PENDING_AI_ANALYSIS".equalsIgnoreCase(inspection.getStatus())
                || "IN_PROGRESS".equalsIgnoreCase(inspection.getStatus())) {
            inspection.setStatus("PENDING_REVIEW");
            inspectionService.updateInspection(inspection.getId(), inspection);
        }

        return savedResult;
    }

    private void recordFailedAnalysis(Inspection inspection, InspectionImage image, String errorMessage) {
        try {
            AiAnalysisResult failedResult = new AiAnalysisResult();
            failedResult.setInspection(inspection);
            failedResult.setInspectionImage(image);
            failedResult.setCrackDetected(false);
            failedResult.setScreeningCategory("REVIEW_REQUIRED");
            failedResult.setConfidence(null);
            failedResult.setCrackAreaPercentage(0.0);
            failedResult.setRegionsCount(0);
            failedResult.setStatus("FAILED");
            failedResult.setErrorMessage(errorMessage);
            failedResult.setAnalyzedAt(LocalDateTime.now());
            failedResult.setCreatedAt(LocalDateTime.now());
            aiAnalysisResultRepository.save(failedResult);
        } catch (Exception dbEx) {
            // Ensure error logging does not obscure original failure
        }
    }

    public Optional<AiAnalysisResult> getLatestAnalysisForImage(Long inspectionId, Long imageId) {
        inspectionService.getInspectionById(inspectionId);
        inspectionImageService.getImageMetadata(inspectionId, imageId);
        return aiAnalysisResultRepository.findLatestByInspectionImageId(imageId);
    }

    public List<AiAnalysisResult> getAnalysisHistoryForImage(Long inspectionId, Long imageId) {
        inspectionService.getInspectionById(inspectionId);
        inspectionImageService.getImageMetadata(inspectionId, imageId);
        return aiAnalysisResultRepository.findByInspectionImageIdOrderByCreatedAtDesc(imageId);
    }

    public List<AiAnalysisResult> getAnalysisHistoryForInspection(Long inspectionId) {
        inspectionService.getInspectionById(inspectionId);
        return aiAnalysisResultRepository.findByInspectionIdOrderByCreatedAtDesc(inspectionId);
    }

    public Optional<AiAnalysisResult> getLatestAnalysisForInspection(Long inspectionId) {
        inspectionService.getInspectionById(inspectionId);
        return aiAnalysisResultRepository.findLatestByInspectionId(inspectionId);
    }

    /**
     * Probes the AI microservice /health endpoint and returns diagnostic information.
     */
    public Map<String, Object> checkAiServiceHealth() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("configuredUrl", sanitizeUrl(aiServiceUrl));
        try {
            var spec = restClient.get().uri("/health");
            if (apiKey != null && !apiKey.isBlank()) {
                spec.header("X-API-Key", apiKey);
                spec.header("Authorization", "Bearer " + apiKey);
            }
            String body = spec.retrieve().body(String.class);
            result.put("status", "UP");
            result.put("serviceStatus", "HEALTHY");
            result.put("details", body);
            return result;
        } catch (ResourceAccessException e) {
            boolean isTimeout = e.getCause() instanceof SocketTimeoutException
                    || (e.getMessage() != null && e.getMessage().toLowerCase().contains("timeout"));
            result.put("status", "DOWN");
            result.put("error", isTimeout ? "Connection timed out" : "Connection refused or unreachable");
            return result;
        } catch (RestClientResponseException e) {
            result.put("status", "DOWN");
            result.put("httpStatus", e.getStatusCode().value());
            String responseBody = "";
            try {
                responseBody = e.getResponseBodyAsString();
            } catch (Exception ignored) {}
            if (e.getStatusCode().value() == 403 && (responseBody.toLowerCase().contains("streamlit") || responseBody.toLowerCase().contains("<!doctype html>"))) {
                result.put("error", "HTTP 403: Endpoint points to external Streamlit app instead of CrackVision FastAPI service.");
            } else {
                result.put("error", "HTTP " + e.getStatusCode());
            }
            return result;
        } catch (Exception e) {
            result.put("status", "DOWN");
            result.put("error", e.getMessage());
            return result;
        }
    }

    private String sanitizeUrl(String url) {
        if (url == null || url.isBlank()) return "unconfigured";
        try {
            URI uri = URI.create(url);
            if (uri.getUserInfo() != null) {
                return uri.getScheme() + "://" + uri.getHost() + (uri.getPort() > 0 ? ":" + uri.getPort() : "") + uri.getPath();
            }
        } catch (Exception ignored) {}
        return url;
    }
}
