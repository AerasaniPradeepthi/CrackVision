package com.crackvision.backend.security;

import com.crackvision.backend.entity.Role;
import com.crackvision.backend.entity.User;
import com.crackvision.backend.repository.UserRepository;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RoleAuthorizationSecurityTest {

    @Mock
    private JwtService jwtService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FilterChain filterChain;

    private JwtAuthenticationFilter filter;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        filter = new JwtAuthenticationFilter(jwtService, userRepository);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void testWorkerRoleProducesOnlyWorkerAuthority() throws Exception {
        User worker = new User(1L, "Worker John", "worker@crackvision.com", "pass", Role.SITE_WORKER, "2026-01-01");
        when(jwtService.extractEmail("worker.token")).thenReturn("worker@crackvision.com");
        when(userRepository.findByEmail("worker@crackvision.com")).thenReturn(Optional.of(worker));
        when(jwtService.validateToken("worker.token", "worker@crackvision.com")).thenReturn(true);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer worker.token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
        Set<String> authorities = auth.getAuthorities().stream().map(GrantedAuthority::getAuthority).collect(Collectors.toSet());
        assertEquals(Set.of("ROLE_SITE_WORKER"), authorities);
        assertFalse(authorities.contains("ROLE_ADMIN"));
        assertFalse(authorities.contains("ROLE_SITE_ADMIN"));
        assertFalse(authorities.contains("ROLE_SITE_ENGINEER"));
    }

    @Test
    void testEngineerRoleProducesOnlyEngineerAuthority() throws Exception {
        User engineer = new User(2L, "Engineer Jane", "engineer@crackvision.com", "pass", Role.SITE_ENGINEER, "2026-01-01");
        when(jwtService.extractEmail("engineer.token")).thenReturn("engineer@crackvision.com");
        when(userRepository.findByEmail("engineer@crackvision.com")).thenReturn(Optional.of(engineer));
        when(jwtService.validateToken("engineer.token", "engineer@crackvision.com")).thenReturn(true);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer engineer.token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
        Set<String> authorities = auth.getAuthorities().stream().map(GrantedAuthority::getAuthority).collect(Collectors.toSet());
        assertEquals(Set.of("ROLE_SITE_ENGINEER"), authorities);
        assertFalse(authorities.contains("ROLE_ADMIN"));
        assertFalse(authorities.contains("ROLE_SITE_ADMIN"));
    }

    @Test
    void testSiteAdminRoleProducesBothSiteAdminAndAdminAuthorities() throws Exception {
        User siteAdmin = new User(3L, "Admin Site", "siteadmin@crackvision.com", "pass", Role.SITE_ADMIN, "2026-01-01");
        when(jwtService.extractEmail("admin.token")).thenReturn("siteadmin@crackvision.com");
        when(userRepository.findByEmail("siteadmin@crackvision.com")).thenReturn(Optional.of(siteAdmin));
        when(jwtService.validateToken("admin.token", "siteadmin@crackvision.com")).thenReturn(true);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer admin.token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
        Set<String> authorities = auth.getAuthorities().stream().map(GrantedAuthority::getAuthority).collect(Collectors.toSet());
        assertTrue(authorities.contains("ROLE_SITE_ADMIN"));
        assertTrue(authorities.contains("ROLE_ADMIN"));
    }

    @Test
    void testAdminRoleProducesBothAdminAndSiteAdminAuthorities() throws Exception {
        User admin = new User(4L, "Admin Root", "admin@crackvision.com", "pass", Role.ADMIN, "2026-01-01");
        when(jwtService.extractEmail("root.token")).thenReturn("admin@crackvision.com");
        when(userRepository.findByEmail("admin@crackvision.com")).thenReturn(Optional.of(admin));
        when(jwtService.validateToken("root.token", "admin@crackvision.com")).thenReturn(true);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer root.token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
        Set<String> authorities = auth.getAuthorities().stream().map(GrantedAuthority::getAuthority).collect(Collectors.toSet());
        assertTrue(authorities.contains("ROLE_ADMIN"));
        assertTrue(authorities.contains("ROLE_SITE_ADMIN"));
    }

    @Test
    void testNullRoleProducesNoAuthorities() throws Exception {
        User userWithoutRole = new User(5L, "No Role User", "norole@crackvision.com", "pass", null, "2026-01-01");
        when(jwtService.extractEmail("norole.token")).thenReturn("norole@crackvision.com");
        when(userRepository.findByEmail("norole@crackvision.com")).thenReturn(Optional.of(userWithoutRole));
        when(jwtService.validateToken("norole.token", "norole@crackvision.com")).thenReturn(true);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer norole.token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
        assertTrue(auth.getAuthorities().isEmpty());
    }
}
