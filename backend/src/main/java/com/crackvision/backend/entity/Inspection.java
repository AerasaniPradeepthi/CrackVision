package com.crackvision.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "inspections")
public class Inspection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "component_id", nullable = false)
    private Component component;

    @Column(nullable = false)
    private String status = "PENDING_AI_ANALYSIS";

    private String notes;

    @Column(name = "inspection_date")
    private String inspectionDate;

    @Column(name = "created_at")
    private String createdAt;

    public Inspection() {
    }

    public Inspection(Long id, Component component, String status, String notes, String inspectionDate, String createdAt) {
        this.id = id;
        this.component = component;
        this.status = status;
        this.notes = notes;
        this.inspectionDate = inspectionDate;
        this.createdAt = createdAt;
    }

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now().toString();
        }
        if (inspectionDate == null) {
            inspectionDate = LocalDateTime.now().toString();
        }
        if (status == null) {
            status = "PENDING_AI_ANALYSIS";
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Component getComponent() {
        return component;
    }

    public void setComponent(Component component) {
        this.component = component;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public String getInspectionDate() {
        return inspectionDate;
    }

    public void setInspectionDate(String inspectionDate) {
        this.inspectionDate = inspectionDate;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}
