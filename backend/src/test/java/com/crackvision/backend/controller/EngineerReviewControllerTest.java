package com.crackvision.backend.controller;

import com.crackvision.backend.dto.review.EngineerReviewRequest;
import com.crackvision.backend.entity.*;
import com.crackvision.backend.service.EngineerReviewService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class EngineerReviewControllerTest {

    @Mock
    private EngineerReviewService engineerReviewService;

    @InjectMocks
    private EngineerReviewController engineerReviewController;

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private EngineerReview sampleReview;
    private User engineerUser;
    private UsernamePasswordAuthenticationToken authPrincipal;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(engineerReviewController).build();

        Component component = new Component();
        component.setId(10L);

        Inspection inspection = new Inspection();
        inspection.setId(1L);
        inspection.setComponent(component);
        inspection.setStatus("PENDING_AI_ANALYSIS");

        InspectionImage image = new InspectionImage();
        image.setId(5L);
        image.setInspection(inspection);

        AiAnalysisResult analysis = new AiAnalysisResult();
        analysis.setId(20L);
        analysis.setInspection(inspection);
        analysis.setInspectionImage(image);
        analysis.setCrackDetected(true);
        analysis.setScreeningCategory("VISIBLE_CRACK_CANDIDATES");

        engineerUser = new User();
        engineerUser.setId(100L);
        engineerUser.setName("Eng. Alice");
        engineerUser.setEmail("alice@crackvision.com");
        engineerUser.setRole(Role.SITE_ENGINEER);

        authPrincipal = new UsernamePasswordAuthenticationToken(
                engineerUser,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_SITE_ENGINEER"))
        );

        sampleReview = new EngineerReview();
        sampleReview.setId(500L);
        sampleReview.setAiAnalysisResult(analysis);
        sampleReview.setReviewer(engineerUser);
        sampleReview.setDecision(ReviewDecision.INSPECT_FURTHER);
        sampleReview.setComments("Diagonal crack requires physical measurement.");
        sampleReview.setReviewedAt(LocalDateTime.of(2026, 10, 11, 22, 30, 0));
        sampleReview.setCreatedAt(LocalDateTime.of(2026, 10, 11, 22, 30, 0));
    }

    @Test
    void testSubmitReview_Success_Returns201AndResponseDto() throws Exception {
        when(engineerReviewService.submitReview(eq(1L), eq(20L), any(EngineerReviewRequest.class), eq("alice@crackvision.com")))
                .thenReturn(sampleReview);

        EngineerReviewRequest request = new EngineerReviewRequest(
                ReviewDecision.INSPECT_FURTHER,
                "Diagonal crack requires physical measurement."
        );

        mockMvc.perform(post("/api/inspections/1/analysis/20/reviews")
                        .principal(authPrincipal)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", is(500)))
                .andExpect(jsonPath("$.analysisId", is(20)))
                .andExpect(jsonPath("$.inspectionId", is(1)))
                .andExpect(jsonPath("$.imageId", is(5)))
                .andExpect(jsonPath("$.decision", is("INSPECT_FURTHER")))
                .andExpect(jsonPath("$.comments", is("Diagonal crack requires physical measurement.")))
                .andExpect(jsonPath("$.reviewer.id", is(100)))
                .andExpect(jsonPath("$.reviewer.email", is("alice@crackvision.com")))
                .andExpect(jsonPath("$.reviewer.role", is("SITE_ENGINEER")));

        verify(engineerReviewService, times(1))
                .submitReview(eq(1L), eq(20L), any(EngineerReviewRequest.class), eq("alice@crackvision.com"));
    }

    @Test
    void testSubmitReview_MismatchedInspection_Returns400() throws Exception {
        when(engineerReviewService.submitReview(eq(1L), eq(20L), any(EngineerReviewRequest.class), eq("alice@crackvision.com")))
                .thenThrow(new IllegalArgumentException("AI analysis result with id 20 does not belong to inspection with id 1"));

        EngineerReviewRequest request = new EngineerReviewRequest(
                ReviewDecision.MONITOR,
                "Comment"
        );

        mockMvc.perform(post("/api/inspections/1/analysis/20/reviews")
                        .principal(authPrincipal)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("does not belong to inspection")));
    }

    @Test
    void testSubmitReview_NotFoundEntity_Returns404() throws Exception {
        when(engineerReviewService.submitReview(eq(1L), eq(999L), any(EngineerReviewRequest.class), eq("alice@crackvision.com")))
                .thenThrow(new RuntimeException("AI analysis result not found with id: 999"));

        EngineerReviewRequest request = new EngineerReviewRequest(
                ReviewDecision.MONITOR,
                "Comment"
        );

        mockMvc.perform(post("/api/inspections/1/analysis/999/reviews")
                        .principal(authPrincipal)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error", containsString("not found with id: 999")));
    }

    @Test
    void testGetReviewsForAnalysis_Success_ReturnsList() throws Exception {
        when(engineerReviewService.getReviewsForAnalysis(1L, 20L))
                .thenReturn(List.of(sampleReview));

        mockMvc.perform(get("/api/inspections/1/analysis/20/reviews"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id", is(500)))
                .andExpect(jsonPath("$[0].decision", is("INSPECT_FURTHER")));

        verify(engineerReviewService).getReviewsForAnalysis(1L, 20L);
    }

    @Test
    void testGetLatestReviewForAnalysis_Found_Returns200() throws Exception {
        when(engineerReviewService.getLatestReviewForAnalysis(1L, 20L))
                .thenReturn(Optional.of(sampleReview));

        mockMvc.perform(get("/api/inspections/1/analysis/20/reviews/latest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(500)))
                .andExpect(jsonPath("$.decision", is("INSPECT_FURTHER")));

        verify(engineerReviewService).getLatestReviewForAnalysis(1L, 20L);
    }

    @Test
    void testGetLatestReviewForAnalysis_NotFound_Returns404() throws Exception {
        when(engineerReviewService.getLatestReviewForAnalysis(1L, 20L))
                .thenReturn(Optional.empty());

        mockMvc.perform(get("/api/inspections/1/analysis/20/reviews/latest"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message", containsString("No review found for analysis ID 20")));

        verify(engineerReviewService).getLatestReviewForAnalysis(1L, 20L);
    }

    @Test
    void testGetReviewsForInspection_Success_ReturnsList() throws Exception {
        when(engineerReviewService.getReviewsForInspection(1L))
                .thenReturn(List.of(sampleReview));

        mockMvc.perform(get("/api/inspections/1/reviews"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].inspectionId", is(1)));

        verify(engineerReviewService).getReviewsForInspection(1L);
    }

    @Test
    void testGetLatestReviewForInspection_Found_Returns200() throws Exception {
        when(engineerReviewService.getLatestReviewForInspection(1L))
                .thenReturn(Optional.of(sampleReview));

        mockMvc.perform(get("/api/inspections/1/reviews/latest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(500)))
                .andExpect(jsonPath("$.inspectionId", is(1)));

        verify(engineerReviewService).getLatestReviewForInspection(1L);
    }

    @Test
    void testGetLatestReviewForInspection_NotFound_Returns404() throws Exception {
        when(engineerReviewService.getLatestReviewForInspection(1L))
                .thenReturn(Optional.empty());

        mockMvc.perform(get("/api/inspections/1/reviews/latest"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message", containsString("No reviews found for inspection ID 1")));

        verify(engineerReviewService).getLatestReviewForInspection(1L);
    }

    @Test
    void testGetAllReviews_Success_ReturnsList() throws Exception {
        when(engineerReviewService.getAllReviews()).thenReturn(List.of(sampleReview));

        mockMvc.perform(get("/api/inspections/reviews/all"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id", is(500)))
                .andExpect(jsonPath("$[0].decision", is("INSPECT_FURTHER")));

        verify(engineerReviewService).getAllReviews();
    }
}
