package com.crackvision.backend.controller;

import com.crackvision.backend.service.InspectionImageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.hamcrest.Matchers.is;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class InspectionImageControllerTest {

    @Mock
    private InspectionImageService inspectionImageService;

    @InjectMocks
    private InspectionImageController inspectionImageController;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(inspectionImageController).build();
    }

    @Test
    @DisplayName("DELETE /api/inspections/{inspectionId}/images/{imageId} should return 200 on successful deletion")
    void deleteImage_Success() throws Exception {
        doNothing().when(inspectionImageService).deleteImage(1L, 2L);

        mockMvc.perform(delete("/api/inspections/1/images/2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", is("Photo deleted successfully")))
                .andExpect(jsonPath("$.inspectionId", is(1)))
                .andExpect(jsonPath("$.imageId", is(2)));

        verify(inspectionImageService, times(1)).deleteImage(1L, 2L);
    }

    @Test
    @DisplayName("DELETE /api/inspections/{inspectionId}/images/{imageId} should return 409 Conflict when certified engineer review exists")
    void deleteImage_Conflict_WhenCertifiedReviewExists() throws Exception {
        doThrow(new IllegalStateException("Cannot delete photo: This image has associated certified engineering reviews that must be preserved for audit compliance."))
                .when(inspectionImageService).deleteImage(1L, 2L);

        mockMvc.perform(delete("/api/inspections/1/images/2"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error", is("Cannot delete photo: This image has associated certified engineering reviews that must be preserved for audit compliance.")));

        verify(inspectionImageService, times(1)).deleteImage(1L, 2L);
    }

    @Test
    @DisplayName("DELETE /api/inspections/{inspectionId}/images/{imageId} should return 404 when image not found")
    void deleteImage_NotFound() throws Exception {
        doThrow(new RuntimeException("Image not found with ID 99 for inspection 1"))
                .when(inspectionImageService).deleteImage(1L, 99L);

        mockMvc.perform(delete("/api/inspections/1/images/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error", is("Image not found with ID 99 for inspection 1")));

        verify(inspectionImageService, times(1)).deleteImage(1L, 99L);
    }
}
