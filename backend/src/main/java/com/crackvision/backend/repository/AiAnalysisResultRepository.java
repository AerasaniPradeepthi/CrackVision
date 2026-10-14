package com.crackvision.backend.repository;

import com.crackvision.backend.entity.AiAnalysisResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AiAnalysisResultRepository extends JpaRepository<AiAnalysisResult, Long> {

    @Query("SELECT r FROM AiAnalysisResult r WHERE r.inspection.id = :inspectionId ORDER BY r.createdAt DESC")
    List<AiAnalysisResult> findByInspectionIdOrderByCreatedAtDesc(@Param("inspectionId") Long inspectionId);

    @Query("SELECT r FROM AiAnalysisResult r WHERE r.inspectionImage.id = :imageId ORDER BY r.createdAt DESC")
    List<AiAnalysisResult> findByInspectionImageIdOrderByCreatedAtDesc(@Param("imageId") Long imageId);

    @Query("SELECT r FROM AiAnalysisResult r WHERE r.inspectionImage.id = :imageId ORDER BY r.createdAt DESC LIMIT 1")
    Optional<AiAnalysisResult> findLatestByInspectionImageId(@Param("imageId") Long imageId);

    @Query("SELECT r FROM AiAnalysisResult r WHERE r.inspection.id = :inspectionId ORDER BY r.createdAt DESC LIMIT 1")
    Optional<AiAnalysisResult> findLatestByInspectionId(@Param("inspectionId") Long inspectionId);

    @Query("SELECT r FROM AiAnalysisResult r WHERE r.inspection.component.id = :componentId AND r.status = 'SUCCESS' ORDER BY r.analyzedAt ASC, r.id ASC")
    List<AiAnalysisResult> findSuccessfulByComponentIdOrderByAnalyzedAtAsc(@Param("componentId") Long componentId);

    @Query("SELECT r FROM AiAnalysisResult r WHERE r.inspection.component.id = :componentId AND r.status = 'SUCCESS' ORDER BY r.analyzedAt DESC, r.id DESC")
    List<AiAnalysisResult> findSuccessfulByComponentIdOrderByAnalyzedAtDesc(@Param("componentId") Long componentId);
}
