package com.crackvision.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "ai_analysis_results")
public class AiAnalysisResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inspection_id", nullable = false)
    @JsonIgnore
    private Inspection inspection;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "image_id", nullable = false)
    @JsonIgnore
    private InspectionImage inspectionImage;

    @Column(name = "crack_detected", nullable = false)
    private Boolean crackDetected;

    @Column(name = "screening_category", nullable = false)
    private String screeningCategory;

    @Column(name = "confidence")
    private Double confidence;

    @Column(name = "crack_area_percentage", nullable = false)
    private Double crackAreaPercentage;

    @Column(name = "regions_count", nullable = false)
    private Integer regionsCount;

    @Column(name = "highlighted_image_url")
    private String highlightedImageUrl;

    @Column(name = "model_name")
    private String modelName;

    @Column(name = "model_version")
    private String modelVersion;

    @Column(name = "model_type")
    private String modelType;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    @Column(name = "disclaimer", length = 1000)
    private String disclaimer;

    @Column(name = "analyzed_at", nullable = false)
    private LocalDateTime analyzedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public AiAnalysisResult() {
    }

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        if (this.analyzedAt == null) {
            this.analyzedAt = LocalDateTime.now();
        }
        if (this.status == null) {
            this.status = "SUCCESS";
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Inspection getInspection() {
        return inspection;
    }

    public void setInspection(Inspection inspection) {
        this.inspection = inspection;
    }

    public Long getInspectionId() {
        return inspection != null ? inspection.getId() : null;
    }

    public InspectionImage getInspectionImage() {
        return inspectionImage;
    }

    public void setInspectionImage(InspectionImage inspectionImage) {
        this.inspectionImage = inspectionImage;
    }

    public Long getImageId() {
        return inspectionImage != null ? inspectionImage.getId() : null;
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

    public Double getConfidence() {
        return confidence;
    }

    public void setConfidence(Double confidence) {
        this.confidence = confidence;
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

    public String getHighlightedImageUrl() {
        return highlightedImageUrl;
    }

    public void setHighlightedImageUrl(String highlightedImageUrl) {
        this.highlightedImageUrl = highlightedImageUrl;
    }

    public String getModelName() {
        return modelName;
    }

    public void setModelName(String modelName) {
        this.modelName = modelName;
    }

    public String getModelVersion() {
        return modelVersion;
    }

    public void setModelVersion(String modelVersion) {
        this.modelVersion = modelVersion;
    }

    public String getModelType() {
        return modelType;
    }

    public void setModelType(String modelType) {
        this.modelType = modelType;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public String getDisclaimer() {
        return disclaimer;
    }

    public void setDisclaimer(String disclaimer) {
        this.disclaimer = disclaimer;
    }

    public LocalDateTime getAnalyzedAt() {
        return analyzedAt;
    }

    public void setAnalyzedAt(LocalDateTime analyzedAt) {
        this.analyzedAt = analyzedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
