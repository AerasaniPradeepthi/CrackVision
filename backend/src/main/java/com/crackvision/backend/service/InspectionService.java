package com.crackvision.backend.service;

import com.crackvision.backend.entity.Inspection;
import com.crackvision.backend.repository.InspectionRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class InspectionService {

    private final InspectionRepository inspectionRepository;

    public InspectionService(InspectionRepository inspectionRepository) {
        this.inspectionRepository = inspectionRepository;
    }

    public Inspection createInspection(Inspection inspection) {
        return inspectionRepository.save(inspection);
    }

    public List<Inspection> getAllInspections() {
        return inspectionRepository.findAll();
    }

    public Inspection getInspectionById(Long id) {
        return inspectionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Inspection not found"));
    }

    public List<Inspection> getInspectionsByComponentId(Long componentId) {
        return inspectionRepository.findByComponentId(componentId);
    }

    public Inspection updateInspection(Long id, Inspection inspection) {
        Inspection existing = getInspectionById(id);
        existing.setNotes(inspection.getNotes());
        if (inspection.getStatus() != null) {
            existing.setStatus(inspection.getStatus());
        }
        return inspectionRepository.save(existing);
    }

    public void deleteInspection(Long id) {
        Inspection existing = getInspectionById(id);
        inspectionRepository.delete(existing);
    }
}
