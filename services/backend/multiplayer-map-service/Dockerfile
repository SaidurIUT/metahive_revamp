FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /workspace

COPY pom.xml .
RUN mvn -q -Dmaven.test.skip=true dependency:go-offline

COPY . .
RUN mvn -Dmaven.test.skip=true package

FROM eclipse-temurin:21-jre-jammy

WORKDIR /app

COPY --from=builder /workspace/target/MetaHive-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 9502

ENTRYPOINT ["java", "-jar", "app.jar"]
