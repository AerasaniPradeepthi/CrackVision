package com.crackvision.backend.service;

import com.crackvision.backend.entity.*;
import com.crackvision.backend.repository.AiAnalysisResultRepository;
import com.crackvision.backend.repository.EngineerReviewRepository;
import com.crackvision.backend.repository.InspectionImageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InspectionImageServiceTest {

    @Mock
    private InspectionImageRepository inspectionImageRepository;

    @Mock
    private InspectionService inspectionService;

    @Mock
    private AiAnalysisResultRepository aiAnalysisResultRepository;

    @Mock
    private EngineerReviewRepository engineerReviewRepository;

    @InjectMocks
    private InspectionImageService inspectionImageService;

    @TempDir
    Path tempUploadDir;

    private Inspection sampleInspection;
    private InspectionImage sampleImage;

    @BeforeEach
    void setUp() throws IOException {
        ReflectionTestUtils.setField(inspectionImageService, "uploadDir", tempUploadDir.toString());

        sampleInspection = new Inspection();
        sampleInspection.setId(1L);
        sampleInspection.setStatus("IN_PROGRESS");

        sampleImage = new InspectionImage();
        sampleImage.setId(2L);
        sampleImage.setInspection(sampleInspection);
        sampleImage.setOriginalFilename("test_crack.jpg");
        sampleImage.setStoredFilename("unique_uuid_crack.jpg");
        sampleImage.setContentType("image/jpeg");
        sampleImage.setFileSize(1024L);

        // Create a dummy file in the temp upload directory
        Path storedFile = tempUploadDir.resolve("unique_uuid_crack.jpg");
        Files.writeString(storedFile, "dummy-image-content");
    }

    @Test
    @DisplayName("deleteImage successfully removes unreviewed photo, deletes AI analysis, and resets status if no images remain")
    void deleteImage_Success_Unreviewed() {
        when(inspectionService.getInspectionById(1L)).thenReturn(sampleInspection);
        when(inspectionImageRepository.findByIdAndInspectionId(2L, 1L)).thenReturn(Optional.of(sampleImage));

        AiAnalysisResult unreviewedResult = new AiAnalysisResult();
        unreviewedResult.setId(10L);
        unreviewedResult.setHighlightedImageUrl("/outputs/highlighted_test.png");

        when(aiAnalysisResultRepository.findByInspectionImageIdOrderByCreatedAtDesc(2L))
                .thenReturn(List.of(unreviewedResult));
        when(engineerReviewRepository.findByAnalysisIdInOrderByCreatedAtDesc(List.of(10L)))
                .thenReturn(Collections.emptyList());

        // When remaining images is checked after deletion, return empty list
        when(inspectionImageRepository.findByInspectionId(1L)).thenReturn(Collections.emptyList());

        inspectionImageService.deleteImage(1L, 2L);

        verify(aiAnalysisResultRepository, times(1)).deleteAll(List.of(unreviewedResult));
        verify(inspectionImageRepository, times(1)).delete(sampleImage);
        verify(inspectionService, times(1)).updateInspection(eq(1L), any(Inspection.class));
        assertEquals("PENDING_AI_ANALYSIS", sampleInspection.getStatus());

        // Verify physical file was deleted
        assertFalse(Files.exists(tempUploadDir.resolve("unique_uuid_crack.jpg")));
    }

    @Test
    @DisplayName("deleteImage preserves inspection status if other images still remain")
    void deleteImage_Success_ImagesRemain() {
        when(inspectionService.getInspectionById(1L)).thenReturn(sampleInspection);
        when(inspectionImageRepository.findByIdAndInspectionId(2L, 1L)).thenReturn(Optional.of(sampleImage));

        when(aiAnalysisResultRepository.findByInspectionImageIdOrderByCreatedAtDesc(2L))
                .thenReturn(Collections.emptyList());

        InspectionImage remainingImage = new InspectionImage();
        remainingImage.setId(3L);
        when(inspectionImageRepository.findByInspectionId(1L)).thenReturn(List.of(remainingImage));

        inspectionImageService.deleteImage(1L, 2L);

        verify(inspectionImageRepository, times(1)).delete(sampleImage);
        verify(inspectionService, never()).updateInspection(eq(1L), any(Inspection.class));
        assertEquals("IN_PROGRESS", sampleInspection.getStatus());
    }

    @Test
    @DisplayName("deleteImage rejects deletion with IllegalStateException if certified engineer review exists")
    void deleteImage_Rejected_WhenCertifiedReviewExists() {
        when(inspectionService.getInspectionById(1L)).thenReturn(sampleInspection);
        when(inspectionImageRepository.findByIdAndInspectionId(2L, 1L)).thenReturn(Optional.of(sampleImage));

        AiAnalysisResult reviewedResult = new AiAnalysisResult();
        reviewedResult.setId(10L);

        when(aiAnalysisResultRepository.findByInspectionImageIdOrderByCreatedAtDesc(2L))
                .thenReturn(List.of(reviewedResult));

        EngineerReview review = new EngineerReview();
        review.setId(50L);
        review.setDecision(ReviewDecision.REPAIR_REQUIRED);

        when(engineerReviewRepository.findByAnalysisIdInOrderByCreatedAtDesc(List.of(10L)))
                .thenReturn(List.of(review));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                inspectionImageService.deleteImage(1L, 2L)
        );

        assertTrue(ex.getMessage().contains("certified engineering reviews"));
        verify(inspectionImageRepository, never()).delete(any());
        verify(aiAnalysisResultRepository, never()).deleteAll(any());
        // Verify original physical file was not deleted
        assertTrue(Files.exists(tempUploadDir.resolve("unique_uuid_crack.jpg")));
    }

    @Test
    @DisplayName("deleteImage throws RuntimeException if image does not belong to inspection")
    void deleteImage_NotFound() {
        when(inspectionService.getInspectionById(1L)).thenReturn(sampleInspection);
        when(inspectionImageRepository.findByIdAndInspectionId(99L, 1L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () ->
                inspectionImageService.deleteImage(1L, 99L)
        );

        verify(inspectionImageRepository, never()).delete(any());
    }
}
