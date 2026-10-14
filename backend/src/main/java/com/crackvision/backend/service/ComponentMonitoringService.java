package com.crackvision.backend.service;

import com.crackvision.backend.dto.monitoring.AnalysisSnapshotDto;
import com.crackvision.backend.dto.monitoring.ComponentComparisonResponse;
import com.crackvision.backend.dto.monitoring.ComponentTimelineResponse;
import com.crackvision.backend.entity.AiAnalysisResult;
import com.crackvision.backend.entity.Component;
import com.crackvision.backend.entity.EngineerReview;
import com.crackvision.backend.repository.AiAnalysisResultRepository;
import com.crackvision.backend.repository.EngineerReviewRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class ComponentMonitoringService {

    public static final double AREA_DELTA_TOLERANCE = 0.05;

    public static final String COMPARISON_DISCLAIMER =
            "Screening metrics are 2D image indicators only. Variations may result from lighting, camera angle, " +
            "distance, or surface moisture. Numeric deltas do not constitute certified physical crack growth rates " +
            "or structural safety certifications. On-site qualified engineer evaluation is required.";

    public static final String SINGLE_ANALYSIS_DISCLAIMER =
            "Single inspection baseline established. A subsequent inspection is required to calculate progression deltas.";

    private final ComponentService componentService;
    private final AiAnalysisResultRepository aiAnalysisResultRepository;
    private final EngineerReviewRepository engineerReviewRepository;

    public ComponentMonitoringService(
            ComponentService componentService,
            AiAnalysisResultRepository aiAnalysisResultRepository,
            EngineerReviewRepository engineerReviewRepository) {
        this.componentService = componentService;
        this.aiAnalysisResultRepository = aiAnalysisResultRepository;
        this.engineerReviewRepository = engineerReviewRepository;
    }

    /**
     * Retrieves the chronological timeline of successful AI analyses and their latest reviews for a component.
     */
    @Transactional(readOnly = true)
    public ComponentTimelineResponse getComponentTimeline(Long componentId) {
        Component component = componentService.getComponentById(componentId);

        List<AiAnalysisResult> analyses = aiAnalysisResultRepository
                .findSuccessfulByComponentIdOrderByAnalyzedAtAsc(componentId);

        if (analyses.isEmpty()) {
            return new ComponentTimelineResponse(component, Collections.emptyList());
        }

        // Batch load latest reviews for all analyses to prevent N+1 queries
        List<Long> analysisIds = analyses.stream().map(AiAnalysisResult::getId).toList();
        Map<Long, EngineerReview> latestReviews = loadLatestReviewsForAnalyses(analysisIds);

        List<AnalysisSnapshotDto> snapshots = analyses.stream()
                .map(a -> new AnalysisSnapshotDto(a, latestReviews.get(a.getId())))
                .toList();

        return new ComponentTimelineResponse(component, snapshots);
    }

    /**
     * Compares the latest two successful AI analyses for a component.
     * Clearly handles components with 0 or 1 analyses without inventing a baseline.
     */
    @Transactional(readOnly = true)
    public ComponentComparisonResponse compareLatestComponentAnalyses(Long componentId) {
        Component component = componentService.getComponentById(componentId);

        List<AiAnalysisResult> analysesDesc = aiAnalysisResultRepository
                .findSuccessfulByComponentIdOrderByAnalyzedAtDesc(componentId);

        if (analysesDesc.isEmpty()) {
            throw new RuntimeException("No successful AI analyses found for component with id: " + componentId);
        }

        if (analysesDesc.size() == 1) {
            AiAnalysisResult single = analysesDesc.get(0);
            EngineerReview review = engineerReviewRepository.findLatestByAnalysisId(single.getId()).orElse(null);
            AnalysisSnapshotDto singleSnapshot = new AnalysisSnapshotDto(single, review);
            return ComponentComparisonResponse.singleAnalysis(component, singleSnapshot, SINGLE_ANALYSIS_DISCLAIMER);
        }

        AiAnalysisResult latest = analysesDesc.get(0);
        AiAnalysisResult previous = analysesDesc.get(1);

        EngineerReview latestReview = engineerReviewRepository.findLatestByAnalysisId(latest.getId()).orElse(null);
        EngineerReview previousReview = engineerReviewRepository.findLatestByAnalysisId(previous.getId()).orElse(null);

        AnalysisSnapshotDto baselineSnapshot = new AnalysisSnapshotDto(previous, previousReview);
        AnalysisSnapshotDto currentSnapshot = new AnalysisSnapshotDto(latest, latestReview);

        return buildComparisonResponse(component, baselineSnapshot, currentSnapshot);
    }

    /**
     * Compares two explicitly selected successful AI analyses for a component.
     */
    @Transactional(readOnly = true)
    public ComponentComparisonResponse compareSpecificAnalyses(
            Long componentId,
            Long baselineAnalysisId,
            Long currentAnalysisId) {

        if (baselineAnalysisId == null || currentAnalysisId == null) {
            throw new IllegalArgumentException("Both baselineId and currentId must be provided for comparison");
        }
        if (baselineAnalysisId.equals(currentAnalysisId)) {
            throw new IllegalArgumentException("Baseline analysis ID and current analysis ID must be distinct for comparison");
        }

        Component component = componentService.getComponentById(componentId);

        AiAnalysisResult baseline = aiAnalysisResultRepository.findById(baselineAnalysisId)
                .orElseThrow(() -> new RuntimeException("Baseline analysis not found with id: " + baselineAnalysisId));

        AiAnalysisResult current = aiAnalysisResultRepository.findById(currentAnalysisId)
                .orElseThrow(() -> new RuntimeException("Current analysis not found with id: " + currentAnalysisId));

        validateAnalysisBelongsToComponent(componentId, baseline, "Baseline", baselineAnalysisId);
        validateAnalysisBelongsToComponent(componentId, current, "Current", currentAnalysisId);

        if (!"SUCCESS".equalsIgnoreCase(baseline.getStatus())) {
            throw new IllegalArgumentException("Baseline analysis with id " + baselineAnalysisId
                    + " has status '" + baseline.getStatus() + "'. Only successful analyses can be compared.");
        }
        if (!"SUCCESS".equalsIgnoreCase(current.getStatus())) {
            throw new IllegalArgumentException("Current analysis with id " + currentAnalysisId
                    + " has status '" + current.getStatus() + "'. Only successful analyses can be compared.");
        }

        EngineerReview baselineReview = engineerReviewRepository.findLatestByAnalysisId(baseline.getId()).orElse(null);
        EngineerReview currentReview = engineerReviewRepository.findLatestByAnalysisId(current.getId()).orElse(null);

        AnalysisSnapshotDto baselineSnapshot = new AnalysisSnapshotDto(baseline, baselineReview);
        AnalysisSnapshotDto currentSnapshot = new AnalysisSnapshotDto(current, currentReview);

        return buildComparisonResponse(component, baselineSnapshot, currentSnapshot);
    }

    private ComponentComparisonResponse buildComparisonResponse(
            Component component,
            AnalysisSnapshotDto baseline,
            AnalysisSnapshotDto current) {

        ComponentComparisonResponse response = new ComponentComparisonResponse();
        response.setComponentId(component.getId());
        response.setComponentName(component.getName());
        response.setComponentType(component.getType());
        response.setBaseline(baseline);
        response.setCurrent(current);

        // Elapsed days
        if (baseline.getAnalyzedAt() != null && current.getAnalyzedAt() != null) {
            long days = ChronoUnit.DAYS.between(baseline.getAnalyzedAt().toLocalDate(), current.getAnalyzedAt().toLocalDate());
            response.setDaysElapsed(Math.abs(days));
        }

        // Crack detection changes
        Boolean prevCrack = baseline.getCrackDetected();
        Boolean currCrack = current.getCrackDetected();
        response.setPreviousCrackDetected(prevCrack);
        response.setCurrentCrackDetected(currCrack);
        if (prevCrack != null && currCrack != null) {
            response.setCrackDetectedChanged(!prevCrack.equals(currCrack));
        }

        // Screening category changes
        String prevCat = baseline.getScreeningCategory();
        String currCat = current.getScreeningCategory();
        response.setPreviousScreeningCategory(prevCat);
        response.setCurrentScreeningCategory(currCat);
        if (prevCat != null && currCat != null) {
            response.setScreeningCategoryChanged(!prevCat.equalsIgnoreCase(currCat));
        }

        // Numeric area delta
        Double prevArea = baseline.getCrackAreaPercentage();
        Double currArea = current.getCrackAreaPercentage();
        if (prevArea != null && currArea != null) {
            double delta = Math.round((currArea - prevArea) * 1000.0) / 1000.0;
            response.setAreaPercentageDelta(delta);
        }

        // Numeric regions delta
        Integer prevRegions = baseline.getRegionsCount();
        Integer currRegions = current.getRegionsCount();
        if (prevRegions != null && currRegions != null) {
            response.setRegionsCountDelta(currRegions - prevRegions);
        }

        // Progression trend
        response.setProgressionTrend(determineProgressionTrend(prevCrack, currCrack, prevArea, currArea));
        response.setComparisonDisclaimer(COMPARISON_DISCLAIMER);

        return response;
    }

    private String determineProgressionTrend(
            Boolean prevCrack,
            Boolean currCrack,
            Double prevArea,
            Double currArea) {

        if (prevCrack == null || currCrack == null || prevArea == null || currArea == null) {
            return "INSUFFICIENT_DATA";
        }

        if (!prevCrack && currCrack) {
            return "NEW_DETECTION";
        }

        if (!prevCrack && !currCrack) {
            return "NO_CANDIDATE_DETECTED";
        }

        double delta = currArea - prevArea;
        if (delta > AREA_DELTA_TOLERANCE) {
            return "AREA_EXPANSION_INDICATED";
        } else if (delta < -AREA_DELTA_TOLERANCE) {
            return "AREA_REDUCTION_INDICATED";
        } else {
            return "STABLE_SCREENING_METRICS";
        }
    }

    private void validateAnalysisBelongsToComponent(
            Long componentId,
            AiAnalysisResult analysis,
            String label,
            Long analysisId) {
        if (analysis.getInspection() == null
                || analysis.getInspection().getComponent() == null
                || !componentId.equals(analysis.getInspection().getComponent().getId())) {
            throw new IllegalArgumentException(label + " analysis with id " + analysisId
                    + " does not belong to component with id " + componentId);
        }
    }

    private Map<Long, EngineerReview> loadLatestReviewsForAnalyses(List<Long> analysisIds) {
        Map<Long, EngineerReview> latestReviews = new HashMap<>();
        if (analysisIds != null && !analysisIds.isEmpty()) {
            List<EngineerReview> reviews = engineerReviewRepository.findByAnalysisIdInOrderByCreatedAtDesc(analysisIds);
            for (EngineerReview r : reviews) {
                // Since reviews are ordered by createdAt DESC, putIfAbsent retains the latest review per analysis
                latestReviews.putIfAbsent(r.getAnalysisId(), r);
            }
        }
        return latestReviews;
    }
}
