FROM gradle:8.5-jdk21 AS builder

WORKDIR /workspace

COPY --chown=gradle:gradle . .
RUN gradle \
    :api-gateway:bootJar \
    :office-service:bootJar \
    :user-service:bootJar \
    :doc-server:bootJar \
    :project-manager:bootJar \
    -x test \
    --no-daemon

FROM eclipse-temurin:21-jre-jammy AS runtime

WORKDIR /app

ENTRYPOINT ["java", "-jar", "app.jar"]

FROM runtime AS api-gateway
COPY --from=builder /workspace/api-gateway/build/libs/*.jar app.jar
EXPOSE 9000

FROM runtime AS office-service
COPY --from=builder /workspace/office-service/build/libs/*.jar app.jar
EXPOSE 8080

FROM runtime AS user-service
COPY --from=builder /workspace/user-service/build/libs/*.jar app.jar
EXPOSE 8082

FROM runtime AS doc-service
COPY --from=builder /workspace/doc-server/build/libs/*.jar app.jar
EXPOSE 8083

FROM runtime AS project-manager
COPY --from=builder /workspace/project-manager/build/libs/*.jar app.jar
EXPOSE 9087
