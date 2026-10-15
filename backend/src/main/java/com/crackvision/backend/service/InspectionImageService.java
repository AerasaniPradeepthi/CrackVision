package com.crackvision.backend.service;

import com.crackvision.backend.entity.AiAnalysisResult;
import com.crackvision.backend.entity.EngineerReview;
import com.crackvision.backend.entity.Inspection;
import com.crackvision.backend.entity.InspectionImage;
import com.crackvision.backend.repository.AiAnalysisResultRepository;
import com.crackvision.backend.repository.EngineerReviewRepository;
import com.crackvision.backend.repository.InspectionImageRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class InspectionImageService {

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp"
    );

    private final InspectionImageRepository inspectionImageRepository;
    private final InspectionService inspectionService;
    private final AiAnalysisResultRepository aiAnalysisResultRepository;
    private final EngineerReviewRepository engineerReviewRepository;
    private final CloudinaryService cloudinaryService;

    @Value("${crackvision.upload.dir:uploads/inspections}")
    private String uploadDir;

    public InspectionImageService(InspectionImageRepository inspectionImageRepository,
                                  InspectionService inspectionService,
                                  AiAnalysisResultRepository aiAnalysisResultRepository,
                                  EngineerReviewRepository engineerReviewRepository,
                                  CloudinaryService cloudinaryService) {
        this.inspectionImageRepository = inspectionImageRepository;
        this.inspectionService = inspectionService;
        this.aiAnalysisResultRepository = aiAnalysisResultRepository;
        this.engineerReviewRepository = engineerReviewRepository;
        this.cloudinaryService = cloudinaryService;
    }

    private Path getUploadPath() {
        Path path = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            if (!Files.exists(path)) {
                Files.createDirectories(path);
            }
        } catch (IOException e) {
            throw new RuntimeException("Could not initialize upload directory: " + uploadDir, e);
        }
        return path;
    }

    private String determineExtension(String originalFilename, String contentType) {
        if (originalFilename != null && originalFilename.contains(".")) {
            String ext = originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase();
            if (ext.equals(".jpg") || ext.equals(".jpeg") || ext.equals(".png") || ext.equals(".webp")) {
                return ext;
            }
        }
        if ("image/png".equalsIgnoreCase(contentType)) {
            return ".png";
        }
        if ("image/webp".equalsIgnoreCase(contentType)) {
            return ".webp";
        }
        return ".jpg";
    }

    public InspectionImage storeImage(Long inspectionId, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File cannot be empty");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("File size exceeds 10 MB limit");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw new IllegalArgumentException("Unsupported image format. Allowed formats: JPEG, PNG, WebP");
        }

        Inspection inspection = inspectionService.getInspectionById(inspectionId);

        // 1. If Cloudinary is configured, upload to cloud storage
        if (cloudinaryService != null && cloudinaryService.isConfigured()) {
            String folder = "crackvision/inspections/" + inspectionId;
            String secureUrl = cloudinaryService.uploadImage(file, folder);

            String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "inspection_photo.jpg";
            String storedFilename = CloudinaryService.extractPublicId(secureUrl);
            if (storedFilename == null || storedFilename.isBlank()) {
                storedFilename = UUID.randomUUID().toString();
            }

            InspectionImage image = new InspectionImage();
            image.setInspection(inspection);
            image.setOriginalFilename(originalFilename);
            image.setStoredFilename(storedFilename);
            image.setStoragePath(secureUrl);
            image.setContentType(contentType.toLowerCase());
            image.setFileSize(file.getSize());

            return inspectionImageRepository.save(image);
        }

        // 2. Fallback to local storage
        String extension = determineExtension(file.getOriginalFilename(), contentType);
        String storedFilename = UUID.randomUUID().toString() + extension;

        Path uploadPath = getUploadPath();
        Path targetPath = uploadPath.resolve(storedFilename).normalize();

        if (!targetPath.startsWith(uploadPath)) {
            throw new SecurityException("Invalid file storage destination");
        }

        Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

        String normalizedDir = uploadDir.replace("\\", "/");
        if (!normalizedDir.endsWith("/")) {
            normalizedDir += "/";
        }
        String relativeStoragePath = normalizedDir + storedFilename;

        InspectionImage image = new InspectionImage();
        image.setInspection(inspection);
        image.setOriginalFilename(file.getOriginalFilename() != null ? file.getOriginalFilename() : storedFilename);
        image.setStoredFilename(storedFilename);
        image.setStoragePath(relativeStoragePath);
        image.setContentType(contentType.toLowerCase());
        image.setFileSize(file.getSize());

        return inspectionImageRepository.save(image);
    }

    /**
     * Associates an existing trusted Cloudinary image URL directly with an inspection.
     * Prevents SSRF by validating the URL against trusted HTTPS Cloudinary domains.
     */
    public InspectionImage linkImageUrl(Long inspectionId, String imageUrl, String customFilename) {
        if (imageUrl == null || imageUrl.trim().isEmpty()) {
            throw new IllegalArgumentException("Image URL cannot be empty");
        }

        String normalizedUrl = imageUrl.trim();
        CloudinaryService.validateTrustedCloudinaryUrl(normalizedUrl);

        Inspection inspection = inspectionService.getInspectionById(inspectionId);

        String filename = customFilename != null && !customFilename.isBlank()
                ? customFilename.trim()
                : extractFilenameFromUrl(normalizedUrl);

        String storedFilename = CloudinaryService.extractPublicId(normalizedUrl);
        if (storedFilename == null || storedFilename.isBlank()) {
            storedFilename = filename;
        }

        String contentType = determineContentTypeFromFilenameOrUrl(filename, normalizedUrl);

        InspectionImage image = new InspectionImage();
        image.setInspection(inspection);
        image.setOriginalFilename(filename);
        image.setStoredFilename(storedFilename);
        image.setStoragePath(normalizedUrl);
        image.setContentType(contentType);
        image.setFileSize(0L);

        return inspectionImageRepository.save(image);
    }

    private String extractFilenameFromUrl(String url) {
        if (url == null || url.isBlank()) return "photo.jpg";
        String path = url;
        int queryIdx = path.indexOf('?');
        if (queryIdx != -1) path = path.substring(0, queryIdx);
        int slashIdx = path.lastIndexOf('/');
        String lastPart = slashIdx != -1 ? path.substring(slashIdx + 1) : path;
        if (!lastPart.contains(".")) {
            lastPart = lastPart + ".jpg";
        }
        return lastPart;
    }

    private String determineContentTypeFromFilenameOrUrl(String filename, String url) {
        String lower = (filename + " " + url).toLowerCase();
        if (lower.contains(".png") || lower.contains("/png")) {
            return "image/png";
        }
        if (lower.contains(".webp") || lower.contains("/webp")) {
            return "image/webp";
        }
        return "image/jpeg";
    }

    public List<InspectionImage> getImagesByInspectionId(Long inspectionId) {
        inspectionService.getInspectionById(inspectionId);
        return inspectionImageRepository.findByInspectionId(inspectionId);
    }

    public InspectionImage getImageMetadata(Long inspectionId, Long imageId) {
        inspectionService.getInspectionById(inspectionId);
        return inspectionImageRepository.findByIdAndInspectionId(imageId, inspectionId)
                .orElseThrow(() -> new RuntimeException("Image not found"));
    }

    public Resource loadResource(InspectionImage image) {
        if (image == null) {
            throw new IllegalArgumentException("Inspection image cannot be null");
        }

        String storagePath = image.getStoragePath();

        // 1. If stored as a remote Cloudinary URL, validate against SSRF and return UrlResource
        if (CloudinaryService.isCloudinaryUrl(storagePath)) {
            CloudinaryService.validateTrustedCloudinaryUrl(storagePath);
            try {
                Resource resource = new UrlResource(java.net.URI.create(storagePath).toURL());
                if (resource.exists() && resource.isReadable()) {
                    return resource;
                } else {
                    throw new RuntimeException("Cloudinary image resource not accessible at " + storagePath);
                }
            } catch (MalformedURLException e) {
                throw new RuntimeException("Invalid Cloudinary image URL: " + storagePath, e);
            }
        }

        // 2. Fallback to local filesystem storage
        Path uploadPath = getUploadPath();
        Path filePath = uploadPath.resolve(image.getStoredFilename()).normalize();

        if (!filePath.startsWith(uploadPath)) {
            throw new SecurityException("Invalid file access path");
        }

        try {
            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists() && resource.isReadable()) {
                return resource;
            } else {
                throw new RuntimeException("Image file not found on disk");
            }
        } catch (MalformedURLException e) {
            throw new RuntimeException("Could not read image file", e);
        }
    }

    /**
     * Securely deletes an uploaded inspection photo.
     * Verifies the image belongs to the inspection.
     * Rejects deletion with 409 Conflict if certified engineering reviews exist to protect audit compliance.
     * If unreviewed, cleans up associated AI analysis results and generated output files.
     * Deletes physical original file from disk.
     * Preserves inspection record, and transitions status back to PENDING_AI_ANALYSIS if no images remain and status was IN_PROGRESS.
     */
    @Transactional
    public void deleteImage(Long inspectionId, Long imageId) {
        Inspection inspection = inspectionService.getInspectionById(inspectionId);

        InspectionImage image = inspectionImageRepository.findByIdAndInspectionId(imageId, inspectionId)
                .orElseThrow(() -> new RuntimeException("Image not found with ID " + imageId + " for inspection " + inspectionId));

        // Audit & Review protection: Check for related AiAnalysisResult records
        List<AiAnalysisResult> analysisResults = aiAnalysisResultRepository.findByInspectionImageIdOrderByCreatedAtDesc(imageId);
        if (!analysisResults.isEmpty()) {
            List<Long> analysisIds = analysisResults.stream()
                    .map(AiAnalysisResult::getId)
                    .toList();

            List<EngineerReview> reviews = engineerReviewRepository.findByAnalysisIdInOrderByCreatedAtDesc(analysisIds);
            if (!reviews.isEmpty()) {
                throw new IllegalStateException("Cannot delete photo: This image has associated certified engineering reviews that must be preserved for audit compliance.");
            }

            // Unreviewed: delete generated output images and AI analysis results
            for (AiAnalysisResult result : analysisResults) {
                deleteAssociatedOutputFile(result.getHighlightedImageUrl());
            }
            aiAnalysisResultRepository.deleteAll(analysisResults);
            aiAnalysisResultRepository.flush();
        }

        // Delete physical file from storage
        if (CloudinaryService.isCloudinaryUrl(image.getStoragePath())) {
            if (cloudinaryService != null) {
                cloudinaryService.deleteImageByPublicIdOrUrl(image.getStoragePath());
            }
        } else {
            Path uploadPath = getUploadPath();
            Path filePath = uploadPath.resolve(image.getStoredFilename()).normalize();
            if (filePath.startsWith(uploadPath)) {
                try {
                    Files.deleteIfExists(filePath);
                } catch (IOException e) {
                    // Log warning but proceed with record cleanup
                }
            }
        }

        // Delete image entity
        inspectionImageRepository.delete(image);
        inspectionImageRepository.flush();

        // Check if any images remain for this inspection; transition status back to PENDING_AI_ANALYSIS if was IN_PROGRESS
        List<InspectionImage> remaining = inspectionImageRepository.findByInspectionId(inspectionId);
        if (remaining.isEmpty() && "IN_PROGRESS".equalsIgnoreCase(inspection.getStatus())) {
            inspection.setStatus("PENDING_AI_ANALYSIS");
            inspectionService.updateInspection(inspectionId, inspection);
        }
    }

    private void deleteAssociatedOutputFile(String highlightedImageUrl) {
        if (highlightedImageUrl == null || highlightedImageUrl.isBlank()) {
            return;
        }

        String filename = highlightedImageUrl;
        if (filename.startsWith("/outputs/")) {
            filename = filename.substring("/outputs/".length());
        } else if (filename.contains("/")) {
            filename = filename.substring(filename.lastIndexOf("/") + 1);
        }

        List<String> targetDirs = List.of("ai-service/outputs", "outputs", "../ai-service/outputs");
        for (String dir : targetDirs) {
            try {
                Path p = Paths.get(dir, filename).toAbsolutePath().normalize();
                if (Files.exists(p)) {
                    Files.deleteIfExists(p);
                }
            } catch (Exception ignored) {
            }
        }
    }
}
