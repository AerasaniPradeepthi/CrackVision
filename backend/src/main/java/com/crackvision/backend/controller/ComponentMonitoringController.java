package com.crackvision.backend.controller;

import com.crackvision.backend.dto.monitoring.ComponentComparisonResponse;
import com.crackvision.backend.dto.monitoring.ComponentTimelineResponse;
import com.crackvision.backend.service.ComponentMonitoringService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/components")
public class ComponentMonitoringController {

    private final ComponentMonitoringService componentMonitoringService;

    public ComponentMonitoringController(ComponentMonitoringService componentMonitoringService) {
        this.componentMonitoringService = componentMonitoringService;
    }

    /**
     * Retrieves the chronological AI screening timeline for a structural component.
     */
    @GetMapping("/{componentId}/monitoring/timeline")
    public ResponseEntity<?> getComponentTimeline(@PathVariable Long componentId) {
        try {
            ComponentTimelineResponse response = componentMonitoringService.getComponentTimeline(componentId);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Compares AI analyses for a structural component over time.
     * If baselineId and currentId are provided, compares those specific two analyses.
     * If neither is provided, compares the latest two analyses for the component.
     */
    @GetMapping("/{componentId}/monitoring/compare")
    public ResponseEntity<?> compareAnalyses(
            @PathVariable Long componentId,
            @RequestParam(required = false) Long baselineId,
            @RequestParam(required = false) Long currentId) {
        try {
            if (baselineId != null && currentId != null) {
                ComponentComparisonResponse response = componentMonitoringService
                        .compareSpecificAnalyses(componentId, baselineId, currentId);
                return ResponseEntity.ok(response);
            } else if (baselineId == null && currentId == null) {
                ComponentComparisonResponse response = componentMonitoringService
                        .compareLatestComponentAnalyses(componentId);
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Both baselineId and currentId must be provided together, or omit both to compare the latest two analyses."
                ));
            }
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Unexpected error comparing analyses: " + e.getMessage()));
        }
    }
}
