package com.crackvision.backend.service;

import com.crackvision.backend.dto.ai.PythonAnalysisResponse;
import com.crackvision.backend.entity.AiAnalysisResult;
import com.crackvision.backend.entity.Component;
import com.crackvision.backend.entity.Inspection;
import com.crackvision.backend.entity.InspectionImage;
import com.crackvision.backend.exception.AiServiceException;
import com.crackvision.backend.repository.AiAnalysisResultRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.io.ByteArrayInputStream;
import java.net.SocketTimeoutException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

@ExtendWith(MockitoExtension.class)
class AiAnalysisServiceTest {

    @Mock
    private InspectionService inspectionService;

    @Mock
    private InspectionImageService inspectionImageService;

    @Mock
    private AiAnalysisResultRepository aiAnalysisResultRepository;

    private RestClient.Builder restClientBuilder;
    private MockRestServiceServer mockServer;
    private AiAnalysisService aiAnalysisService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private Inspection sampleInspection;
    private InspectionImage sampleImage;
    private Resource sampleResource;

    @BeforeEach
    void setUp() {
        restClientBuilder = RestClient.builder().baseUrl("http://127.0.0.1:8000");
        mockServer = MockRestServiceServer.bindTo(restClientBuilder).build();
        RestClient restClient = restClientBuilder.build();

        aiAnalysisService = new AiAnalysisService(
                inspectionService,
                inspectionImageService,
                aiAnalysisResultRepository,
                restClient
        );

        Component component = new Component();
        component.setId(1L);
        component.setName("Concrete Wall A");

        sampleInspection = new Inspection();
        sampleInspection.setId(1L);
        sampleInspection.setComponent(component);
        sampleInspection.setStatus("PENDING_AI_ANALYSIS");

        sampleImage = new InspectionImage();
        sampleImage.setId(1L);
        sampleImage.setInspection(sampleInspection);
        sampleImage.setOriginalFilename("crack.png");
        sampleImage.setStoredFilename("test-uuid.png");
        sampleImage.setStoragePath("uploads/inspections/test-uuid.png");
        sampleImage.setContentType("image/png");
        sampleImage.setFileSize(1024L);

        sampleResource = new ByteArrayResource(new byte[]{1, 2, 3, 4}) {
            @Override
            public String getFilename() {
                return "test-uuid.png";
            }
        };
    }

    @Test
    void testAnalyzeImage_Success_PreservesInspectionStatusAndRecordsResult() throws Exception {
        when(inspectionService.getInspectionById(1L)).thenReturn(sampleInspection);
        when(inspectionImageService.getImageMetadata(1L, 1L)).thenReturn(sampleImage);
        when(inspectionImageService.loadResource(sampleImage)).thenReturn(sampleResource);
        when(aiAnalysisResultRepository.save(any(AiAnalysisResult.class))).thenAnswer(i -> i.getArgument(0));

        PythonAnalysisResponse pythonResponse = new PythonAnalysisResponse();
        pythonResponse.setStatus("SUCCESS");
        pythonResponse.setCrackDetected(true);
        pythonResponse.setScreeningCategory("SEVERE");
        pythonResponse.setConfidence(null); // Model honesty: confidence is null
        pythonResponse.setCrackAreaPercentage(0.6101);
        pythonResponse.setRegionsCount(17);
        pythonResponse.setHighlightedImageUrl("/outputs/highlighted_test.png");
        pythonResponse.setDisclaimer("Automated screening aid only.");

        PythonAnalysisResponse.ModelInfoDto modelInfo = new PythonAnalysisResponse.ModelInfoDto();
        modelInfo.setName("CrackVision-CV-Baseline");
        modelInfo.setVersion("0.1.0");
        modelInfo.setModelType("experimental_computer_vision_baseline");
        pythonResponse.setModelInfo(modelInfo);

        mockServer.expect(requestTo("http://127.0.0.1:8000/analyze"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(objectMapper.writeValueAsString(pythonResponse), MediaType.APPLICATION_JSON));

        AiAnalysisResult result = aiAnalysisService.analyzeImage(1L, 1L);

        mockServer.verify();
        assertNotNull(result);
        assertTrue(result.getCrackDetected());
        assertEquals("SEVERE", result.getScreeningCategory());
        assertNull(result.getConfidence());
        assertEquals(0.6101, result.getCrackAreaPercentage());
        assertEquals(17, result.getRegionsCount());
        assertEquals("/outputs/highlighted_test.png", result.getHighlightedImageUrl());
        assertEquals("CrackVision-CV-Baseline", result.getModelName());
        assertEquals("SUCCESS", result.getStatus());
        assertNotNull(result.getAnalyzedAt());

        // Inspection status transitions to PENDING_REVIEW ready for engineer review
        assertEquals("PENDING_REVIEW", sampleInspection.getStatus());
        verify(inspectionService, times(1)).updateInspection(eq(1L), any(Inspection.class));
        verify(aiAnalysisResultRepository, times(1)).save(any(AiAnalysisResult.class));
    }

    @Test
    void testAnalyzeImage_ReAnalysisPreservesHistory() throws Exception {
        when(inspectionService.getInspectionById(1L)).thenReturn(sampleInspection);
        when(inspectionImageService.getImageMetadata(1L, 1L)).thenReturn(sampleImage);
        when(inspectionImageService.loadResource(sampleImage)).thenReturn(sampleResource);
        when(aiAnalysisResultRepository.save(any(AiAnalysisResult.class))).thenAnswer(i -> i.getArgument(0));

        PythonAnalysisResponse pythonResponse = new PythonAnalysisResponse();
        pythonResponse.setStatus("SUCCESS");
        pythonResponse.setCrackDetected(true);
        pythonResponse.setScreeningCategory("MODERATE");
        pythonResponse.setCrackAreaPercentage(0.45);
        pythonResponse.setRegionsCount(5);

        mockServer.expect(requestTo("http://127.0.0.1:8000/analyze"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(objectMapper.writeValueAsString(pythonResponse), MediaType.APPLICATION_JSON));

        AiAnalysisResult firstRun = aiAnalysisService.analyzeImage(1L, 1L);

        // Reset server mock for re-run
        mockServer.reset();
        PythonAnalysisResponse pythonResponse2 = new PythonAnalysisResponse();
        pythonResponse2.setStatus("SUCCESS");
        pythonResponse2.setCrackDetected(false);
        pythonResponse2.setScreeningCategory("NORMAL");
        pythonResponse2.setCrackAreaPercentage(0.0);
        pythonResponse2.setRegionsCount(0);

        mockServer.expect(requestTo("http://127.0.0.1:8000/analyze"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(objectMapper.writeValueAsString(pythonResponse2), MediaType.APPLICATION_JSON));

        AiAnalysisResult secondRun = aiAnalysisService.analyzeImage(1L, 1L);

        assertNotNull(firstRun);
        assertNotNull(secondRun);
        // Both analyses were independently saved to repository
        verify(aiAnalysisResultRepository, times(2)).save(any(AiAnalysisResult.class));
        assertEquals("PENDING_REVIEW", sampleInspection.getStatus());
    }

    @Test
    void testAnalyzeImage_AiServiceUnavailable_PreservesImageAndRecordsFailure() {
        when(inspectionService.getInspectionById(1L)).thenReturn(sampleInspection);
        when(inspectionImageService.getImageMetadata(1L, 1L)).thenReturn(sampleImage);
        when(inspectionImageService.loadResource(sampleImage)).thenReturn(sampleResource);

        // Simulate Python service down / 503 error
        mockServer.expect(requestTo("http://127.0.0.1:8000/analyze"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withServerError());

        AiServiceException ex = assertThrows(AiServiceException.class, () ->
                aiAnalysisService.analyzeImage(1L, 1L)
        );

        assertNotNull(ex);
        // Captured failed attempt into repository to keep failure audit trail
        ArgumentCaptor<AiAnalysisResult> captor = ArgumentCaptor.forClass(AiAnalysisResult.class);
        verify(aiAnalysisResultRepository).save(captor.capture());

        AiAnalysisResult captured = captor.getValue();
        assertEquals("FAILED", captured.getStatus());
        assertFalse(captured.getCrackDetected());
        assertEquals("REVIEW_REQUIRED", captured.getScreeningCategory());
        assertNotNull(captured.getErrorMessage());

        // Original image remains completely untouched
        assertEquals("PENDING_AI_ANALYSIS", sampleInspection.getStatus());
    }

    @Test
    void testAnalyzeImage_InvalidInspectionId_ThrowsNotFound() {
        when(inspectionService.getInspectionById(999L)).thenThrow(new RuntimeException("Inspection not found"));

        assertThrows(RuntimeException.class, () ->
                aiAnalysisService.analyzeImage(999L, 1L)
        );
        verifyNoInteractions(aiAnalysisResultRepository);
    }

    @Test
    void testAnalyzeImage_InvalidImageId_ThrowsNotFound() {
        when(inspectionService.getInspectionById(1L)).thenReturn(sampleInspection);
        when(inspectionImageService.getImageMetadata(1L, 999L)).thenThrow(new RuntimeException("Image not found"));

        assertThrows(RuntimeException.class, () ->
                aiAnalysisService.analyzeImage(1L, 999L)
        );
        verifyNoInteractions(aiAnalysisResultRepository);
    }

    @Test
    void testGetLatestAnalysisForImage_ReturnsLatest() {
        AiAnalysisResult result = new AiAnalysisResult();
        result.setId(5L);
        result.setCrackDetected(true);
        result.setScreeningCategory("SEVERE");

        when(inspectionService.getInspectionById(1L)).thenReturn(sampleInspection);
        when(inspectionImageService.getImageMetadata(1L, 1L)).thenReturn(sampleImage);
        when(aiAnalysisResultRepository.findLatestByInspectionImageId(1L)).thenReturn(Optional.of(result));

        Optional<AiAnalysisResult> found = aiAnalysisService.getLatestAnalysisForImage(1L, 1L);

        assertTrue(found.isPresent());
        assertEquals(5L, found.get().getId());
    }

    @Test
    void testGetAnalysisHistoryForInspection_ReturnsAll() {
        AiAnalysisResult r1 = new AiAnalysisResult();
        r1.setId(1L);
        AiAnalysisResult r2 = new AiAnalysisResult();
        r2.setId(2L);

        when(inspectionService.getInspectionById(1L)).thenReturn(sampleInspection);
        when(aiAnalysisResultRepository.findByInspectionIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(r2, r1));

        List<AiAnalysisResult> history = aiAnalysisService.getAnalysisHistoryForInspection(1L);

        assertEquals(2, history.size());
        assertEquals(2L, history.get(0).getId());
    }

    @Test
    void testAnalyzeImage_WithCloudinaryConfigured_PersistsOverlayToCloudinary() throws Exception {
        CloudinaryService mockCloudinary = mock(CloudinaryService.class);
        when(mockCloudinary.isConfigured()).thenReturn(true);
        when(mockCloudinary.uploadBytes(any(), anyString(), anyString()))
                .thenReturn("https://res.cloudinary.com/dudhz46j/image/upload/v1/inspections/overlays/overlay_test.png");

        AiAnalysisService serviceWithCloudinary = new AiAnalysisService(
                inspectionService,
                inspectionImageService,
                aiAnalysisResultRepository,
                mockCloudinary,
                restClientBuilder.build()
        );

        when(inspectionService.getInspectionById(1L)).thenReturn(sampleInspection);
        when(inspectionImageService.getImageMetadata(1L, 1L)).thenReturn(sampleImage);
        when(inspectionImageService.loadResource(sampleImage)).thenReturn(sampleResource);

        PythonAnalysisResponse pythonResponse = new PythonAnalysisResponse();
        pythonResponse.setStatus("SUCCESS");
        pythonResponse.setCrackDetected(true);
        pythonResponse.setScreeningCategory("SEVERE");
        pythonResponse.setConfidence(0.92);
        pythonResponse.setCrackAreaPercentage(4.5);
        pythonResponse.setRegionsCount(2);
        pythonResponse.setHighlightedImageUrl("/outputs/highlighted_123.png");

        mockServer.expect(requestTo("http://127.0.0.1:8000/analyze"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(objectMapper.writeValueAsString(pythonResponse), MediaType.APPLICATION_JSON));

        mockServer.expect(requestTo("http://127.0.0.1:8000/outputs/highlighted_123.png"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(new byte[]{10, 20, 30}, MediaType.IMAGE_PNG));

        when(aiAnalysisResultRepository.save(any(AiAnalysisResult.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AiAnalysisResult result = serviceWithCloudinary.analyzeImage(1L, 1L);

        mockServer.verify();
        assertNotNull(result);
        assertEquals("https://res.cloudinary.com/dudhz46j/image/upload/v1/inspections/overlays/overlay_test.png", result.getHighlightedImageUrl());
        verify(mockCloudinary, times(1)).uploadBytes(any(), contains("overlay_"), eq("inspections/overlays"));
    }

    @Test
    void testAnalyzeImage_AiServiceForbidden_StreamlitDetected_ProvidesClearDiagnostic() {
        when(inspectionService.getInspectionById(1L)).thenReturn(sampleInspection);
        when(inspectionImageService.getImageMetadata(1L, 1L)).thenReturn(sampleImage);
        when(inspectionImageService.loadResource(sampleImage)).thenReturn(sampleResource);

        mockServer.expect(requestTo("http://127.0.0.1:8000/analyze"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(org.springframework.http.HttpStatus.FORBIDDEN)
                        .body("<!DOCTYPE html><html><title>Streamlit App</title></html>")
                        .contentType(MediaType.TEXT_HTML));

        AiServiceException ex = assertThrows(AiServiceException.class, () ->
                aiAnalysisService.analyzeImage(1L, 1L)
        );

        assertNotNull(ex);
        assertTrue(ex.getMessage().contains("Streamlit"), "Expected error message to mention Streamlit conflict");
        assertTrue(ex.getMessage().contains("CRACKVISION_AI_SERVICE_URL"), "Expected error message to point to CRACKVISION_AI_SERVICE_URL");

        ArgumentCaptor<AiAnalysisResult> captor = ArgumentCaptor.forClass(AiAnalysisResult.class);
        verify(aiAnalysisResultRepository).save(captor.capture());
        assertEquals("FAILED", captor.getValue().getStatus());
        assertTrue(captor.getValue().getErrorMessage().contains("Streamlit"));
    }

    @Test
    void testAnalyzeImage_WithApiKey_SendsHeaders() throws Exception {
        AiAnalysisService serviceWithKey = new AiAnalysisService(
                inspectionService,
                inspectionImageService,
                aiAnalysisResultRepository,
                null,
                restClientBuilder.build(),
                "http://127.0.0.1:8000",
                "my-secret-api-key"
        );

        when(inspectionService.getInspectionById(1L)).thenReturn(sampleInspection);
        when(inspectionImageService.getImageMetadata(1L, 1L)).thenReturn(sampleImage);
        when(inspectionImageService.loadResource(sampleImage)).thenReturn(sampleResource);

        PythonAnalysisResponse pythonResponse = new PythonAnalysisResponse();
        pythonResponse.setStatus("SUCCESS");
        pythonResponse.setCrackDetected(false);
        pythonResponse.setScreeningCategory("NORMAL");

        mockServer.expect(requestTo("http://127.0.0.1:8000/analyze"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("X-API-Key", "my-secret-api-key"))
                .andExpect(header("Authorization", "Bearer my-secret-api-key"))
                .andRespond(withSuccess(objectMapper.writeValueAsString(pythonResponse), MediaType.APPLICATION_JSON));

        when(aiAnalysisResultRepository.save(any(AiAnalysisResult.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AiAnalysisResult result = serviceWithKey.analyzeImage(1L, 1L);
        assertNotNull(result);
        mockServer.verify();
    }

    @Test
    void testCheckAiServiceHealth_ReturnsHealthStatus() {
        mockServer.expect(requestTo("http://127.0.0.1:8000/health"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("{\"status\":\"HEALTHY\"}", MediaType.APPLICATION_JSON));

        java.util.Map<String, Object> health = aiAnalysisService.checkAiServiceHealth();
        assertNotNull(health);
        assertEquals("UP", health.get("status"));
        assertEquals("HEALTHY", health.get("serviceStatus"));
        mockServer.verify();
    }
}
