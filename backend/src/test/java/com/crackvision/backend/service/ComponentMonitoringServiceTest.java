package com.crackvision.backend.service;

import com.crackvision.backend.dto.monitoring.ComponentComparisonResponse;
import com.crackvision.backend.dto.monitoring.ComponentTimelineResponse;
import com.crackvision.backend.entity.*;
import com.crackvision.backend.repository.AiAnalysisResultRepository;
import com.crackvision.backend.repository.EngineerReviewRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ComponentMonitoringServiceTest {

    @Mock
    private ComponentService componentService;

    @Mock
    private AiAnalysisResultRepository aiAnalysisResultRepository;

    @Mock
    private EngineerReviewRepository engineerReviewRepository;

    @InjectMocks
    private ComponentMonitoringService componentMonitoringService;

    private Component sampleComponent;
    private Inspection inspection1;
    private Inspection inspection2;
    private AiAnalysisResult analysis1;
    private AiAnalysisResult analysis2;

    @BeforeEach
    void setUp() {
        sampleComponent = new Component();
        sampleComponent.setId(10L);
        sampleComponent.setName("Pillar C3");
        sampleComponent.setType("COLUMN");

        inspection1 = new Inspection();
        inspection1.setId(101L);
        inspection1.setComponent(sampleComponent);

        inspection2 = new Inspection();
        inspection2.setId(102L);
        inspection2.setComponent(sampleComponent);

        analysis1 = new AiAnalysisResult();
        analysis1.setId(1L);
        analysis1.setInspection(inspection1);
        analysis1.setStatus("SUCCESS");
        analysis1.setCrackDetected(true);
        analysis1.setScreeningCategory("MINOR");
        analysis1.setCrackAreaPercentage(2.0);
        analysis1.setRegionsCount(3);
        analysis1.setAnalyzedAt(LocalDateTime.of(2026, 8, 1, 10, 0, 0));

        analysis2 = new AiAnalysisResult();
        analysis2.setId(2L);
        analysis2.setInspection(inspection2);
        analysis2.setStatus("SUCCESS");
        analysis2.setCrackDetected(true);
        analysis2.setScreeningCategory("MODERATE");
        analysis2.setCrackAreaPercentage(4.5);
        analysis2.setRegionsCount(5);
        analysis2.setAnalyzedAt(LocalDateTime.of(2026, 9, 1, 10, 0, 0));
    }

    @Test
    void testCompareLatest_PositiveDelta_AreaExpansionIndicated() {
        when(componentService.getComponentById(10L)).thenReturn(sampleComponent);
        // Latest first in DESC order: analysis2 (latest), analysis1 (previous)
        when(aiAnalysisResultRepository.findSuccessfulByComponentIdOrderByAnalyzedAtDesc(10L))
                .thenReturn(List.of(analysis2, analysis1));
        when(engineerReviewRepository.findLatestByAnalysisId(anyLong())).thenReturn(Optional.empty());

        ComponentComparisonResponse response = componentMonitoringService.compareLatestComponentAnalyses(10L);

        assertNotNull(response);
        assertEquals(10L, response.getComponentId());
        assertEquals("Pillar C3", response.getComponentName());
        assertEquals(1L, response.getBaseline().getAnalysisId());
        assertEquals(2L, response.getCurrent().getAnalysisId());
        assertEquals(31L, response.getDaysElapsed()); // Aug 1 to Sep 1 = 31 days
        assertEquals(2.5, response.getAreaPercentageDelta(), 0.001); // 4.5 - 2.0 = 2.5
        assertEquals(2, response.getRegionsCountDelta()); // 5 - 3 = 2
        assertEquals("AREA_EXPANSION_INDICATED", response.getProgressionTrend());
        assertNotNull(response.getComparisonDisclaimer());
    }

    @Test
    void testCompareLatest_ZeroOrNegligibleDelta_StableScreeningMetrics() {
        analysis2.setCrackAreaPercentage(2.02); // difference 0.02 is within 0.05 tolerance
        analysis2.setRegionsCount(3);
        analysis2.setScreeningCategory("MINOR");

        when(componentService.getComponentById(10L)).thenReturn(sampleComponent);
        when(aiAnalysisResultRepository.findSuccessfulByComponentIdOrderByAnalyzedAtDesc(10L))
                .thenReturn(List.of(analysis2, analysis1));

        ComponentComparisonResponse response = componentMonitoringService.compareLatestComponentAnalyses(10L);

        assertEquals(0.02, response.getAreaPercentageDelta(), 0.001);
        assertEquals(0, response.getRegionsCountDelta());
        assertEquals("STABLE_SCREENING_METRICS", response.getProgressionTrend());
        assertFalse(response.getScreeningCategoryChanged());
    }

    @Test
    void testCompareLatest_NegativeDelta_AreaReductionIndicated() {
        analysis2.setCrackAreaPercentage(0.8); // 0.8 - 2.0 = -1.2
        analysis2.setRegionsCount(1);

        when(componentService.getComponentById(10L)).thenReturn(sampleComponent);
        when(aiAnalysisResultRepository.findSuccessfulByComponentIdOrderByAnalyzedAtDesc(10L))
                .thenReturn(List.of(analysis2, analysis1));

        ComponentComparisonResponse response = componentMonitoringService.compareLatestComponentAnalyses(10L);

        assertEquals(-1.2, response.getAreaPercentageDelta(), 0.001);
        assertEquals(-2, response.getRegionsCountDelta());
        assertEquals("AREA_REDUCTION_INDICATED", response.getProgressionTrend());
    }

    @Test
    void testCompareLatest_NewDetection_NewDetectionTrend() {
        analysis1.setCrackDetected(false);
        analysis1.setCrackAreaPercentage(0.0);
        analysis1.setRegionsCount(0);
        analysis1.setScreeningCategory("NORMAL");

        analysis2.setCrackDetected(true);
        analysis2.setCrackAreaPercentage(1.5);
        analysis2.setRegionsCount(2);
        analysis2.setScreeningCategory("MINOR");

        when(componentService.getComponentById(10L)).thenReturn(sampleComponent);
        when(aiAnalysisResultRepository.findSuccessfulByComponentIdOrderByAnalyzedAtDesc(10L))
                .thenReturn(List.of(analysis2, analysis1));

        ComponentComparisonResponse response = componentMonitoringService.compareLatestComponentAnalyses(10L);

        assertTrue(response.getCrackDetectedChanged());
        assertFalse(response.getPreviousCrackDetected());
        assertTrue(response.getCurrentCrackDetected());
        assertEquals("NEW_DETECTION", response.getProgressionTrend());
    }

    @Test
    void testCompareLatest_CategoryChangeTracked() {
        analysis1.setScreeningCategory("MINOR");
        analysis2.setScreeningCategory("SEVERE");

        when(componentService.getComponentById(10L)).thenReturn(sampleComponent);
        when(aiAnalysisResultRepository.findSuccessfulByComponentIdOrderByAnalyzedAtDesc(10L))
                .thenReturn(List.of(analysis2, analysis1));

        ComponentComparisonResponse response = componentMonitoringService.compareLatestComponentAnalyses(10L);

        assertTrue(response.getScreeningCategoryChanged());
        assertEquals("MINOR", response.getPreviousScreeningCategory());
        assertEquals("SEVERE", response.getCurrentScreeningCategory());
    }

    @Test
    void testCompareSpecific_MissingMetricValues_InsufficientData() {
        analysis1.setCrackAreaPercentage(null); // Missing metric

        when(componentService.getComponentById(10L)).thenReturn(sampleComponent);
        when(aiAnalysisResultRepository.findById(1L)).thenReturn(Optional.of(analysis1));
        when(aiAnalysisResultRepository.findById(2L)).thenReturn(Optional.of(analysis2));

        ComponentComparisonResponse response = componentMonitoringService.compareSpecificAnalyses(10L, 1L, 2L);

        assertNull(response.getAreaPercentageDelta());
        assertEquals("INSUFFICIENT_DATA", response.getProgressionTrend());
    }

    @Test
    void testCompareLatest_SingleAnalysisCase_ReturnsBaselineWithoutInventedMetrics() {
        when(componentService.getComponentById(10L)).thenReturn(sampleComponent);
        when(aiAnalysisResultRepository.findSuccessfulByComponentIdOrderByAnalyzedAtDesc(10L))
                .thenReturn(List.of(analysis1)); // Only 1 analysis available

        ComponentComparisonResponse response = componentMonitoringService.compareLatestComponentAnalyses(10L);

        assertNotNull(response);
        assertNull(response.getBaseline());
        assertNotNull(response.getCurrent());
        assertEquals(1L, response.getCurrent().getAnalysisId());
        assertNull(response.getAreaPercentageDelta());
        assertNull(response.getRegionsCountDelta());
        assertNull(response.getDaysElapsed());
        assertEquals("SINGLE_ANALYSIS_BASELINE", response.getProgressionTrend());
        assertTrue(response.getComparisonDisclaimer().contains("Single inspection baseline established"));
    }

    @Test
    void testCompareLatest_ZeroAnalysesCase_ThrowsRuntimeException() {
        when(componentService.getComponentById(10L)).thenReturn(sampleComponent);
        when(aiAnalysisResultRepository.findSuccessfulByComponentIdOrderByAnalyzedAtDesc(10L))
                .thenReturn(Collections.emptyList());

        assertThrows(RuntimeException.class, () ->
                componentMonitoringService.compareLatestComponentAnalyses(10L));
    }

    @Test
    void testCompareSpecific_MissingComponent_ThrowsRuntimeException() {
        when(componentService.getComponentById(999L)).thenThrow(new RuntimeException("Component not found"));

        assertThrows(RuntimeException.class, () ->
                componentMonitoringService.compareSpecificAnalyses(999L, 1L, 2L));
    }

    @Test
    void testCompareSpecific_MissingAnalysis_ThrowsRuntimeException() {
        when(componentService.getComponentById(10L)).thenReturn(sampleComponent);
        when(aiAnalysisResultRepository.findById(1L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () ->
                componentMonitoringService.compareSpecificAnalyses(10L, 1L, 2L));
    }

    @Test
    void testCompareSpecific_AnalysisBelongsToAnotherComponent_ThrowsIllegalArgumentException() {
        Component otherComponent = new Component();
        otherComponent.setId(99L);
        Inspection otherInspection = new Inspection();
        otherInspection.setId(200L);
        otherInspection.setComponent(otherComponent);
        analysis2.setInspection(otherInspection);

        when(componentService.getComponentById(10L)).thenReturn(sampleComponent);
        when(aiAnalysisResultRepository.findById(1L)).thenReturn(Optional.of(analysis1));
        when(aiAnalysisResultRepository.findById(2L)).thenReturn(Optional.of(analysis2));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                componentMonitoringService.compareSpecificAnalyses(10L, 1L, 2L));

        assertTrue(ex.getMessage().contains("does not belong to component"));
    }

    @Test
    void testCompareSpecific_UnsuccessfulAnalysis_ThrowsIllegalArgumentException() {
        analysis2.setStatus("FAILED");

        when(componentService.getComponentById(10L)).thenReturn(sampleComponent);
        when(aiAnalysisResultRepository.findById(1L)).thenReturn(Optional.of(analysis1));
        when(aiAnalysisResultRepository.findById(2L)).thenReturn(Optional.of(analysis2));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                componentMonitoringService.compareSpecificAnalyses(10L, 1L, 2L));

        assertTrue(ex.getMessage().contains("Only successful analyses can be compared"));
    }

    @Test
    void testCompareSpecific_SameAnalysisIds_ThrowsIllegalArgumentException() {
        assertThrows(IllegalArgumentException.class, () ->
                componentMonitoringService.compareSpecificAnalyses(10L, 1L, 1L));
    }

    @Test
    void testGetTimeline_Success_ChronologicalOrderAndReviewsJoined() {
        when(componentService.getComponentById(10L)).thenReturn(sampleComponent);
        when(aiAnalysisResultRepository.findSuccessfulByComponentIdOrderByAnalyzedAtAsc(10L))
                .thenReturn(List.of(analysis1, analysis2));

        User reviewer = new User();
        reviewer.setId(50L);
        reviewer.setName("Eng. Bob");
        reviewer.setEmail("bob@crackvision.com");
        reviewer.setRole(Role.SITE_ENGINEER);

        EngineerReview review2 = new EngineerReview(analysis2, reviewer, ReviewDecision.MONITOR, "Stable hairline crack");
        review2.setId(301L);

        when(engineerReviewRepository.findByAnalysisIdInOrderByCreatedAtDesc(List.of(1L, 2L)))
                .thenReturn(List.of(review2));

        ComponentTimelineResponse response = componentMonitoringService.getComponentTimeline(10L);

        assertNotNull(response);
        assertEquals(10L, response.getComponentId());
        assertEquals("Pillar C3", response.getComponentName());
        assertEquals(2, response.getTotalAnalyses());
        assertEquals(1L, response.getTimeline().get(0).getAnalysisId());
        assertNull(response.getTimeline().get(0).getLatestReviewDecision());

        assertEquals(2L, response.getTimeline().get(1).getAnalysisId());
        assertEquals(ReviewDecision.MONITOR, response.getTimeline().get(1).getLatestReviewDecision());
        assertEquals("Stable hairline crack", response.getTimeline().get(1).getLatestReviewComments());
        assertEquals("Eng. Bob", response.getTimeline().get(1).getReviewerName());
    }
}
