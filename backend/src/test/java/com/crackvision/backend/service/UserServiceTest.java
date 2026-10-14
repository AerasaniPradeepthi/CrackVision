package com.crackvision.backend.service;

import com.crackvision.backend.dto.LoginRequest;
import com.crackvision.backend.dto.LoginResponse;
import com.crackvision.backend.entity.Role;
import com.crackvision.backend.entity.User;
import com.crackvision.backend.repository.UserRepository;
import com.crackvision.backend.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @InjectMocks
    private UserService userService;

    private User sampleUser;

    @BeforeEach
    void setUp() {
        sampleUser = new User();
        sampleUser.setId(1L);
        sampleUser.setName("Test Engineer");
        sampleUser.setEmail("testengineer@crackvision.com");
        sampleUser.setPassword("encodedPassword");
        sampleUser.setRole(Role.SITE_ENGINEER);
    }

    @Test
    void testCreateUserAlwaysAssignsSiteWorker() {
        User input = new User();
        input.setName("New Person");
        input.setEmail("new@example.com");
        input.setPassword("rawPassword");
        input.setRole(Role.ADMIN); // Attempt to register as ADMIN

        when(userRepository.findByEmail("new@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("rawPassword")).thenReturn("encodedPassword");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User result = userService.createUser(input);

        // Security requirement: Must be downgraded to SITE_WORKER
        assertEquals(Role.SITE_WORKER, result.getRole());
        assertEquals("encodedPassword", result.getPassword());
        verify(userRepository).save(input);
    }

    @Test
    void testCreateUserDuplicateEmailThrows() {
        User input = new User();
        input.setEmail("existing@example.com");

        when(userRepository.findByEmail("existing@example.com")).thenReturn(Optional.of(sampleUser));

        RuntimeException ex = assertThrows(RuntimeException.class, () -> userService.createUser(input));
        assertEquals("Email already registered", ex.getMessage());
        verify(userRepository, never()).save(any());
    }

    @Test
    void testLoginSuccessReturnsActualRole() {
        LoginRequest request = new LoginRequest();
        request.setEmail("testengineer@crackvision.com");
        request.setPassword("plainPassword");

        when(userRepository.findByEmail("testengineer@crackvision.com")).thenReturn(Optional.of(sampleUser));
        when(passwordEncoder.matches("plainPassword", "encodedPassword")).thenReturn(true);
        when(jwtService.generateToken(sampleUser)).thenReturn("sample.jwt.token");

        LoginResponse response = userService.login(request);

        assertNotNull(response);
        assertEquals("sample.jwt.token", response.getToken());
        assertEquals(Role.SITE_ENGINEER, response.getRole());
        assertEquals("testengineer@crackvision.com", response.getEmail());
    }

    @Test
    void testLoginBadPasswordThrows() {
        LoginRequest request = new LoginRequest();
        request.setEmail("testengineer@crackvision.com");
        request.setPassword("wrongPassword");

        when(userRepository.findByEmail("testengineer@crackvision.com")).thenReturn(Optional.of(sampleUser));
        when(passwordEncoder.matches("wrongPassword", "encodedPassword")).thenReturn(false);

        assertThrows(BadCredentialsException.class, () -> userService.login(request));
    }

    @Test
    void testGetAllUsers() {
        when(userRepository.findAll()).thenReturn(List.of(sampleUser));

        List<User> all = userService.getAllUsers();
        assertEquals(1, all.size());
        assertEquals("testengineer@crackvision.com", all.get(0).getEmail());
    }

    @Test
    void testUpdateUserRole() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(sampleUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User updated = userService.updateUserRole(1L, Role.ADMIN);
        assertEquals(Role.ADMIN, updated.getRole());
        verify(userRepository).save(sampleUser);
    }
}
