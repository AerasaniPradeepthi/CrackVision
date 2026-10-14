package com.crackvision.backend.controller;

import com.crackvision.backend.dto.ai.AiAnalysisResultResponse;
import com.crackvision.backend.entity.AiAnalysisResult;
import com.crackvision.backend.exception.AiServiceException;
import com.crackvision.backend.service.AiAnalysisService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/inspections")
public class AiAnalysisController {

    private final AiAnalysisService aiAnalysisService;

    public AiAnalysisController(AiAnalysisService aiAnalysisService) {
        this.aiAnalysisService = aiAnalysisService;
    }

    /**
     * Triggers AI screening on an already stored inspection image.
     * Original image is never modified or rolled back on failure.
     */
    @PostMapping("/{inspectionId}/images/{imageId}/analyze")
    public ResponseEntity<?> analyzeImage(
            @PathVariable Long inspectionId,
            @PathVariable Long imageId) {
        try {
            AiAnalysisResult result = aiAnalysisService.analyzeImage(inspectionId, imageId);
            return ResponseEntity.ok(new AiAnalysisResultResponse(result));
        } catch (AiServiceException e) {
            HttpStatus status = e.isTimeout() ? HttpStatus.GATEWAY_TIMEOUT : HttpStatus.SERVICE_UNAVAILABLE;
            return ResponseEntity.status(status).body(Map.of(
                    "error", e.getMessage(),
                    "inspectionId", inspectionId,
                    "imageId", imageId,
                    "imagePreserved", true
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "error", "Unexpected error during image analysis: " + e.getMessage()
            ));
        }
    }

    /**
     * Retrieves the latest analysis result for a specific image.
     */
    @GetMapping("/{inspectionId}/images/{imageId}/analysis")
    public ResponseEntity<?> getLatestAnalysisForImage(
            @PathVariable Long inspectionId,
            @PathVariable Long imageId) {
        try {
            Optional<AiAnalysisResult> latest = aiAnalysisService.getLatestAnalysisForImage(inspectionId, imageId);
            if (latest.isPresent()) {
                return ResponseEntity.ok(new AiAnalysisResultResponse(latest.get()));
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                        "message", "No analysis result found for image ID " + imageId
                ));
            }
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Retrieves all historical analysis results for a specific image (audit trail).
     */
    @GetMapping("/{inspectionId}/images/{imageId}/analysis/history")
    public ResponseEntity<?> getAnalysisHistoryForImage(
            @PathVariable Long inspectionId,
            @PathVariable Long imageId) {
        try {
            List<AiAnalysisResult> history = aiAnalysisService.getAnalysisHistoryForImage(inspectionId, imageId);
            List<AiAnalysisResultResponse> response = history.stream()
                    .map(AiAnalysisResultResponse::new)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Retrieves all analysis results for an entire inspection.
     */
    @GetMapping("/{inspectionId}/analysis")
    public ResponseEntity<?> getAnalysisHistoryForInspection(
            @PathVariable Long inspectionId) {
        try {
            List<AiAnalysisResult> history = aiAnalysisService.getAnalysisHistoryForInspection(inspectionId);
            List<AiAnalysisResultResponse> response = history.stream()
                    .map(AiAnalysisResultResponse::new)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Retrieves the single most recent analysis result for an inspection.
     */
    @GetMapping("/{inspectionId}/analysis/latest")
    public ResponseEntity<?> getLatestAnalysisForInspection(
            @PathVariable Long inspectionId) {
        try {
            Optional<AiAnalysisResult> latest = aiAnalysisService.getLatestAnalysisForInspection(inspectionId);
            if (latest.isPresent()) {
                return ResponseEntity.ok(new AiAnalysisResultResponse(latest.get()));
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                        "message", "No analysis results found for inspection ID " + inspectionId
                ));
            }
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }
}
