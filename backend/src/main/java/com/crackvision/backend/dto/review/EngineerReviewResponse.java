package com.crackvision.backend.dto.review;

import com.crackvision.backend.entity.EngineerReview;
import com.crackvision.backend.entity.ReviewDecision;

import java.time.LocalDateTime;

public class EngineerReviewResponse {

    private Long id;
    private Long analysisId;
    private Long inspectionId;
    private Long imageId;
    private ReviewDecision decision;
    private String comments;
    private ReviewerSummaryResponse reviewer;
    private LocalDateTime reviewedAt;
    private LocalDateTime createdAt;

    public EngineerReviewResponse() {
    }

    public EngineerReviewResponse(EngineerReview entity) {
        if (entity != null) {
            this.id = entity.getId();
            this.analysisId = entity.getAnalysisId();
            this.inspectionId = entity.getInspectionId();
            this.imageId = entity.getImageId();
            this.decision = entity.getDecision();
            this.comments = entity.getComments();
            if (entity.getReviewer() != null) {
                this.reviewer = new ReviewerSummaryResponse(entity.getReviewer());
            }
            this.reviewedAt = entity.getReviewedAt();
            this.createdAt = entity.getCreatedAt();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getAnalysisId() {
        return analysisId;
    }

    public void setAnalysisId(Long analysisId) {
        this.analysisId = analysisId;
    }

    public Long getInspectionId() {
        return inspectionId;
    }

    public void setInspectionId(Long inspectionId) {
        this.inspectionId = inspectionId;
    }

    public Long getImageId() {
        return imageId;
    }

    public void setImageId(Long imageId) {
        this.imageId = imageId;
    }

    public ReviewDecision getDecision() {
        return decision;
    }

    public void setDecision(ReviewDecision decision) {
        this.decision = decision;
    }

    public String getComments() {
        return comments;
    }

    public void setComments(String comments) {
        this.comments = comments;
    }

    public ReviewerSummaryResponse getReviewer() {
        return reviewer;
    }

    public void setReviewer(ReviewerSummaryResponse reviewer) {
        this.reviewer = reviewer;
    }

    public LocalDateTime getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(LocalDateTime reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
