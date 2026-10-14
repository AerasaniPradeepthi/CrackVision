package com.crackvision.backend.dto.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public class PythonAnalysisResponse {

    private String status;

    @JsonProperty("crack_detected")
    private Boolean crackDetected;

    @JsonProperty("screening_category")
    private String screeningCategory;

    private Double confidence;

    @JsonProperty("regions_count")
    private Integer regionsCount;

    @JsonProperty("crack_area_percentage")
    private Double crackAreaPercentage;

    @JsonProperty("highlighted_image_url")
    private String highlightedImageUrl;

    @JsonProperty("original_filename")
    private String originalFilename;

    @JsonProperty("model_info")
    private ModelInfoDto modelInfo;

    private String disclaimer;

    @JsonProperty("processed_at")
    private String processedAt;

    public PythonAnalysisResponse() {
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
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

    public Integer getRegionsCount() {
        return regionsCount;
    }

    public void setRegionsCount(Integer regionsCount) {
        this.regionsCount = regionsCount;
    }

    public Double getCrackAreaPercentage() {
        return crackAreaPercentage;
    }

    public void setCrackAreaPercentage(Double crackAreaPercentage) {
        this.crackAreaPercentage = crackAreaPercentage;
    }

    public String getHighlightedImageUrl() {
        return highlightedImageUrl;
    }

    public void setHighlightedImageUrl(String highlightedImageUrl) {
        this.highlightedImageUrl = highlightedImageUrl;
    }

    public String getOriginalFilename() {
        return originalFilename;
    }

    public void setOriginalFilename(String originalFilename) {
        this.originalFilename = originalFilename;
    }

    public ModelInfoDto getModelInfo() {
        return modelInfo;
    }

    public void setModelInfo(ModelInfoDto modelInfo) {
        this.modelInfo = modelInfo;
    }

    public String getDisclaimer() {
        return disclaimer;
    }

    public void setDisclaimer(String disclaimer) {
        this.disclaimer = disclaimer;
    }

    public String getProcessedAt() {
        return processedAt;
    }

    public void setProcessedAt(String processedAt) {
        this.processedAt = processedAt;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ModelInfoDto {
        private String name;
        private String version;

        @JsonProperty("model_type")
        private String modelType;

        private String method;

        public ModelInfoDto() {
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getVersion() {
            return version;
        }

        public void setVersion(String version) {
            this.version = version;
        }

        public String getModelType() {
            return modelType;
        }

        public void setModelType(String modelType) {
            this.modelType = modelType;
        }

        public String getMethod() {
            return method;
        }

        public void setMethod(String method) {
            this.method = method;
        }
    }
}
