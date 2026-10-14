package com.crackvision.backend.dto.monitoring;

import com.crackvision.backend.entity.Component;

public class ComponentComparisonResponse {

    private Long componentId;
    private String componentName;
    private String componentType;

    private AnalysisSnapshotDto baseline;
    private AnalysisSnapshotDto current;

    private Long daysElapsed;
    private Boolean crackDetectedChanged;
    private Boolean previousCrackDetected;
    private Boolean currentCrackDetected;
    private Boolean screeningCategoryChanged;
    private String previousScreeningCategory;
    private String currentScreeningCategory;

    private Double areaPercentageDelta;
    private Integer regionsCountDelta;
    private String progressionTrend;
    private String comparisonDisclaimer;

    public ComponentComparisonResponse() {
    }

    public static ComponentComparisonResponse singleAnalysis(
            Component component,
            AnalysisSnapshotDto current,
            String disclaimer) {
        ComponentComparisonResponse resp = new ComponentComparisonResponse();
        if (component != null) {
            resp.setComponentId(component.getId());
            resp.setComponentName(component.getName());
            resp.setComponentType(component.getType());
        }
        resp.setBaseline(null);
        resp.setCurrent(current);
        resp.setDaysElapsed(null);
        resp.setCrackDetectedChanged(null);
        if (current != null) {
            resp.setCurrentCrackDetected(current.getCrackDetected());
            resp.setCurrentScreeningCategory(current.getScreeningCategory());
        }
        resp.setPreviousCrackDetected(null);
        resp.setScreeningCategoryChanged(null);
        resp.setPreviousScreeningCategory(null);
        resp.setAreaPercentageDelta(null);
        resp.setRegionsCountDelta(null);
        resp.setProgressionTrend("SINGLE_ANALYSIS_BASELINE");
        resp.setComparisonDisclaimer(disclaimer);
        return resp;
    }

    public Long getComponentId() {
        return componentId;
    }

    public void setComponentId(Long componentId) {
        this.componentId = componentId;
    }

    public String getComponentName() {
        return componentName;
    }

    public void setComponentName(String componentName) {
        this.componentName = componentName;
    }

    public String getComponentType() {
        return componentType;
    }

    public void setComponentType(String componentType) {
        this.componentType = componentType;
    }

    public AnalysisSnapshotDto getBaseline() {
        return baseline;
    }

    public void setBaseline(AnalysisSnapshotDto baseline) {
        this.baseline = baseline;
    }

    public AnalysisSnapshotDto getCurrent() {
        return current;
    }

    public void setCurrent(AnalysisSnapshotDto current) {
        this.current = current;
    }

    public Long getDaysElapsed() {
        return daysElapsed;
    }

    public void setDaysElapsed(Long daysElapsed) {
        this.daysElapsed = daysElapsed;
    }

    public Boolean getCrackDetectedChanged() {
        return crackDetectedChanged;
    }

    public void setCrackDetectedChanged(Boolean crackDetectedChanged) {
        this.crackDetectedChanged = crackDetectedChanged;
    }

    public Boolean getPreviousCrackDetected() {
        return previousCrackDetected;
    }

    public void setPreviousCrackDetected(Boolean previousCrackDetected) {
        this.previousCrackDetected = previousCrackDetected;
    }

    public Boolean getCurrentCrackDetected() {
        return currentCrackDetected;
    }

    public void setCurrentCrackDetected(Boolean currentCrackDetected) {
        this.currentCrackDetected = currentCrackDetected;
    }

    public Boolean getScreeningCategoryChanged() {
        return screeningCategoryChanged;
    }

    public void setScreeningCategoryChanged(Boolean screeningCategoryChanged) {
        this.screeningCategoryChanged = screeningCategoryChanged;
    }

    public String getPreviousScreeningCategory() {
        return previousScreeningCategory;
    }

    public void setPreviousScreeningCategory(String previousScreeningCategory) {
        this.previousScreeningCategory = previousScreeningCategory;
    }

    public String getCurrentScreeningCategory() {
        return currentScreeningCategory;
    }

    public void setCurrentScreeningCategory(String currentScreeningCategory) {
        this.currentScreeningCategory = currentScreeningCategory;
    }

    public Double getAreaPercentageDelta() {
        return areaPercentageDelta;
    }

    public void setAreaPercentageDelta(Double areaPercentageDelta) {
        this.areaPercentageDelta = areaPercentageDelta;
    }

    public Integer getRegionsCountDelta() {
        return regionsCountDelta;
    }

    public void setRegionsCountDelta(Integer regionsCountDelta) {
        this.regionsCountDelta = regionsCountDelta;
    }

    public String getProgressionTrend() {
        return progressionTrend;
    }

    public void setProgressionTrend(String progressionTrend) {
        this.progressionTrend = progressionTrend;
    }

    public String getComparisonDisclaimer() {
        return comparisonDisclaimer;
    }

    public void setComparisonDisclaimer(String comparisonDisclaimer) {
        this.comparisonDisclaimer = comparisonDisclaimer;
    }
}
