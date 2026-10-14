package com.crackvision.backend.repository;

import com.crackvision.backend.entity.InspectionImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InspectionImageRepository extends JpaRepository<InspectionImage, Long> {

    @Query("SELECT img FROM InspectionImage img WHERE img.inspection.id = :inspectionId")
    List<InspectionImage> findByInspectionId(@Param("inspectionId") Long inspectionId);

    @Query("SELECT img FROM InspectionImage img WHERE img.id = :id AND img.inspection.id = :inspectionId")
    Optional<InspectionImage> findByIdAndInspectionId(@Param("id") Long id, @Param("inspectionId") Long inspectionId);
}
