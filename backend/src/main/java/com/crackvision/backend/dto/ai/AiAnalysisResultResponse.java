package com.crackvision.backend.dto.ai;

import com.crackvision.backend.entity.AiAnalysisResult;

import java.time.LocalDateTime;

public class AiAnalysisResultResponse {

    private Long id;
    private Long inspectionId;
    private Long imageId;
    private Boolean crackDetected;
    private String screeningCategory;
    private Double confidence;
    private Double crackAreaPercentage;
    private Integer regionsCount;
    private String highlightedImageUrl;
    private String imageUrl;
    private String storagePath;
    private String originalFilename;
    private String modelName;
    private String modelVersion;
    private String modelType;
    private String status;
    private String errorMessage;
    private String disclaimer;
    private LocalDateTime analyzedAt;
    private LocalDateTime createdAt;

    public AiAnalysisResultResponse() {
    }

    public AiAnalysisResultResponse(AiAnalysisResult entity) {
        if (entity != null) {
            this.id = entity.getId();
            this.inspectionId = entity.getInspectionId();
            this.imageId = entity.getImageId();
            if (entity.getInspectionImage() != null) {
                this.imageUrl = entity.getInspectionImage().getImageUrl();
                this.storagePath = entity.getInspectionImage().getStoragePath();
                this.originalFilename = entity.getInspectionImage().getOriginalFilename();
            }
            this.crackDetected = entity.getCrackDetected();
            this.screeningCategory = entity.getScreeningCategory();
            this.confidence = entity.getConfidence();
            this.crackAreaPercentage = entity.getCrackAreaPercentage();
            this.regionsCount = entity.getRegionsCount();
            this.highlightedImageUrl = entity.getHighlightedImageUrl();
            this.modelName = entity.getModelName();
            this.modelVersion = entity.getModelVersion();
            this.modelType = entity.getModelType();
            this.status = entity.getStatus();
            this.errorMessage = entity.getErrorMessage();
            this.disclaimer = entity.getDisclaimer();
            this.analyzedAt = entity.getAnalyzedAt();
            this.createdAt = entity.getCreatedAt();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public String getStoragePath() {
        return storagePath;
    }

    public void setStoragePath(String storagePath) {
        this.storagePath = storagePath;
    }

    public String getOriginalFilename() {
        return originalFilename;
    }

    public void setOriginalFilename(String originalFilename) {
        this.originalFilename = originalFilename;
    }
}
