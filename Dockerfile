# ==============================================================================
# CrackVision Backend - Dockerfile (Repository Root Context)
# Used when Render Root Directory is left empty (root of repository)
# ==============================================================================

# Build Stage
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /build

# Set Maven options to limit memory usage on Render free tier (512MB RAM)
ENV MAVEN_OPTS="-Xmx400m -Xms64m -XX:MaxMetaspaceSize=128m"

# Cache maven dependencies from backend directory
COPY backend/pom.xml .
RUN mvn dependency:go-offline -B --no-transfer-progress

# Copy source and build executable fat JAR
COPY backend/src ./src
RUN mvn clean package -DskipTests -B --no-transfer-progress

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
