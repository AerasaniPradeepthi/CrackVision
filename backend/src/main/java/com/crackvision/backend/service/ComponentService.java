
package com.crackvision.backend.service;

import com.crackvision.backend.entity.Component;
import com.crackvision.backend.repository.ComponentRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ComponentService {

    private final ComponentRepository componentRepository;

    public ComponentService(ComponentRepository componentRepository) {
        this.componentRepository = componentRepository;
    }

    public Component createComponent(Component component) {
        return componentRepository.save(component);
    }

    public List<Component> getAllComponents() {
        return componentRepository.findAll();
    }

    public List<Component> getComponentsByFloorId(Long floorId) {
        return componentRepository.findByFloorId(floorId);
    }

    public Component getComponentById(Long id) {
        return componentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Component not found"));
    }

    public Component updateComponent(Long id, Component component) {
        Component existing = getComponentById(id);
        existing.setName(component.getName());
        existing.setType(component.getType());
        existing.setDescription(component.getDescription());

        return componentRepository.save(existing);
    }

    public void deleteComponent(Long id) {
        componentRepository.deleteById(id);
    }
}