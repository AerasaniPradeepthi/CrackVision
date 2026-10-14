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

import java.io.IOException;
import java.net.SocketTimeoutException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class AiAnalysisService {

    private final InspectionService inspectionService;
    private final InspectionImageService inspectionImageService;
    private final AiAnalysisResultRepository aiAnalysisResultRepository;
    private final RestClient restClient;

    @Value("${crackvision.ai-service.read-timeout-ms:30000}")
    private int readTimeoutMs;

    @Autowired
    public AiAnalysisService(
            InspectionService inspectionService,
            InspectionImageService inspectionImageService,
            AiAnalysisResultRepository aiAnalysisResultRepository,
            @Value("${crackvision.ai-service.url:http://127.0.0.1:8000}") String aiServiceUrl,
            @Value("${crackvision.ai-service.connect-timeout-ms:5000}") int connectTimeoutMs,
            @Value("${crackvision.ai-service.read-timeout-ms:30000}") int readTimeoutMs) {
        this.inspectionService = inspectionService;
        this.inspectionImageService = inspectionImageService;
        this.aiAnalysisResultRepository = aiAnalysisResultRepository;
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
        this.inspectionService = inspectionService;
        this.inspectionImageService = inspectionImageService;
        this.aiAnalysisResultRepository = aiAnalysisResultRepository;
        this.restClient = restClient;
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
            pythonResponse = restClient.post()
                    .uri("/analyze")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
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
            String errorMsg = "AI service returned HTTP " + e.getStatusCode();
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
        result.setHighlightedImageUrl(pythonResponse.getHighlightedImageUrl());

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
}
