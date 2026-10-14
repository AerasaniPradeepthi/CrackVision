package com.crackvision.backend.config;

import com.crackvision.backend.entity.Role;
import com.crackvision.backend.entity.User;
import com.crackvision.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Ensures required system accounts (Site Worker, Site Engineer, Site Admin)
 * exist with their designated roles.
 *
 * For existing accounts: updates role to the intended designation while strictly preserving
 * existing passwords, IDs, and related records (inspections, reviews, etc.).
 * For newly seeded accounts: creates them with the configured seed password.
 */
@Component
public class SystemAccountInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SystemAccountInitializer.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${crackvision.admin.initial-password:}")
    private String adminInitialPassword;

    public SystemAccountInitializer(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public void setAdminInitialPassword(String adminInitialPassword) {
        this.adminInitialPassword = adminInitialPassword;
    }

    @Override
    @Transactional
    public void run(String... args) {
        setupSystemAccount("siteadmin@crackvision.com", "Site Admin", Role.SITE_ADMIN);
        setupSystemAccount("siteengineer@crackvision.com", "Site Engineer", Role.SITE_ENGINEER);
        setupSystemAccount("siteworker@crackvision.com", "Site Worker", Role.SITE_WORKER);
    }

    public User setupSystemAccount(String email, String defaultName, Role targetRole) {
        String cleanEmail = email.trim().toLowerCase();
        Optional<User> existing = userRepository.findByEmail(cleanEmail);
        String seedPassword = adminInitialPassword != null ? adminInitialPassword.trim() : "";
        boolean hasValidSeedPassword = !seedPassword.isEmpty() && seedPassword.length() >= 8;

        if (existing.isPresent()) {
            User user = existing.get();
            if (user.getRole() == targetRole) {
                return user;
            }

            // Safe migration: legacy ADMIN -> SITE_ADMIN is allowed while preserving password
            if (user.getRole() == Role.ADMIN && targetRole == Role.SITE_ADMIN) {
                log.info("Migrating existing administrator account [{}] from legacy ADMIN to designated SITE_ADMIN", cleanEmail);
                user.setRole(targetRole);
                return userRepository.save(user);
            }

            // CRITICAL: Prevent untrusted accounts (e.g. SITE_WORKER) from being promoted solely by email match
            if (user.getRole() == Role.SITE_WORKER && (targetRole == Role.SITE_ADMIN || targetRole == Role.SITE_ENGINEER)) {
                if (!hasValidSeedPassword) {
                    log.warn("Account [{}] exists with role SITE_WORKER. Refusing automated promotion to privileged role [{}] because CRACKVISION_ADMIN_INITIAL_PASSWORD is not configured. An authorized administrator must promote this user.",
                            cleanEmail, targetRole);
                    return user;
                }
                // With explicit administrator seed password provided, administrator takes control of the system account
                log.info("Administrator configured valid CRACKVISION_ADMIN_INITIAL_PASSWORD. Setting designated role [{}] and resetting credentials for system account [{}]",
                        targetRole, cleanEmail);
                user.setRole(targetRole);
                user.setPassword(passwordEncoder.encode(seedPassword));
                return userRepository.save(user);
            }

            // Other migrations require valid seed password
            if (hasValidSeedPassword) {
                user.setRole(targetRole);
                user.setPassword(passwordEncoder.encode(seedPassword));
                return userRepository.save(user);
            }

            log.warn("Account [{}] has role [{}] but designated role is [{}]. Skipping promotion because CRACKVISION_ADMIN_INITIAL_PASSWORD is not configured.",
                    cleanEmail, user.getRole(), targetRole);
            return user;
        }

        // Account does NOT exist in the database yet:
        if (seedPassword.isEmpty()) {
            log.warn("System account [{}] with role [{}] does not exist in database and CRACKVISION_ADMIN_INITIAL_PASSWORD is not configured. " +
                    "Skipping automated account creation to avoid insecure default credentials. " +
                    "Set CRACKVISION_ADMIN_INITIAL_PASSWORD in Render environment variables or provision via Admin.",
                    cleanEmail, targetRole);
            return null;
        }

        if (seedPassword.length() < 8) {
            log.error("CRACKVISION_ADMIN_INITIAL_PASSWORD must be at least 8 characters long. Skipping creation of [{}] for security.",
                    cleanEmail);
            return null;
        }

        log.info("Provisioning initial system account [{}] with role [{}] using administrator-configured secret.",
                cleanEmail, targetRole);
        User user = new User();
        user.setName(defaultName);
        user.setEmail(cleanEmail);
        user.setPassword(passwordEncoder.encode(seedPassword));
        user.setRole(targetRole);
        return userRepository.save(user);
    }
}
