package com.crackvision.backend.service;

import com.crackvision.backend.dto.review.EngineerReviewRequest;
import com.crackvision.backend.entity.*;
import com.crackvision.backend.repository.AiAnalysisResultRepository;
import com.crackvision.backend.repository.EngineerReviewRepository;
import com.crackvision.backend.repository.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class EngineerReviewService {

    private final InspectionService inspectionService;
    private final AiAnalysisResultRepository aiAnalysisResultRepository;
    private final EngineerReviewRepository engineerReviewRepository;
    private final UserRepository userRepository;

    public EngineerReviewService(
            InspectionService inspectionService,
            AiAnalysisResultRepository aiAnalysisResultRepository,
            EngineerReviewRepository engineerReviewRepository,
            UserRepository userRepository) {
        this.inspectionService = inspectionService;
        this.aiAnalysisResultRepository = aiAnalysisResultRepository;
        this.engineerReviewRepository = engineerReviewRepository;
        this.userRepository = userRepository;
    }

    /**
     * Submits an engineer review for a specified AI analysis result.
     * Validates that the AI analysis exists and belongs to the specified inspection.
     * Derives reviewer identity from the authenticated security principal.
     * Updates Inspection.status to COMPLETED while preserving append-only audit trail.
     */
    @Transactional
    public EngineerReview submitReview(
            Long inspectionId,
            Long analysisId,
            EngineerReviewRequest request,
            String reviewerEmail) {

        if (request == null) {
            throw new IllegalArgumentException("Review request body cannot be null");
        }
        if (request.getDecision() == null) {
            throw new IllegalArgumentException("Review decision is required");
        }
        if (request.getComments() == null || request.getComments().trim().isEmpty()) {
            throw new IllegalArgumentException("Review comments cannot be empty");
        }
        if (reviewerEmail == null || reviewerEmail.trim().isEmpty()) {
            throw new IllegalArgumentException("Authenticated reviewer identity is required");
        }

        // Validate inspection exists
        Inspection inspection = inspectionService.getInspectionById(inspectionId);

        // Validate AI analysis exists
        AiAnalysisResult analysis = aiAnalysisResultRepository.findById(analysisId)
                .orElseThrow(() -> new RuntimeException("AI analysis result not found with id: " + analysisId));

        // Validate AI analysis belongs to the requested inspection
        if (analysis.getInspection() == null || !inspection.getId().equals(analysis.getInspection().getId())) {
            throw new IllegalArgumentException("AI analysis result with id " + analysisId
                    + " does not belong to inspection with id " + inspectionId);
        }

        // Resolve authenticated reviewer
        User reviewer = userRepository.findByEmail(reviewerEmail)
                .orElseThrow(() -> new RuntimeException("Reviewer user not found for email: " + reviewerEmail));

        // Enforce role authorization at business layer
        if (reviewer.getRole() != Role.SITE_ENGINEER && reviewer.getRole() != Role.ADMIN && reviewer.getRole() != Role.SITE_ADMIN) {
            throw new AccessDeniedException("User role " + reviewer.getRole()
                    + " is not authorized to submit engineer reviews. Requires SITE_ENGINEER, ADMIN, or SITE_ADMIN.");
        }

        // Create append-only review record
        EngineerReview review = new EngineerReview();
        review.setAiAnalysisResult(analysis);
        review.setReviewer(reviewer);
        review.setDecision(request.getDecision());
        review.setComments(request.getComments().trim());
        review.setReviewedAt(LocalDateTime.now());
        review.setCreatedAt(LocalDateTime.now());

        EngineerReview savedReview = engineerReviewRepository.save(review);

        // Update inspection lifecycle status to COMPLETED upon certified engineering determination
        inspection.setStatus("COMPLETED");
        inspectionService.updateInspection(inspectionId, inspection);

        return savedReview;
    }

    /**
     * Retrieves all engineer reviews across the entire system ordered by creation date descending.
     */
    @Transactional(readOnly = true)
    public List<EngineerReview> getAllReviews() {
        return engineerReviewRepository.findAllByOrderByCreatedAtDesc();
    }

    /**
     * Retrieves all reviews for a specific AI analysis result (audit trail).
     */
    @Transactional(readOnly = true)
    public List<EngineerReview> getReviewsForAnalysis(Long inspectionId, Long analysisId) {
        validateInspectionAndAnalysis(inspectionId, analysisId);
        return engineerReviewRepository.findByAnalysisIdOrderByCreatedAtDesc(analysisId);
    }

    /**
     * Retrieves the latest review for a specific AI analysis result.
     */
    @Transactional(readOnly = true)
    public Optional<EngineerReview> getLatestReviewForAnalysis(Long inspectionId, Long analysisId) {
        validateInspectionAndAnalysis(inspectionId, analysisId);
        return engineerReviewRepository.findLatestByAnalysisId(analysisId);
    }

    /**
     * Retrieves all reviews for an inspection across all its analyzed images.
     */
    @Transactional(readOnly = true)
    public List<EngineerReview> getReviewsForInspection(Long inspectionId) {
        inspectionService.getInspectionById(inspectionId);
        return engineerReviewRepository.findByInspectionIdOrderByCreatedAtDesc(inspectionId);
    }

    /**
     * Retrieves the latest review across an entire inspection.
     */
    @Transactional(readOnly = true)
    public Optional<EngineerReview> getLatestReviewForInspection(Long inspectionId) {
        inspectionService.getInspectionById(inspectionId);
        return engineerReviewRepository.findLatestByInspectionId(inspectionId);
    }

    private void validateInspectionAndAnalysis(Long inspectionId, Long analysisId) {
        Inspection inspection = inspectionService.getInspectionById(inspectionId);
        AiAnalysisResult analysis = aiAnalysisResultRepository.findById(analysisId)
                .orElseThrow(() -> new RuntimeException("AI analysis result not found with id: " + analysisId));

        if (analysis.getInspection() == null || !inspection.getId().equals(analysis.getInspection().getId())) {
            throw new IllegalArgumentException("AI analysis result with id " + analysisId
                    + " does not belong to inspection with id " + inspectionId);
        }
    }
}
