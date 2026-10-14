package com.crackvision.backend.controller;

import com.crackvision.backend.entity.Role;
import com.crackvision.backend.entity.User;
import com.crackvision.backend.service.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class AdminUserControllerTest {

    @Mock
    private UserService userService;

    @InjectMocks
    private AdminUserController adminUserController;

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private User sampleUser;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(adminUserController).build();

        sampleUser = new User();
        sampleUser.setId(10L);
        sampleUser.setName("Worker John");
        sampleUser.setEmail("worker@crackvision.com");
        sampleUser.setRole(Role.SITE_WORKER);
    }

    @Test
    void testAdminTestEndpoint() throws Exception {
        mockMvc.perform(get("/api/admin/test"))
                .andExpect(status().isOk())
                .andExpect(content().string("Admin endpoint accessed successfully"));
    }

    @Test
    void testGetAllUsers() throws Exception {
        User admin = new User(1L, "Admin User", "admin@crackvision.com", "pass", Role.ADMIN, "2026-10-12");
        when(userService.getAllUsers()).thenReturn(List.of(admin, sampleUser));

        mockMvc.perform(get("/api/admin/users"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].email", is("admin@crackvision.com")))
                .andExpect(jsonPath("$[0].role", is("ADMIN")))
                .andExpect(jsonPath("$[1].email", is("worker@crackvision.com")))
                .andExpect(jsonPath("$[1].role", is("SITE_WORKER")));

        verify(userService).getAllUsers();
    }

    @Test
    void testUpdateUserRoleSuccess() throws Exception {
        User updated = new User(10L, "Worker John", "worker@crackvision.com", "pass", Role.SITE_ENGINEER, "2026-10-12");
        when(userService.updateUserRole(eq(10L), eq(Role.SITE_ENGINEER))).thenReturn(updated);

        mockMvc.perform(put("/api/admin/users/10/role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("role", "SITE_ENGINEER"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(10)))
                .andExpect(jsonPath("$.role", is("SITE_ENGINEER")));

        verify(userService).updateUserRole(10L, Role.SITE_ENGINEER);
    }

    @Test
    void testUpdateUserRoleInvalidRole() throws Exception {
        mockMvc.perform(put("/api/admin/users/10/role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("role", "SUPER_GOD_MODE"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("Invalid role")));

        verify(userService, never()).updateUserRole(any(), any());
    }

    @Test
    void testUpdateUserRoleUserNotFound() throws Exception {
        when(userService.updateUserRole(eq(999L), eq(Role.ADMIN)))
                .thenThrow(new RuntimeException("User not found with id: 999"));

        mockMvc.perform(put("/api/admin/users/999/role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("role", "ADMIN"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error", is("User not found with id: 999")));
    }
}
