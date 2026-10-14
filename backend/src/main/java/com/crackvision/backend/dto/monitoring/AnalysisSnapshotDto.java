package com.crackvision.backend.dto.monitoring;

import com.crackvision.backend.entity.AiAnalysisResult;
import com.crackvision.backend.entity.EngineerReview;
import com.crackvision.backend.entity.ReviewDecision;

import java.time.LocalDateTime;

public class AnalysisSnapshotDto {

    private Long analysisId;
    private Long inspectionId;
    private Long imageId;
    private LocalDateTime analyzedAt;
    private Boolean crackDetected;
    private String screeningCategory;
    private Double crackAreaPercentage;
    private Integer regionsCount;
    private Double confidence;
    private String status;
    private String modelName;
    private String highlightedImageUrl;

    // Latest engineer review fields (if available)
    private ReviewDecision latestReviewDecision;
    private String latestReviewComments;
    private LocalDateTime latestReviewedAt;
    private String reviewerName;
    private String reviewerEmail;

    public AnalysisSnapshotDto() {
    }

    public AnalysisSnapshotDto(AiAnalysisResult analysis) {
        this(analysis, null);
    }

    public AnalysisSnapshotDto(AiAnalysisResult analysis, EngineerReview review) {
        if (analysis != null) {
            this.analysisId = analysis.getId();
            this.inspectionId = analysis.getInspectionId();
            this.imageId = analysis.getImageId();
            this.analyzedAt = analysis.getAnalyzedAt();
            this.crackDetected = analysis.getCrackDetected();
            this.screeningCategory = analysis.getScreeningCategory();
            this.crackAreaPercentage = analysis.getCrackAreaPercentage();
            this.regionsCount = analysis.getRegionsCount();
            this.confidence = analysis.getConfidence();
            this.status = analysis.getStatus();
            this.modelName = analysis.getModelName();
            this.highlightedImageUrl = analysis.getHighlightedImageUrl();
        }
        if (review != null) {
            this.latestReviewDecision = review.getDecision();
            this.latestReviewComments = review.getComments();
            this.latestReviewedAt = review.getReviewedAt();
            this.reviewerName = review.getReviewerName();
            this.reviewerEmail = review.getReviewerEmail();
        }
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

    public LocalDateTime getAnalyzedAt() {
        return analyzedAt;
    }

    public void setAnalyzedAt(LocalDateTime analyzedAt) {
        this.analyzedAt = analyzedAt;
    }

    public Boolean getCrackDetected() {
        return crackDetected;
    }

    public void setCrackDetected(Boolean crackDetected) {
        this.crackDetected = crackDetected;
    }

    public String getScreeningCategory() {
        return screeningCategory;
    }

    public void setScreeningCategory(String screeningCategory) {
        this.screeningCategory = screeningCategory;
    }

    public Double getCrackAreaPercentage() {
        return crackAreaPercentage;
    }

    public void setCrackAreaPercentage(Double crackAreaPercentage) {
        this.crackAreaPercentage = crackAreaPercentage;
    }

    public Integer getRegionsCount() {
        return regionsCount;
    }

    public void setRegionsCount(Integer regionsCount) {
        this.regionsCount = regionsCount;
    }

    public Double getConfidence() {
        return confidence;
    }

    public void setConfidence(Double confidence) {
        this.confidence = confidence;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getModelName() {
        return modelName;
    }

    public void setModelName(String modelName) {
        this.modelName = modelName;
    }

    public String getHighlightedImageUrl() {
        return highlightedImageUrl;
    }

    public void setHighlightedImageUrl(String highlightedImageUrl) {
        this.highlightedImageUrl = highlightedImageUrl;
    }

    public ReviewDecision getLatestReviewDecision() {
        return latestReviewDecision;
    }

    public void setLatestReviewDecision(ReviewDecision latestReviewDecision) {
        this.latestReviewDecision = latestReviewDecision;
    }

    public String getLatestReviewComments() {
        return latestReviewComments;
    }

    public void setLatestReviewComments(String latestReviewComments) {
        this.latestReviewComments = latestReviewComments;
    }

    public LocalDateTime getLatestReviewedAt() {
        return latestReviewedAt;
    }

    public void setLatestReviewedAt(LocalDateTime latestReviewedAt) {
        this.latestReviewedAt = latestReviewedAt;
    }

    public String getReviewerName() {
        return reviewerName;
    }

    public void setReviewerName(String reviewerName) {
        this.reviewerName = reviewerName;
    }

    public String getReviewerEmail() {
        return reviewerEmail;
    }

    public void setReviewerEmail(String reviewerEmail) {
        this.reviewerEmail = reviewerEmail;
    }
}
