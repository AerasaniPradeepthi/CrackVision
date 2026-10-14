
package com.crackvision.backend.controller;

import com.crackvision.backend.entity.Component;
import com.crackvision.backend.service.ComponentService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/components")
public class ComponentController {

    private final ComponentService componentService;

    public ComponentController(ComponentService componentService) {
        this.componentService = componentService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'PROJECT_MANAGER')")
    public ResponseEntity<Component> createComponent(
            @RequestBody Component component) {
        Component created = componentService.createComponent(component);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping
    public ResponseEntity<List<Component>> getAllComponents() {
        return ResponseEntity.ok(componentService.getAllComponents());
    }

    @GetMapping("/floor/{floorId}")
    public ResponseEntity<List<Component>> getComponentsByFloorId(
            @PathVariable Long floorId) {
        return ResponseEntity.ok(
                componentService.getComponentsByFloorId(floorId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Component> getComponentById(
            @PathVariable Long id) {
        try {
            return ResponseEntity.ok(componentService.getComponentById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PROJECT_MANAGER')")
    public ResponseEntity<Component> updateComponent(
            @PathVariable Long id,
            @RequestBody Component component) {
        try {
            return ResponseEntity.ok(
                    componentService.updateComponent(id, component));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PROJECT_MANAGER')")
    public ResponseEntity<Void> deleteComponent(@PathVariable Long id) {
        componentService.deleteComponent(id);
        return ResponseEntity.noContent().build();
    }
}