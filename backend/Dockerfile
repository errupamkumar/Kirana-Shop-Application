# Base images come from Docker Hub by default; set BASE_REGISTRY=mirror.gcr.io/library to use Google's mirror
ARG BASE_REGISTRY=docker.io/library

# Build stage
FROM ${BASE_REGISTRY}/eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline
COPY src src
RUN ./mvnw -B -q package -DskipTests

# Runtime stage
FROM ${BASE_REGISTRY}/eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 1001 kirana && mkdir -p /data/media && chown kirana /data/media
COPY --from=build /app/target/kirana-backend-*.jar app.jar
USER kirana
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
