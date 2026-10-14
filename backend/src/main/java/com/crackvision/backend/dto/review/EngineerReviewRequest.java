package com.crackvision.backend.dto.review;

import com.crackvision.backend.entity.ReviewDecision;

public class EngineerReviewRequest {

    private ReviewDecision decision;
    private String comments;

    public EngineerReviewRequest() {
    }

    public EngineerReviewRequest(ReviewDecision decision, String comments) {
        this.decision = decision;
        this.comments = comments;
    }

    public ReviewDecision getDecision() {
        return decision;
    }

    public void setDecision(ReviewDecision decision) {
        this.decision = decision;
    }

    public String getComments() {
        return comments;
    }

    public void setComments(String comments) {
        this.comments = comments;
    }
}
