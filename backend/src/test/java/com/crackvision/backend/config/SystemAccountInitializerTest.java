package com.crackvision.backend.config;

import com.crackvision.backend.entity.Role;
import com.crackvision.backend.entity.User;
import com.crackvision.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SystemAccountInitializerTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private SystemAccountInitializer initializer;

    @BeforeEach
    void setUp() {
        lenient().when(passwordEncoder.encode(anyString())).thenReturn("hashed_seed_pw");
    }

    @Test
    void testProvisionsAllThreeAccountsWhenInitialPasswordConfigured() {
        initializer.setAdminInitialPassword("SecureSuperSecret2026!");
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        initializer.run();

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository, times(3)).save(userCaptor.capture());

        var savedUsers = userCaptor.getAllValues();
        assertEquals(3, savedUsers.size());

        User admin = savedUsers.stream().filter(u -> u.getEmail().equals("siteadmin@crackvision.com")).findFirst().orElseThrow();
        assertEquals(Role.SITE_ADMIN, admin.getRole());
        assertEquals("Site Admin", admin.getName());

        User engineer = savedUsers.stream().filter(u -> u.getEmail().equals("siteengineer@crackvision.com")).findFirst().orElseThrow();
        assertEquals(Role.SITE_ENGINEER, engineer.getRole());
        assertEquals("Site Engineer", engineer.getName());

        User worker = savedUsers.stream().filter(u -> u.getEmail().equals("siteworker@crackvision.com")).findFirst().orElseThrow();
        assertEquals(Role.SITE_WORKER, worker.getRole());
        assertEquals("Site Worker", worker.getName());
    }

    @Test
    void testDoesNotCreateAccountsWithDefaultPasswordWhenInitialPasswordEmpty() {
        initializer.setAdminInitialPassword(""); // No password configured in production
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());

        initializer.run();

        // Security requirement: Must NOT save or create any accounts with a default password
        verify(userRepository, never()).save(any());
    }

    @Test
    void testSkipsCreationWhenInitialPasswordTooShort() {
        initializer.setAdminInitialPassword("short"); // < 8 characters
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());

        initializer.run();

        // Refuses creation due to insecure password length
        verify(userRepository, never()).save(any());
    }

    @Test
    void testMigratesLegacyAdminAccountWithoutOverwritingPasswordWhenSeedPasswordEmpty() {
        initializer.setAdminInitialPassword(""); // No seed password configured

        User existingLegacyAdmin = new User(11L, "Existing Admin", "siteadmin@crackvision.com", "existing_hashed_pw2", Role.ADMIN, "2026-01-01T00:00:00");
        User existingEngineer = new User(10L, "Existing Eng", "siteengineer@crackvision.com", "existing_hashed_pw", Role.SITE_ENGINEER, "2026-01-01T00:00:00");
        User existingWorker = new User(12L, "Existing Worker", "siteworker@crackvision.com", "existing_hashed_pw3", Role.SITE_WORKER, "2026-01-01T00:00:00");

        when(userRepository.findByEmail("siteadmin@crackvision.com")).thenReturn(Optional.of(existingLegacyAdmin));
        when(userRepository.findByEmail("siteengineer@crackvision.com")).thenReturn(Optional.of(existingEngineer));
        when(userRepository.findByEmail("siteworker@crackvision.com")).thenReturn(Optional.of(existingWorker));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        initializer.run();

        // Legacy ADMIN migrated to SITE_ADMIN safely without password change
        assertEquals(Role.SITE_ADMIN, existingLegacyAdmin.getRole());
        assertEquals("existing_hashed_pw2", existingLegacyAdmin.getPassword());

        // Already in designated roles -> not modified
        verify(userRepository, times(1)).save(existingLegacyAdmin);
        verify(userRepository, never()).save(existingEngineer);
        verify(userRepository, never()).save(existingWorker);
    }

    @Test
    void testRefusesToPromoteUntrustedWorkerAccountWhenInitialPasswordEmpty() {
        initializer.setAdminInitialPassword(""); // Insecure / unconfigured seed password

        User untrustedWorkerAdminEmail = new User(20L, "Attacker Admin", "siteadmin@crackvision.com", "attacker_pw", Role.SITE_WORKER, "2026-01-01T00:00:00");
        User untrustedWorkerEngineerEmail = new User(21L, "Attacker Eng", "siteengineer@crackvision.com", "attacker_pw2", Role.SITE_WORKER, "2026-01-01T00:00:00");
        User existingWorker = new User(22L, "Worker", "siteworker@crackvision.com", "pw", Role.SITE_WORKER, "2026-01-01T00:00:00");

        when(userRepository.findByEmail("siteadmin@crackvision.com")).thenReturn(Optional.of(untrustedWorkerAdminEmail));
        when(userRepository.findByEmail("siteengineer@crackvision.com")).thenReturn(Optional.of(untrustedWorkerEngineerEmail));
        when(userRepository.findByEmail("siteworker@crackvision.com")).thenReturn(Optional.of(existingWorker));

        initializer.run();

        // Security requirement: Must NOT auto-promote untrusted SITE_WORKER to privileged roles
        assertEquals(Role.SITE_WORKER, untrustedWorkerAdminEmail.getRole());
        assertEquals(Role.SITE_WORKER, untrustedWorkerEngineerEmail.getRole());
        verify(userRepository, never()).save(untrustedWorkerAdminEmail);
        verify(userRepository, never()).save(untrustedWorkerEngineerEmail);
    }

    @Test
    void testPromotesAndResetsCredentialsWhenAdminInitialPasswordProvided() {
        initializer.setAdminInitialPassword("SecureSuperSecret2026!");

        User existingWorkerAsAdmin = new User(20L, "Attacker Admin", "siteadmin@crackvision.com", "attacker_pw", Role.SITE_WORKER, "2026-01-01T00:00:00");
        User existingWorkerAsEngineer = new User(21L, "Attacker Eng", "siteengineer@crackvision.com", "attacker_pw2", Role.SITE_WORKER, "2026-01-01T00:00:00");
        User existingWorker = new User(22L, "Worker", "siteworker@crackvision.com", "pw", Role.SITE_WORKER, "2026-01-01T00:00:00");

        when(userRepository.findByEmail("siteadmin@crackvision.com")).thenReturn(Optional.of(existingWorkerAsAdmin));
        when(userRepository.findByEmail("siteengineer@crackvision.com")).thenReturn(Optional.of(existingWorkerAsEngineer));
        when(userRepository.findByEmail("siteworker@crackvision.com")).thenReturn(Optional.of(existingWorker));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        initializer.run();

        // Successfully promoted AND password reset to administrator's secret
        assertEquals(Role.SITE_ADMIN, existingWorkerAsAdmin.getRole());
        assertEquals("hashed_seed_pw", existingWorkerAsAdmin.getPassword());

        assertEquals(Role.SITE_ENGINEER, existingWorkerAsEngineer.getRole());
        assertEquals("hashed_seed_pw", existingWorkerAsEngineer.getPassword());

        verify(userRepository, times(1)).save(existingWorkerAsAdmin);
        verify(userRepository, times(1)).save(existingWorkerAsEngineer);
    }
}
