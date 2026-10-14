package com.crackvision.backend.service;

import com.crackvision.backend.dto.review.EngineerReviewRequest;
import com.crackvision.backend.entity.*;
import com.crackvision.backend.repository.AiAnalysisResultRepository;
import com.crackvision.backend.repository.EngineerReviewRepository;
import com.crackvision.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EngineerReviewServiceTest {

    @Mock
    private InspectionService inspectionService;

    @Mock
    private AiAnalysisResultRepository aiAnalysisResultRepository;

    @Mock
    private EngineerReviewRepository engineerReviewRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private EngineerReviewService engineerReviewService;

    private Inspection sampleInspection;
    private AiAnalysisResult sampleAnalysis;
    private User engineerUser;
    private User adminUser;
    private User workerUser;

    @BeforeEach
    void setUp() {
        Component component = new Component();
        component.setId(10L);

        sampleInspection = new Inspection();
        sampleInspection.setId(1L);
        sampleInspection.setComponent(component);
        sampleInspection.setStatus("PENDING_AI_ANALYSIS");

        InspectionImage image = new InspectionImage();
        image.setId(5L);
        image.setInspection(sampleInspection);

        sampleAnalysis = new AiAnalysisResult();
        sampleAnalysis.setId(20L);
        sampleAnalysis.setInspection(sampleInspection);
        sampleAnalysis.setInspectionImage(image);
        sampleAnalysis.setCrackDetected(true);
        sampleAnalysis.setScreeningCategory("VISIBLE_CRACK_CANDIDATES");
        sampleAnalysis.setCrackAreaPercentage(3.8);
        sampleAnalysis.setRegionsCount(2);

        engineerUser = new User();
        engineerUser.setId(100L);
        engineerUser.setName("Eng. Alice");
        engineerUser.setEmail("alice@crackvision.com");
        engineerUser.setRole(Role.SITE_ENGINEER);

        adminUser = new User();
        adminUser.setId(101L);
        adminUser.setName("Admin Bob");
        adminUser.setEmail("bob@crackvision.com");
        adminUser.setRole(Role.ADMIN);

        workerUser = new User();
        workerUser.setId(102L);
        workerUser.setName("Worker Charlie");
        workerUser.setEmail("charlie@crackvision.com");
        workerUser.setRole(Role.SITE_WORKER);
    }

    @Test
    void testSubmitReview_BySiteEngineer_Success_UpdatesInspectionStatusToCompletedAndRecordsReview() {
        when(inspectionService.getInspectionById(1L)).thenReturn(sampleInspection);
        when(aiAnalysisResultRepository.findById(20L)).thenReturn(Optional.of(sampleAnalysis));
        when(userRepository.findByEmail("alice@crackvision.com")).thenReturn(Optional.of(engineerUser));
        when(engineerReviewRepository.save(any(EngineerReview.class))).thenAnswer(invocation -> {
            EngineerReview r = invocation.getArgument(0);
            r.setId(500L);
            return r;
        });

        EngineerReviewRequest request = new EngineerReviewRequest(
                ReviewDecision.MONITOR,
                "Hairline crack confirmed stable. Schedule follow-up in 30 days."
        );

        EngineerReview result = engineerReviewService.submitReview(1L, 20L, request, "alice@crackvision.com");

        assertNotNull(result);
        assertEquals(500L, result.getId());
        assertEquals(ReviewDecision.MONITOR, result.getDecision());
        assertEquals("Hairline crack confirmed stable. Schedule follow-up in 30 days.", result.getComments());
        assertEquals("alice@crackvision.com", result.getReviewer().getEmail());
        assertEquals(Role.SITE_ENGINEER, result.getReviewer().getRole());
        assertNotNull(result.getReviewedAt());
        assertNotNull(result.getCreatedAt());

        // Status transition checks:
        // 1. Inspection status transitions to COMPLETED
        assertEquals("COMPLETED", sampleInspection.getStatus());
        verify(inspectionService, times(1)).updateInspection(eq(1L), any(Inspection.class));
        // 2. AI screening category remains unchanged
        assertEquals("VISIBLE_CRACK_CANDIDATES", sampleAnalysis.getScreeningCategory());

        verify(engineerReviewRepository, times(1)).save(any(EngineerReview.class));
    }

    @Test
    void testSubmitReview_ByAdmin_Success() {
        when(inspectionService.getInspectionById(1L)).thenReturn(sampleInspection);
        when(aiAnalysisResultRepository.findById(20L)).thenReturn(Optional.of(sampleAnalysis));
        when(userRepository.findByEmail("bob@crackvision.com")).thenReturn(Optional.of(adminUser));
        when(engineerReviewRepository.save(any(EngineerReview.class))).thenAnswer(invocation -> {
            EngineerReview r = invocation.getArgument(0);
            r.setId(501L);
            return r;
        });

        EngineerReviewRequest request = new EngineerReviewRequest(
                ReviewDecision.REQUIRES_FURTHER_ASSESSMENT,
                "Structural engineer immediate on-site assessment mandated."
        );

        EngineerReview result = engineerReviewService.submitReview(1L, 20L, request, "bob@crackvision.com");

        assertNotNull(result);
        assertEquals(501L, result.getId());
        assertEquals(ReviewDecision.REQUIRES_FURTHER_ASSESSMENT, result.getDecision());
        assertEquals(Role.ADMIN, result.getReviewer().getRole());
        assertEquals("COMPLETED", sampleInspection.getStatus());
        verify(inspectionService, times(1)).updateInspection(eq(1L), any(Inspection.class));
    }

    @Test
    void testSubmitReview_ForbiddenRole_ThrowsAccessDeniedException() {
        when(inspectionService.getInspectionById(1L)).thenReturn(sampleInspection);
        when(aiAnalysisResultRepository.findById(20L)).thenReturn(Optional.of(sampleAnalysis));
        when(userRepository.findByEmail("charlie@crackvision.com")).thenReturn(Optional.of(workerUser));

        EngineerReviewRequest request = new EngineerReviewRequest(
                ReviewDecision.MONITOR,
                "Attempt by site worker"
        );

        assertThrows(AccessDeniedException.class, () ->
                engineerReviewService.submitReview(1L, 20L, request, "charlie@crackvision.com"));

        verify(engineerReviewRepository, never()).save(any());
    }

    @Test
    void testSubmitReview_MismatchedInspectionAndAnalysis_ThrowsIllegalArgumentException() {
        Inspection otherInspection = new Inspection();
        otherInspection.setId(99L);
        sampleAnalysis.setInspection(otherInspection); // Belongs to inspection 99, but request targets inspection 1

        when(inspectionService.getInspectionById(1L)).thenReturn(sampleInspection);
        when(aiAnalysisResultRepository.findById(20L)).thenReturn(Optional.of(sampleAnalysis));

        EngineerReviewRequest request = new EngineerReviewRequest(
                ReviewDecision.INSPECT_FURTHER,
                "Valid comments"
        );

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                engineerReviewService.submitReview(1L, 20L, request, "alice@crackvision.com"));

        assertTrue(ex.getMessage().contains("does not belong to inspection"));
        verify(engineerReviewRepository, never()).save(any());
    }

    @Test
    void testSubmitReview_NonExistentAnalysis_ThrowsRuntimeException() {
        when(inspectionService.getInspectionById(1L)).thenReturn(sampleInspection);
        when(aiAnalysisResultRepository.findById(999L)).thenReturn(Optional.empty());

        EngineerReviewRequest request = new EngineerReviewRequest(
                ReviewDecision.MONITOR,
                "Valid comments"
        );

        assertThrows(RuntimeException.class, () ->
                engineerReviewService.submitReview(1L, 999L, request, "alice@crackvision.com"));

        verify(engineerReviewRepository, never()).save(any());
    }

    @Test
    void testSubmitReview_ValidationFailures_ThrowsIllegalArgumentException() {
        // Null request
        assertThrows(IllegalArgumentException.class, () ->
                engineerReviewService.submitReview(1L, 20L, null, "alice@crackvision.com"));

        // Null decision
        EngineerReviewRequest noDecision = new EngineerReviewRequest(null, "Some comments");
        assertThrows(IllegalArgumentException.class, () ->
                engineerReviewService.submitReview(1L, 20L, noDecision, "alice@crackvision.com"));

        // Empty comments
        EngineerReviewRequest blankComments = new EngineerReviewRequest(ReviewDecision.MONITOR, "   ");
        assertThrows(IllegalArgumentException.class, () ->
                engineerReviewService.submitReview(1L, 20L, blankComments, "alice@crackvision.com"));

        // Missing reviewer identity
        EngineerReviewRequest validRequest = new EngineerReviewRequest(ReviewDecision.MONITOR, "Valid");
        assertThrows(IllegalArgumentException.class, () ->
                engineerReviewService.submitReview(1L, 20L, validRequest, "  "));
    }

    @Test
    void testSubmitReview_AppendOnlyHistory_MultipleReviewsPreserved() {
        when(inspectionService.getInspectionById(1L)).thenReturn(sampleInspection);
        when(aiAnalysisResultRepository.findById(20L)).thenReturn(Optional.of(sampleAnalysis));
        when(userRepository.findByEmail("alice@crackvision.com")).thenReturn(Optional.of(engineerUser));

        ArgumentCaptor<EngineerReview> captor = ArgumentCaptor.forClass(EngineerReview.class);
        when(engineerReviewRepository.save(captor.capture())).thenAnswer(invocation -> invocation.getArgument(0));

        EngineerReviewRequest req1 = new EngineerReviewRequest(ReviewDecision.MONITOR, "Initial inspection: minor hairline.");
        engineerReviewService.submitReview(1L, 20L, req1, "alice@crackvision.com");

        EngineerReviewRequest req2 = new EngineerReviewRequest(ReviewDecision.INSPECT_FURTHER, "Follow-up inspection: crack width expanded.");
        engineerReviewService.submitReview(1L, 20L, req2, "alice@crackvision.com");

        List<EngineerReview> captured = captor.getAllValues();
        assertEquals(2, captured.size());
        assertEquals(ReviewDecision.MONITOR, captured.get(0).getDecision());
        assertEquals("Initial inspection: minor hairline.", captured.get(0).getComments());
        assertEquals(ReviewDecision.INSPECT_FURTHER, captured.get(1).getDecision());
        assertEquals("Follow-up inspection: crack width expanded.", captured.get(1).getComments());
    }

    @Test
    void testGetReviewsForAnalysis_Success() {
        when(inspectionService.getInspectionById(1L)).thenReturn(sampleInspection);
        when(aiAnalysisResultRepository.findById(20L)).thenReturn(Optional.of(sampleAnalysis));

        EngineerReview review = new EngineerReview(sampleAnalysis, engineerUser, ReviewDecision.MONITOR, "All good");
        when(engineerReviewRepository.findByAnalysisIdOrderByCreatedAtDesc(20L)).thenReturn(List.of(review));

        List<EngineerReview> results = engineerReviewService.getReviewsForAnalysis(1L, 20L);

        assertEquals(1, results.size());
        assertEquals(ReviewDecision.MONITOR, results.get(0).getDecision());
        verify(engineerReviewRepository).findByAnalysisIdOrderByCreatedAtDesc(20L);
    }

    @Test
    void testGetLatestReviewForAnalysis_FoundAndNotFound() {
        when(inspectionService.getInspectionById(1L)).thenReturn(sampleInspection);
        when(aiAnalysisResultRepository.findById(20L)).thenReturn(Optional.of(sampleAnalysis));

        EngineerReview review = new EngineerReview(sampleAnalysis, engineerUser, ReviewDecision.INSPECT_FURTHER, "Needs tactile check");
        when(engineerReviewRepository.findLatestByAnalysisId(20L)).thenReturn(Optional.of(review));

        Optional<EngineerReview> found = engineerReviewService.getLatestReviewForAnalysis(1L, 20L);
        assertTrue(found.isPresent());
        assertEquals(ReviewDecision.INSPECT_FURTHER, found.get().getDecision());

        when(engineerReviewRepository.findLatestByAnalysisId(20L)).thenReturn(Optional.empty());
        Optional<EngineerReview> notFound = engineerReviewService.getLatestReviewForAnalysis(1L, 20L);
        assertTrue(notFound.isEmpty());
    }

    @Test
    void testGetReviewsForInspection_Success() {
        when(inspectionService.getInspectionById(1L)).thenReturn(sampleInspection);
        EngineerReview review = new EngineerReview(sampleAnalysis, engineerUser, ReviewDecision.MONITOR, "Inspection level note");
        when(engineerReviewRepository.findByInspectionIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(review));

        List<EngineerReview> list = engineerReviewService.getReviewsForInspection(1L);
        assertEquals(1, list.size());
        verify(engineerReviewRepository).findByInspectionIdOrderByCreatedAtDesc(1L);
    }

    @Test
    void testGetLatestReviewForInspection_FoundAndNotFound() {
        when(inspectionService.getInspectionById(1L)).thenReturn(sampleInspection);
        EngineerReview review = new EngineerReview(sampleAnalysis, engineerUser, ReviewDecision.MONITOR, "Latest note");
        when(engineerReviewRepository.findLatestByInspectionId(1L)).thenReturn(Optional.of(review));

        Optional<EngineerReview> latest = engineerReviewService.getLatestReviewForInspection(1L);
        assertTrue(latest.isPresent());
        assertEquals("Latest note", latest.get().getComments());

        when(engineerReviewRepository.findLatestByInspectionId(1L)).thenReturn(Optional.empty());
        Optional<EngineerReview> empty = engineerReviewService.getLatestReviewForInspection(1L);
        assertTrue(empty.isEmpty());
    }

    @Test
    void testGetAllReviews_Success() {
        EngineerReview r1 = new EngineerReview(sampleAnalysis, engineerUser, ReviewDecision.MONITOR, "Review 1");
        EngineerReview r2 = new EngineerReview(sampleAnalysis, adminUser, ReviewDecision.REPAIR_REQUIRED, "Review 2");
        when(engineerReviewRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(r1, r2));

        List<EngineerReview> result = engineerReviewService.getAllReviews();

        assertNotNull(result);
        assertEquals(2, result.size());
        assertEquals("Review 1", result.get(0).getComments());
        assertEquals("Review 2", result.get(1).getComments());
        verify(engineerReviewRepository, times(1)).findAllByOrderByCreatedAtDesc();
    }
}
