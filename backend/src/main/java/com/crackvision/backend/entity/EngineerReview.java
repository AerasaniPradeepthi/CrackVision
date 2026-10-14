package com.crackvision.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "engineer_reviews")
public class EngineerReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "analysis_id", nullable = false)
    @JsonIgnore
    private AiAnalysisResult aiAnalysisResult;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewer_id", nullable = false)
    @JsonIgnore
    private User reviewer;

    @Enumerated(EnumType.STRING)
    @Column(name = "decision", nullable = false)
    private ReviewDecision decision;

    @Column(name = "comments", length = 2000, nullable = false)
    private String comments;

    @Column(name = "reviewed_at", nullable = false)
    private LocalDateTime reviewedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public EngineerReview() {
    }

    public EngineerReview(AiAnalysisResult aiAnalysisResult, User reviewer, ReviewDecision decision, String comments) {
        this.aiAnalysisResult = aiAnalysisResult;
        this.reviewer = reviewer;
        this.decision = decision;
        this.comments = comments;
        this.reviewedAt = LocalDateTime.now();
        this.createdAt = LocalDateTime.now();
    }

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        if (this.reviewedAt == null) {
            this.reviewedAt = LocalDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public AiAnalysisResult getAiAnalysisResult() {
        return aiAnalysisResult;
    }

    public void setAiAnalysisResult(AiAnalysisResult aiAnalysisResult) {
        this.aiAnalysisResult = aiAnalysisResult;
    }

    public User getReviewer() {
        return reviewer;
    }

    public void setReviewer(User reviewer) {
        this.reviewer = reviewer;
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

    // Helper convenience getters for DTO mapping
    public Long getAnalysisId() {
        return aiAnalysisResult != null ? aiAnalysisResult.getId() : null;
    }

    public Long getInspectionId() {
        return (aiAnalysisResult != null && aiAnalysisResult.getInspection() != null)
                ? aiAnalysisResult.getInspection().getId()
                : null;
    }

    public Long getImageId() {
        return (aiAnalysisResult != null && aiAnalysisResult.getInspectionImage() != null)
                ? aiAnalysisResult.getInspectionImage().getId()
                : null;
    }

    public Long getReviewerId() {
        return reviewer != null ? reviewer.getId() : null;
    }

    public String getReviewerName() {
        return reviewer != null ? reviewer.getName() : null;
    }

    public String getReviewerEmail() {
        return reviewer != null ? reviewer.getEmail() : null;
    }

    public Role getReviewerRole() {
        return reviewer != null ? reviewer.getRole() : null;
    }
}
