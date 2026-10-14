package com.crackvision.backend.repository;

import com.crackvision.backend.entity.EngineerReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EngineerReviewRepository extends JpaRepository<EngineerReview, Long> {

    @Query("SELECT r FROM EngineerReview r WHERE r.aiAnalysisResult.id = :analysisId ORDER BY r.createdAt DESC")
    List<EngineerReview> findByAnalysisIdOrderByCreatedAtDesc(@Param("analysisId") Long analysisId);

    @Query("SELECT r FROM EngineerReview r WHERE r.aiAnalysisResult.id = :analysisId ORDER BY r.createdAt DESC LIMIT 1")
    Optional<EngineerReview> findLatestByAnalysisId(@Param("analysisId") Long analysisId);

    @Query("SELECT r FROM EngineerReview r WHERE r.aiAnalysisResult.inspection.id = :inspectionId ORDER BY r.createdAt DESC")
    List<EngineerReview> findByInspectionIdOrderByCreatedAtDesc(@Param("inspectionId") Long inspectionId);

    @Query("SELECT r FROM EngineerReview r WHERE r.aiAnalysisResult.inspection.id = :inspectionId ORDER BY r.createdAt DESC LIMIT 1")
    Optional<EngineerReview> findLatestByInspectionId(@Param("inspectionId") Long inspectionId);

    @Query("SELECT r FROM EngineerReview r WHERE r.aiAnalysisResult.id IN :analysisIds ORDER BY r.createdAt DESC")
    List<EngineerReview> findByAnalysisIdInOrderByCreatedAtDesc(@Param("analysisIds") List<Long> analysisIds);

    @Query("SELECT r FROM EngineerReview r JOIN FETCH r.aiAnalysisResult a JOIN FETCH a.inspection i LEFT JOIN FETCH a.inspectionImage img JOIN FETCH r.reviewer u ORDER BY r.createdAt DESC")
    List<EngineerReview> findAllByOrderByCreatedAtDesc();
}
