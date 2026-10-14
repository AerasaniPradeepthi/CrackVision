package com.crackvision.backend.controller;

import com.crackvision.backend.entity.AiAnalysisResult;
import com.crackvision.backend.entity.Component;
import com.crackvision.backend.entity.Inspection;
import com.crackvision.backend.entity.InspectionImage;
import com.crackvision.backend.exception.AiServiceException;
import com.crackvision.backend.service.AiAnalysisService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class AiAnalysisControllerTest {

    @Mock
    private AiAnalysisService aiAnalysisService;

    @InjectMocks
    private AiAnalysisController aiAnalysisController;

    private MockMvc mockMvc;
    private AiAnalysisResult sampleResult;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(aiAnalysisController).build();

        Component component = new Component();
        component.setId(10L);

        Inspection inspection = new Inspection();
        inspection.setId(1L);
        inspection.setComponent(component);
        inspection.setStatus("PENDING_AI_ANALYSIS");

        InspectionImage image = new InspectionImage();
        image.setId(2L);
        image.setInspection(inspection);
        image.setOriginalFilename("crack.png");

        sampleResult = new AiAnalysisResult();
        sampleResult.setId(100L);
        sampleResult.setInspection(inspection);
        sampleResult.setInspectionImage(image);
        sampleResult.setCrackDetected(true);
        sampleResult.setScreeningCategory("VISIBLE_CRACK_CANDIDATES");
        sampleResult.setConfidence(null);
        sampleResult.setCrackAreaPercentage(4.25);
        sampleResult.setRegionsCount(3);
        sampleResult.setHighlightedImageUrl("/api/inspections/1/images/2/analysis/highlighted");
        sampleResult.setModelName("CrackVision OpenCV Baseline");
        sampleResult.setModelVersion("1.1.0-statistical");
        sampleResult.setModelType("heuristic_opencv_baseline");
        sampleResult.setStatus("SUCCESS");
        sampleResult.setDisclaimer("Experimental screening heuristic only. Requires licensed structural engineer review.");
        sampleResult.setAnalyzedAt(LocalDateTime.of(2026, 10, 11, 22, 0, 0));
        sampleResult.setCreatedAt(LocalDateTime.of(2026, 10, 11, 22, 0, 0));
    }

    @Test
    void testAnalyzeImage_Success_Returns200AndResultResponse() throws Exception {
        when(aiAnalysisService.analyzeImage(1L, 2L)).thenReturn(sampleResult);

        mockMvc.perform(post("/api/inspections/1/images/2/analyze")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(100)))
                .andExpect(jsonPath("$.inspectionId", is(1)))
                .andExpect(jsonPath("$.imageId", is(2)))
                .andExpect(jsonPath("$.crackDetected", is(true)))
                .andExpect(jsonPath("$.screeningCategory", is("VISIBLE_CRACK_CANDIDATES")))
                .andExpect(jsonPath("$.confidence", nullValue()))
                .andExpect(jsonPath("$.crackAreaPercentage", is(4.25)))
                .andExpect(jsonPath("$.regionsCount", is(3)))
                .andExpect(jsonPath("$.status", is("SUCCESS")))
                .andExpect(jsonPath("$.modelName", is("CrackVision OpenCV Baseline")))
                .andExpect(jsonPath("$.disclaimer", containsString("licensed structural engineer")));

        verify(aiAnalysisService, times(1)).analyzeImage(1L, 2L);
    }

    @Test
    void testAnalyzeImage_Timeout_Returns504WithImagePreserved() throws Exception {
        when(aiAnalysisService.analyzeImage(1L, 2L))
                .thenThrow(new AiServiceException("AI analysis service timed out after 30000 ms", true));

        mockMvc.perform(post("/api/inspections/1/images/2/analyze")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isGatewayTimeout())
                .andExpect(jsonPath("$.error", containsString("timed out")))
                .andExpect(jsonPath("$.inspectionId", is(1)))
                .andExpect(jsonPath("$.imageId", is(2)))
                .andExpect(jsonPath("$.imagePreserved", is(true)));

        verify(aiAnalysisService, times(1)).analyzeImage(1L, 2L);
    }

    @Test
    void testAnalyzeImage_ServiceUnavailable_Returns503WithImagePreserved() throws Exception {
        when(aiAnalysisService.analyzeImage(1L, 2L))
                .thenThrow(new AiServiceException("Failed to connect to AI analysis service at http://127.0.0.1:8000", false));

        mockMvc.perform(post("/api/inspections/1/images/2/analyze")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error", containsString("Failed to connect")))
                .andExpect(jsonPath("$.inspectionId", is(1)))
                .andExpect(jsonPath("$.imageId", is(2)))
                .andExpect(jsonPath("$.imagePreserved", is(true)));

        verify(aiAnalysisService, times(1)).analyzeImage(1L, 2L);
    }

    @Test
    void testAnalyzeImage_EntityNotFound_Returns404() throws Exception {
        when(aiAnalysisService.analyzeImage(99L, 2L))
                .thenThrow(new RuntimeException("Inspection not found with id: 99"));

        mockMvc.perform(post("/api/inspections/99/images/2/analyze")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error", is("Inspection not found with id: 99")));

        verify(aiAnalysisService, times(1)).analyzeImage(99L, 2L);
    }

    @Test
    void testGetLatestAnalysisForImage_Found_Returns200() throws Exception {
        when(aiAnalysisService.getLatestAnalysisForImage(1L, 2L)).thenReturn(Optional.of(sampleResult));

        mockMvc.perform(get("/api/inspections/1/images/2/analysis"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(100)))
                .andExpect(jsonPath("$.imageId", is(2)))
                .andExpect(jsonPath("$.crackDetected", is(true)));

        verify(aiAnalysisService, times(1)).getLatestAnalysisForImage(1L, 2L);
    }

    @Test
    void testGetLatestAnalysisForImage_NotFound_Returns404() throws Exception {
        when(aiAnalysisService.getLatestAnalysisForImage(1L, 2L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/inspections/1/images/2/analysis"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message", containsString("No analysis result found for image ID 2")));

        verify(aiAnalysisService, times(1)).getLatestAnalysisForImage(1L, 2L);
    }

    @Test
    void testGetAnalysisHistoryForImage_ReturnsList() throws Exception {
        when(aiAnalysisService.getAnalysisHistoryForImage(1L, 2L)).thenReturn(List.of(sampleResult));

        mockMvc.perform(get("/api/inspections/1/images/2/analysis/history"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id", is(100)))
                .andExpect(jsonPath("$[0].imageId", is(2)));

        verify(aiAnalysisService, times(1)).getAnalysisHistoryForImage(1L, 2L);
    }

    @Test
    void testGetAnalysisHistoryForInspection_ReturnsList() throws Exception {
        when(aiAnalysisService.getAnalysisHistoryForInspection(1L)).thenReturn(List.of(sampleResult));

        mockMvc.perform(get("/api/inspections/1/analysis"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].inspectionId", is(1)));

        verify(aiAnalysisService, times(1)).getAnalysisHistoryForInspection(1L);
    }

    @Test
    void testGetLatestAnalysisForInspection_Found_Returns200() throws Exception {
        when(aiAnalysisService.getLatestAnalysisForInspection(1L)).thenReturn(Optional.of(sampleResult));

        mockMvc.perform(get("/api/inspections/1/analysis/latest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(100)))
                .andExpect(jsonPath("$.inspectionId", is(1)));

        verify(aiAnalysisService, times(1)).getLatestAnalysisForInspection(1L);
    }

    @Test
    void testGetLatestAnalysisForInspection_NotFound_Returns404() throws Exception {
        when(aiAnalysisService.getLatestAnalysisForInspection(1L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/inspections/1/analysis/latest"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message", containsString("No analysis results found for inspection ID 1")));

        verify(aiAnalysisService, times(1)).getLatestAnalysisForInspection(1L);
    }
}
