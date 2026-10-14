package com.crackvision.backend.service;

import com.crackvision.backend.entity.Building;
import com.crackvision.backend.repository.BuildingRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class BuildingService {

    private final BuildingRepository buildingRepository;

    public BuildingService(BuildingRepository buildingRepository) {
        this.buildingRepository = buildingRepository;
    }

    public Building createBuilding(Building building) {
        return buildingRepository.save(building);
    }

    public List<Building> getAllBuildings() {
        return buildingRepository.findAll();
    }

    public List<Building> getBuildingsByProjectId(Long projectId) {
        return buildingRepository.findByProjectId(projectId);
    }

    public Building getBuildingById(Long id) {
        return buildingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Building not found"));
    }

    public Building updateBuilding(Long id, Building building) {
        Building existingBuilding = buildingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Building not found"));

        existingBuilding.setName(building.getName());
        existingBuilding.setDescription(building.getDescription());

        return buildingRepository.save(existingBuilding);
    }

    public void deleteBuilding(Long id) {
        buildingRepository.deleteById(id);
    }
}
