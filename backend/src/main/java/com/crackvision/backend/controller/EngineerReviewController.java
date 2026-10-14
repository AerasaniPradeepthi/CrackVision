package com.crackvision.backend.controller;

import com.crackvision.backend.dto.review.EngineerReviewRequest;
import com.crackvision.backend.dto.review.EngineerReviewResponse;
import com.crackvision.backend.entity.EngineerReview;
import com.crackvision.backend.entity.User;
import com.crackvision.backend.service.EngineerReviewService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/inspections")
public class EngineerReviewController {

    private final EngineerReviewService engineerReviewService;

    public EngineerReviewController(EngineerReviewService engineerReviewService) {
        this.engineerReviewService = engineerReviewService;
    }

    /**
     * Submits a site engineer review on an existing AI analysis result.
     * Restricted to SITE_ENGINEER and ADMIN roles.
     * Reviewer identity is derived securely from the authenticated principal.
     */
    @PostMapping("/{inspectionId}/analysis/{analysisId}/reviews")
    @PreAuthorize("hasAnyRole('SITE_ENGINEER', 'ADMIN')")
    public ResponseEntity<?> submitReview(
            @PathVariable Long inspectionId,
            @PathVariable Long analysisId,
            @RequestBody EngineerReviewRequest request,
            Authentication authentication) {
        try {
            String reviewerEmail = resolveUserEmail(authentication);
            EngineerReview review = engineerReviewService.submitReview(inspectionId, analysisId, request, reviewerEmail);
            return ResponseEntity.status(HttpStatus.CREATED).body(new EngineerReviewResponse(review));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (AccessDeniedException e) {
            throw e;
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Unexpected error submitting review: " + e.getMessage()));
        }
    }

    /**
     * Retrieves all engineer reviews across the entire system (comprehensive audit log).
     */
    @GetMapping({"/reviews/all", "/reviews"})
    public ResponseEntity<?> getAllReviews() {
        try {
            List<EngineerReview> reviews = engineerReviewService.getAllReviews();
            List<EngineerReviewResponse> response = reviews.stream()
                    .map(EngineerReviewResponse::new)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Unexpected error retrieving engineer reviews: " + e.getMessage()));
        }
    }

    /**
     * Retrieves all reviews for a specific AI analysis result (audit trail).
     */
    @GetMapping("/{inspectionId}/analysis/{analysisId}/reviews")
    public ResponseEntity<?> getReviewsForAnalysis(
            @PathVariable Long inspectionId,
            @PathVariable Long analysisId) {
        try {
            List<EngineerReview> reviews = engineerReviewService.getReviewsForAnalysis(inspectionId, analysisId);
            List<EngineerReviewResponse> response = reviews.stream()
                    .map(EngineerReviewResponse::new)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Retrieves the latest review verdict for a specific AI analysis result.
     */
    @GetMapping("/{inspectionId}/analysis/{analysisId}/reviews/latest")
    public ResponseEntity<?> getLatestReviewForAnalysis(
            @PathVariable Long inspectionId,
            @PathVariable Long analysisId) {
        try {
            Optional<EngineerReview> latest = engineerReviewService.getLatestReviewForAnalysis(inspectionId, analysisId);
            if (latest.isPresent()) {
                return ResponseEntity.ok(new EngineerReviewResponse(latest.get()));
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                        "message", "No review found for analysis ID " + analysisId
                ));
            }
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Retrieves all reviews across an entire inspection.
     */
    @GetMapping("/{inspectionId}/reviews")
    public ResponseEntity<?> getReviewsForInspection(
            @PathVariable Long inspectionId) {
        try {
            List<EngineerReview> reviews = engineerReviewService.getReviewsForInspection(inspectionId);
            List<EngineerReviewResponse> response = reviews.stream()
                    .map(EngineerReviewResponse::new)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Retrieves the latest review across an entire inspection.
     */
    @GetMapping("/{inspectionId}/reviews/latest")
    public ResponseEntity<?> getLatestReviewForInspection(
            @PathVariable Long inspectionId) {
        try {
            Optional<EngineerReview> latest = engineerReviewService.getLatestReviewForInspection(inspectionId);
            if (latest.isPresent()) {
                return ResponseEntity.ok(new EngineerReviewResponse(latest.get()));
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                        "message", "No reviews found for inspection ID " + inspectionId
                ));
            }
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    private String resolveUserEmail(Authentication authentication) {
        if (authentication == null) {
            return null;
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof User user) {
            return user.getEmail();
        }
        return authentication.getName();
    }
}
