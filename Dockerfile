# ==============================================================================
# CrackVision Backend - Dockerfile (Repository Root Context)
# Used when Render Root Directory is left empty (root of repository)
# ==============================================================================

# Build Stage
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /build

# Cache maven dependencies from backend directory
COPY backend/pom.xml .
RUN mvn dependency:go-offline -B

# Copy source and build executable fat JAR
COPY backend/src ./src
RUN mvn clean package -DskipTests

# Runtime Stage
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Create default upload directory for inspection images
RUN mkdir -p /app/uploads/inspections

# Copy compiled jar from build stage
COPY --from=build /build/target/*.jar app.jar

# Render injects PORT dynamically; default to 5050 for local container testing
ENV PORT=5050
EXPOSE 5050

# Launch Spring Boot with optimized JVM entropy configuration
ENTRYPOINT ["java", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]
