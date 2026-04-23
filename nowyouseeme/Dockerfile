FROM eclipse-temurin:17-jdk

WORKDIR /app

COPY . .

# Install Maven
RUN apt-get update && apt-get install -y maven

# Build using mvn (not mvnw)
RUN mvn clean package -DskipTests

CMD ["sh", "-c", "java -jar target/*.jar"]