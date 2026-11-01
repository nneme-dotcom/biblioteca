# Receta para meter la app en un contenedor. Va en dos pasos.

# Paso 1: una imagen con todo lo necesario para compilar el proyecto.
FROM eclipse-temurin:25-jdk AS build
WORKDIR /app

COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .
# Arregla los saltos de línea de Windows para que el script funcione en Linux.
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw
# Bajamos las dependencias antes del código: si solo cambia el código, Docker reaprovecha esta parte y va más rápido.
RUN ./mvnw dependency:go-offline -B

COPY src src
RUN ./mvnw package -DskipTests

# Paso 2: una imagen liviana que solo tiene lo justo para ejecutar la app.
FROM eclipse-temurin:25-jre AS final
WORKDIR /app

COPY --from=build /app/target/biblioteca-0.0.1-SNAPSHOT.jar app.jar

# La app atiende en el puerto 8082.
EXPOSE 8082

ENTRYPOINT ["java", "-jar", "app.jar"]
