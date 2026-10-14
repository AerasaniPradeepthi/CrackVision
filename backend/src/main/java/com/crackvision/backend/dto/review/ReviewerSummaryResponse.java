package com.crackvision.backend.dto.review;

import com.crackvision.backend.entity.Role;
import com.crackvision.backend.entity.User;

public class ReviewerSummaryResponse {

    private Long id;
    private String name;
    private String email;
    private Role role;

    public ReviewerSummaryResponse() {
    }

    public ReviewerSummaryResponse(Long id, String name, String email, Role role) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.role = role;
    }

    public ReviewerSummaryResponse(User user) {
        if (user != null) {
            this.id = user.getId();
            this.name = user.getName();
            this.email = user.getEmail();
            this.role = user.getRole();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }
}
