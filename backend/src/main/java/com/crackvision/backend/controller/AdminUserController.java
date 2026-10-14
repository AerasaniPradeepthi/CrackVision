package com.crackvision.backend.controller;

import com.crackvision.backend.dto.UserResponse;
import com.crackvision.backend.entity.Role;
import com.crackvision.backend.entity.User;
import com.crackvision.backend.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
public class AdminUserController {

    private final UserService userService;

    public AdminUserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/test")
    @PreAuthorize("hasAnyRole('ADMIN', 'SITE_ADMIN')")
    public String test() {
        return "Admin endpoint accessed successfully";
    }

    /**
     * Retrieves all registered users in the system.
     * Restricted strictly to ADMIN or SITE_ADMIN role.
     */
    @GetMapping("/users")
    @PreAuthorize("hasAnyRole('ADMIN', 'SITE_ADMIN')")
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        List<UserResponse> users = userService.getAllUsers().stream()
                .map(UserResponse::new)
                .collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }

    /**
     * Updates an existing user's role.
     * Restricted strictly to ADMIN or SITE_ADMIN role.
     */
    @PutMapping("/users/{userId}/role")
    @PreAuthorize("hasAnyRole('ADMIN', 'SITE_ADMIN')")
    public ResponseEntity<?> updateUserRole(
            @PathVariable Long userId,
            @RequestBody Map<String, String> request) {
        try {
            String roleStr = request.get("role");
            if (roleStr == null || roleStr.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Role is required"));
            }
            Role newRole = Role.valueOf(roleStr.trim().toUpperCase());
            User updated = userService.updateUserRole(userId, newRole);
            return ResponseEntity.ok(new UserResponse(updated));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid role: " + request.get("role")));
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }
}
