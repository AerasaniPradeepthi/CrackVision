package com.crackvision.backend.controller;

import com.crackvision.backend.dto.monitoring.AnalysisSnapshotDto;
import com.crackvision.backend.dto.monitoring.ComponentComparisonResponse;
import com.crackvision.backend.dto.monitoring.ComponentTimelineResponse;
import com.crackvision.backend.entity.Component;
import com.crackvision.backend.service.ComponentMonitoringService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class ComponentMonitoringControllerTest {

    @Mock
    private ComponentMonitoringService componentMonitoringService;

    @InjectMocks
    private ComponentMonitoringController componentMonitoringController;

    private MockMvc mockMvc;
    private Component sampleComponent;
    private ComponentComparisonResponse sampleComparison;
    private ComponentTimelineResponse sampleTimeline;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(componentMonitoringController).build();

        sampleComponent = new Component();
        sampleComponent.setId(10L);
        sampleComponent.setName("Wall South");
        sampleComponent.setType("SHEAR_WALL");

        AnalysisSnapshotDto baseline = new AnalysisSnapshotDto();
        baseline.setAnalysisId(1L);
        baseline.setInspectionId(100L);
        baseline.setImageId(10L);
        baseline.setCrackDetected(true);
        baseline.setScreeningCategory("MINOR");
        baseline.setCrackAreaPercentage(1.2);
        baseline.setRegionsCount(2);
        baseline.setAnalyzedAt(LocalDateTime.of(2026, 7, 1, 10, 0));

        AnalysisSnapshotDto current = new AnalysisSnapshotDto();
        current.setAnalysisId(2L);
        current.setInspectionId(101L);
        current.setImageId(11L);
        current.setCrackDetected(true);
        current.setScreeningCategory("MODERATE");
        current.setCrackAreaPercentage(2.8);
        current.setRegionsCount(4);
        current.setAnalyzedAt(LocalDateTime.of(2026, 8, 1, 10, 0));

        sampleComparison = new ComponentComparisonResponse();
        sampleComparison.setComponentId(10L);
        sampleComparison.setComponentName("Wall South");
        sampleComparison.setComponentType("SHEAR_WALL");
        sampleComparison.setBaseline(baseline);
        sampleComparison.setCurrent(current);
        sampleComparison.setDaysElapsed(31L);
        sampleComparison.setCrackDetectedChanged(false);
        sampleComparison.setScreeningCategoryChanged(true);
        sampleComparison.setPreviousScreeningCategory("MINOR");
        sampleComparison.setCurrentScreeningCategory("MODERATE");
        sampleComparison.setAreaPercentageDelta(1.6);
        sampleComparison.setRegionsCountDelta(2);
        sampleComparison.setProgressionTrend("AREA_EXPANSION_INDICATED");
        sampleComparison.setComparisonDisclaimer("Screening metrics only.");

        sampleTimeline = new ComponentTimelineResponse(sampleComponent, List.of(baseline, current));
    }

    @Test
    void testGetTimeline_Success_Returns200AndTimeline() throws Exception {
        when(componentMonitoringService.getComponentTimeline(10L)).thenReturn(sampleTimeline);

        mockMvc.perform(get("/api/components/10/monitoring/timeline"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.componentId", is(10)))
                .andExpect(jsonPath("$.componentName", is("Wall South")))
                .andExpect(jsonPath("$.totalAnalyses", is(2)))
                .andExpect(jsonPath("$.timeline", hasSize(2)))
                .andExpect(jsonPath("$.timeline[0].analysisId", is(1)))
                .andExpect(jsonPath("$.timeline[1].analysisId", is(2)));

        verify(componentMonitoringService).getComponentTimeline(10L);
    }

    @Test
    void testGetTimeline_ComponentNotFound_Returns404() throws Exception {
        when(componentMonitoringService.getComponentTimeline(99L))
                .thenThrow(new RuntimeException("Component not found with id: 99"));

        mockMvc.perform(get("/api/components/99/monitoring/timeline"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error", containsString("Component not found")));
    }

    @Test
    void testCompareLatest_Success_Returns200AndComparison() throws Exception {
        when(componentMonitoringService.compareLatestComponentAnalyses(10L)).thenReturn(sampleComparison);

        mockMvc.perform(get("/api/components/10/monitoring/compare"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.componentId", is(10)))
                .andExpect(jsonPath("$.baseline.analysisId", is(1)))
                .andExpect(jsonPath("$.current.analysisId", is(2)))
                .andExpect(jsonPath("$.areaPercentageDelta", is(1.6)))
                .andExpect(jsonPath("$.regionsCountDelta", is(2)))
                .andExpect(jsonPath("$.progressionTrend", is("AREA_EXPANSION_INDICATED")));

        verify(componentMonitoringService).compareLatestComponentAnalyses(10L);
    }

    @Test
    void testCompareSpecific_Success_Returns200AndComparison() throws Exception {
        when(componentMonitoringService.compareSpecificAnalyses(10L, 1L, 2L)).thenReturn(sampleComparison);

        mockMvc.perform(get("/api/components/10/monitoring/compare")
                        .param("baselineId", "1")
                        .param("currentId", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.componentId", is(10)))
                .andExpect(jsonPath("$.baseline.analysisId", is(1)))
                .andExpect(jsonPath("$.current.analysisId", is(2)))
                .andExpect(jsonPath("$.daysElapsed", is(31)));

        verify(componentMonitoringService).compareSpecificAnalyses(10L, 1L, 2L);
    }

    @Test
    void testCompare_OnlyOneIdProvided_Returns400() throws Exception {
        mockMvc.perform(get("/api/components/10/monitoring/compare")
                        .param("baselineId", "1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("Both baselineId and currentId must be provided together")));

        verifyNoInteractions(componentMonitoringService);
    }

    @Test
    void testCompare_InvalidAnalysis_Returns400() throws Exception {
        when(componentMonitoringService.compareSpecificAnalyses(10L, 1L, 99L))
                .thenThrow(new IllegalArgumentException("Analysis with id 99 does not belong to component with id 10"));

        mockMvc.perform(get("/api/components/10/monitoring/compare")
                        .param("baselineId", "1")
                        .param("currentId", "99"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("does not belong to component")));
    }

    @Test
    void testCompare_NoAnalysesAvailable_Returns404() throws Exception {
        when(componentMonitoringService.compareLatestComponentAnalyses(10L))
                .thenThrow(new RuntimeException("No successful AI analyses found for component with id: 10"));

        mockMvc.perform(get("/api/components/10/monitoring/compare"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error", containsString("No successful AI analyses found")));
    }
}
