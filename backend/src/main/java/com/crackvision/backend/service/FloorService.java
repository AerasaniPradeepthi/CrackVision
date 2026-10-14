
package com.crackvision.backend.service;

import com.crackvision.backend.entity.Floor;
import com.crackvision.backend.repository.FloorRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class FloorService {

    private final FloorRepository floorRepository;

    public FloorService(FloorRepository floorRepository) {
        this.floorRepository = floorRepository;
    }

    public Floor createFloor(Floor floor) {
        return floorRepository.save(floor);
    }

    public List<Floor> getAllFloors() {
        return floorRepository.findAll();
    }

    public List<Floor> getFloorsByBuildingId(Long buildingId) {
        return floorRepository.findByBuildingId(buildingId);
    }

    public Floor getFloorById(Long id) {
        return floorRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Floor not found"));
    }

    public Floor updateFloor(Long id, Floor floor) {
        Floor existingFloor = getFloorById(id);
        existingFloor.setName(floor.getName());
        existingFloor.setDescription(floor.getDescription());
        return floorRepository.save(existingFloor);
    }

    public void deleteFloor(Long id) {
        floorRepository.deleteById(id);
    }
}