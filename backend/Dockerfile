# Build Stage
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /build

COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn clean package -DskipTests

# Runtime Stage
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Create uploads directory for inspection images
RUN mkdir -p /app/uploads/inspections

COPY --from=build /build/target/*.jar app.jar

EXPOSE 5050

ENTRYPOINT ["java", "-jar", "app.jar"]
