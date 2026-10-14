package com.crackvision.backend.dto.monitoring;

import com.crackvision.backend.entity.Component;

import java.util.ArrayList;
import java.util.List;

public class ComponentTimelineResponse {

    private Long componentId;
    private String componentName;
    private String componentType;
    private String componentDescription;
    private Integer totalAnalyses;
    private List<AnalysisSnapshotDto> timeline = new ArrayList<>();

    public ComponentTimelineResponse() {
    }

    public ComponentTimelineResponse(Component component, List<AnalysisSnapshotDto> timeline) {
        if (component != null) {
            this.componentId = component.getId();
            this.componentName = component.getName();
            this.componentType = component.getType();
            this.componentDescription = component.getDescription();
        }
        if (timeline != null) {
            this.timeline = timeline;
            this.totalAnalyses = timeline.size();
        } else {
            this.totalAnalyses = 0;
        }
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

    public String getComponentDescription() {
        return componentDescription;
    }

    public void setComponentDescription(String componentDescription) {
        this.componentDescription = componentDescription;
    }

    public Integer getTotalAnalyses() {
        return totalAnalyses;
    }

    public void setTotalAnalyses(Integer totalAnalyses) {
        this.totalAnalyses = totalAnalyses;
    }

    public List<AnalysisSnapshotDto> getTimeline() {
        return timeline;
    }

    public void setTimeline(List<AnalysisSnapshotDto> timeline) {
        this.timeline = timeline;
        this.totalAnalyses = timeline != null ? timeline.size() : 0;
    }
}
