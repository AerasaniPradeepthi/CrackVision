package com.crackvision.backend.controller;

import com.crackvision.backend.entity.InspectionImage;
import com.crackvision.backend.service.InspectionImageService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/inspections")
public class InspectionImageController {

    private final InspectionImageService inspectionImageService;

    public InspectionImageController(InspectionImageService inspectionImageService) {
        this.inspectionImageService = inspectionImageService;
    }

    @PostMapping("/{inspectionId}/images")
    public ResponseEntity<?> uploadImage(
            @PathVariable Long inspectionId,
            @RequestParam("file") MultipartFile file) {
        try {
            InspectionImage savedImage = inspectionImageService.storeImage(inspectionId, file);
            return ResponseEntity.status(HttpStatus.CREATED).body(savedImage);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to upload image"));
        }
    }

    @GetMapping("/{inspectionId}/images")
    public ResponseEntity<?> getImagesByInspection(
            @PathVariable Long inspectionId) {
        try {
            List<InspectionImage> images = inspectionImageService.getImagesByInspectionId(inspectionId);
            return ResponseEntity.ok(images);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{inspectionId}/images/{imageId}")
    public ResponseEntity<Resource> getImageFile(
            @PathVariable Long inspectionId,
            @PathVariable Long imageId) {
        try {
            InspectionImage image = inspectionImageService.getImageMetadata(inspectionId, imageId);
            Resource resource = inspectionImageService.loadResource(image);

            if (!resource.exists() || !resource.isReadable()) {
                return ResponseEntity.notFound().build();
            }

            MediaType mediaType;
            try {
                mediaType = MediaType.parseMediaType(image.getContentType());
            } catch (Exception e) {
                mediaType = MediaType.APPLICATION_OCTET_STREAM;
            }

            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + image.getOriginalFilename() + "\"")
                    .body(resource);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{inspectionId}/images/{imageId}")
    @PreAuthorize("hasAnyRole('SITE_WORKER', 'SITE_ENGINEER', 'ADMIN', 'PROJECT_MANAGER')")
    public ResponseEntity<?> deleteImage(
            @PathVariable Long inspectionId,
            @PathVariable Long imageId) {
        try {
            inspectionImageService.deleteImage(inspectionId, imageId);
            return ResponseEntity.ok(Map.of(
                    "message", "Photo deleted successfully",
                    "inspectionId", inspectionId,
                    "imageId", imageId
            ));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to delete photo: " + e.getMessage()));
        }
    }
}
