package com.crackvision.backend.service;

import com.crackvision.backend.dto.LoginRequest;
import com.crackvision.backend.dto.LoginResponse;
import com.crackvision.backend.entity.Role;
import com.crackvision.backend.entity.User;
import com.crackvision.backend.repository.UserRepository;
import com.crackvision.backend.security.JwtService;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    private static final java.util.Set<String> RESERVED_SYSTEM_EMAILS = java.util.Set.of(
            "siteadmin@crackvision.com",
            "siteengineer@crackvision.com",
            "siteworker@crackvision.com"
    );

    public User createUser(User user) {
        String normalizedEmail = user.getEmail() != null ? user.getEmail().trim().toLowerCase() : "";
        if (normalizedEmail.isEmpty()) {
            throw new IllegalArgumentException("Email is required");
        }
        if (RESERVED_SYSTEM_EMAILS.contains(normalizedEmail)) {
            throw new IllegalArgumentException("Registration with reserved system account '" + normalizedEmail + "' is not permitted. Please use your personal or organization email.");
        }
        user.setEmail(normalizedEmail);
        if (userRepository.findByEmail(normalizedEmail).isPresent()) {
            throw new RuntimeException("Email already registered");
        }
        // Public self-registration ALWAYS assigns SITE_WORKER for security
        // Privileged roles (SITE_ENGINEER, SITE_ADMIN) can only be assigned via Admin or system setup
        user.setRole(Role.SITE_WORKER);
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        return userRepository.save(user);
    }

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    public User updateUserRole(Long userId, Role newRole) {
        if (newRole == null) {
            throw new IllegalArgumentException("Role cannot be null");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + userId));
        user.setRole(newRole);
        return userRepository.save(user);
    }

    public LoginResponse login(LoginRequest loginRequest) {
        String email = loginRequest.getEmail() != null ? loginRequest.getEmail().trim().toLowerCase() : "";
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        if (!passwordEncoder.matches(loginRequest.getPassword(), user.getPassword())) {
            throw new BadCredentialsException("Invalid email or password");
        }

        String token = jwtService.generateToken(user);
        return new LoginResponse(token, user.getId(), user.getName(), user.getEmail(), user.getRole());
    }
}
