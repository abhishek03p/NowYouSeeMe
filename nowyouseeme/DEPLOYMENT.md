# Production Deployment Guide

## 🔒 Security Checklist

Before deploying to production:

### 1. Enable HTTPS
- Self-signed certificate for testing: `keytool -genkey -alias tomcat -storetype PKCS12 -keyalg RSA -keysize 2048 -keystore keystore.p12 -validity 3650`
- Update `application.properties`:
```properties
server.ssl.key-store=classpath:keystore.p12
server.ssl.key-store-password=your_password
server.ssl.keystore-type=PKCS12
server.ssl.key-alias=tomcat
```

### 2. Set Environment Variables
```bash
export SERVER_PORT=443
export SPRING_PROFILES_ACTIVE=prod
```

### 3. Configure CORS
Update `WebSocketConfig.java`:
```java
registry.addHandler(signalingHandler, "/ws/signaling")
        .setAllowedOrigins("https://yourdomain.com")
        .setAllowedMethods("GET", "POST")
        .setAllowedHeaders("*");
```

### 4. Add Rate Limiting
```bash
# Add to pom.xml
<dependency>
    <groupId>io.github.bucket4j</groupId>
    <artifactId>bucket4j-core</artifactId>
    <version>7.6.0</version>
</dependency>
```

### 5. Add TURN Server Configuration
For better NAT traversal in production:

```java
// Update WebRTCClient.js
this.iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:your-turn-server.com:3478', 
      username: 'user', 
      credential: 'pass' }
];
```

## 🚀 Deployment Options

### Option 1: Docker

```dockerfile
# Dockerfile
FROM openjdk:17-slim

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY target/nowyouseeme-0.0.1-SNAPSHOT.jar app.jar

ENV SERVER_PORT=8080

EXPOSE 8080

ENTRYPOINT ["java", "-Xmx512m", "-Xms256m", "-jar", "/app.jar"]
```

Build and run:
```bash
mvn clean package -DskipTests
docker build -t nowyouseeme:1.0 .
docker run -p 8080:8080 nowyouseeme:1.0
```

### Option 2: Linux Systemd Service

```ini
# /etc/systemd/system/nowyouseeme.service
[Unit]
Description=Now You See Me Video Calling Service
After=network.target

[Service]
Type=simple
User=appuser
WorkingDirectory=/opt/nowyouseeme
ExecStart=/usr/bin/java -Xmx512m -Xms256m -jar nowyouseeme-0.0.1-SNAPSHOT.jar
Restart=always
RestartSec=10
Environment="SERVER_PORT=8080"

[Install]
WantedBy=multi-user.target
```

Enable service:
```bash
sudo systemctl enable nowyouseeme
sudo systemctl start nowyouseeme
sudo systemctl status nowyouseeme
```

### Option 3: AWS Elastic Beanstalk

1. Build JAR: `mvn clean package -DskipTests`
2. Create `.ebextensions/alb-https-sg.config`
3. Deploy: `eb deploy`

### Option 4: Kubernetes

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nowyouseeme
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nowyouseeme
  template:
    metadata:
      labels:
        app: nowyouseeme
    spec:
      containers:
      - name: nowyouseeme
        image: nowyouseeme:1.0
        ports:
        - containerPort: 8080
        env:
        - name: SERVER_PORT
          value: "8080"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

Deploy:
```bash
kubectl apply -f deployment.yaml
kubectl expose deployment nowyouseeme --type=LoadBalancer --port=80 --target-port=8080
```

## 📊 Monitoring & Logging

### Enable Application Insights (Optional)
```properties
# application-prod.properties
logging.level.root=WARN
logging.level.com.redbaron.nowyouseeme=INFO
logging.file.name=/var/log/nowyouseeme/app.log
logging.file.max-size=10MB
logging.file.max-history=10
```

### Monitor WebSocket Connections
```bash
# Check active connections
netstat -an | grep ESTABLISHED | wc -l

# Monitor Java process
jps -l
jstat -gc <pid>
```

## 🔧 Performance Tuning

### JVM Tuning
```bash
java -Xmx1g -Xms512m -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -jar nowyouseeme.jar
```

### Database Connection Pool (if added later)
```properties
spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.idle-timeout=600000
spring.datasource.hikari.max-lifetime=1800000
```

### WebSocket Configuration
```properties
server.tomcat.threads.max=200
server.tomcat.threads.min-spare=10
server.tomcat.accept-count=100
```

## 🔄 Scaling Considerations

### For Multiple Servers (Load Balancing)
Current in-memory storage needs to be replaced:
1. Redis for session storage
2. Database for meeting info
3. Shared WebSocket broker (RabbitMQ, Redis Pub/Sub)

Update dependencies:
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>

<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
```

## 🆘 Troubleshooting Production Issues

### Issue: WebSocket Connection Timeout
```properties
server.tomcat.threads.max=300
server.websocket.max.connections=100000
```

### Issue: High Memory Usage
- Monitor with: `jcmd <pid> VM.heap_info`
- Reduce: `-Xmx256m` (start smaller)
- Check for: WebSocket leaks, unclosed connections

### Issue: CPU Spike
- Check for: Infinite loops in WebRTC signaling
- Monitor: `top -p <pid>`
- Profile with: JFR (Java Flight Recorder)

### View Logs
```bash
# Systemd
journalctl -u nowyouseeme -f

# Docker
docker logs -f <container_id>

# File
tail -f /var/log/nowyouseeme/app.log
```

## 📋 Pre-Launch Checklist

- [ ] HTTPS/SSL certificates installed
- [ ] CORS origins configured correctly
- [ ] Database/Redis configured (if scaling)
- [ ] Logging configured
- [ ] Monitoring set up
- [ ] Backup strategy defined
- [ ] Rate limiting implemented
- [ ] Security headers added
- [ ] STUN/TURN servers configured
- [ ] Health check endpoint tested
- [ ] Load testing completed
- [ ] Documentation updated

## 🎯 Recommended Production Settings

### application-prod.properties
```properties
server.port=443
server.ssl.key-store=classpath:keystore.p12
server.ssl.key-store-password=${KEY_STORE_PASSWORD}
server.ssl.key-store-type=PKCS12

spring.profiles.active=prod
logging.level.root=WARN
logging.level.com.redbaron.nowyouseeme=INFO
logging.file.name=/var/log/nowyouseeme/app.log

# Performance
server.tomcat.threads.max=300
server.tomcat.threads.min-spare=20
server.compression.enabled=true
server.compression.min-response-size=1024
```

---

**For questions or issues, refer to README.md or check server logs.**

