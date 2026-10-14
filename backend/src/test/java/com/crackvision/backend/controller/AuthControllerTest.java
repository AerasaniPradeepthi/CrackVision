package com.crackvision.backend.controller;

import com.crackvision.backend.dto.LoginRequest;
import com.crackvision.backend.dto.LoginResponse;
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
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private UserService userService;

    @InjectMocks
    private AuthController authController;

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private User sampleUser;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(authController).build();

        sampleUser = new User();
        sampleUser.setId(1L);
        sampleUser.setName("Alex Rivera");
        sampleUser.setEmail("alex@crackvision.com");
        sampleUser.setRole(Role.SITE_WORKER);
    }

    @Test
    void testRegisterSuccessReturns201() throws Exception {
        User input = new User();
        input.setName("Alex Rivera");
        input.setEmail("alex@crackvision.com");
        input.setPassword("password123");

        when(userService.createUser(any(User.class))).thenReturn(sampleUser);

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("alex@crackvision.com"))
                .andExpect(jsonPath("$.role").value("SITE_WORKER"));
    }

    @Test
    void testRegisterDuplicateEmailReturns409() throws Exception {
        User input = new User();
        input.setName("Alex Rivera");
        input.setEmail("alex@crackvision.com");
        input.setPassword("password123");

        when(userService.createUser(any(User.class)))
                .thenThrow(new RuntimeException("Email already registered"));

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("Email already registered"));
    }

    @Test
    void testRegisterMissingEmailReturns400() throws Exception {
        User input = new User();
        input.setPassword("password123");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Email is required"));
    }

    @Test
    void testRegisterMissingPasswordReturns400() throws Exception {
        User input = new User();
        input.setEmail("alex@crackvision.com");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Password is required"));
    }

    @Test
    void testLoginSuccessReturns200() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setEmail("alex@crackvision.com");
        request.setPassword("password123");

        LoginResponse response = new LoginResponse("sample.token", 1L, "Alex Rivera", "alex@crackvision.com", Role.SITE_WORKER);
        when(userService.login(any(LoginRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("sample.token"))
                .andExpect(jsonPath("$.role").value("SITE_WORKER"));
    }

    @Test
    void testLoginBadCredentialsReturns401() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setEmail("alex@crackvision.com");
        request.setPassword("wrong");

        when(userService.login(any(LoginRequest.class)))
                .thenThrow(new BadCredentialsException("Invalid email or password"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Invalid email or password"));
    }
}
