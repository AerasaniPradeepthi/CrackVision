package com.crackvision.backend.controller;

import com.crackvision.backend.entity.Inspection;
import com.crackvision.backend.service.InspectionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/inspections")
public class InspectionController {

    private final InspectionService inspectionService;

    public InspectionController(InspectionService inspectionService) {
        this.inspectionService = inspectionService;
    }

    @PostMapping
    public ResponseEntity<Inspection> createInspection(@RequestBody Inspection inspection) {
        Inspection created = inspectionService.createInspection(inspection);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping
    public ResponseEntity<List<Inspection>> getAllInspections() {
        return ResponseEntity.ok(inspectionService.getAllInspections());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Inspection> getInspectionById(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(inspectionService.getInspectionById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/component/{componentId}")
    public ResponseEntity<List<Inspection>> getInspectionsByComponentId(@PathVariable Long componentId) {
        return ResponseEntity.ok(inspectionService.getInspectionsByComponentId(componentId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Inspection> updateInspection(
            @PathVariable Long id,
            @RequestBody Inspection inspection) {
        try {
            return ResponseEntity.ok(inspectionService.updateInspection(id, inspection));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteInspection(@PathVariable Long id) {
        try {
            inspectionService.deleteInspection(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
