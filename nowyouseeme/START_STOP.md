# 🚀 How to Start and Stop the Application

## ✅ Quick Start (Most Common Method)

### **START THE APPLICATION**

```bash
cd /home/abhishek/Documents/Git/NowYouSeeMe/nowyouseeme
mvn spring-boot:run
```

**What you'll see:**
```
... 
[INFO] Starting NowyouseemeApplication v0.0.1-SNAPSHOT using Java 17...
... 
[INFO] Tomcat started on port(s): 8080 (http)
[INFO] Started NowyouseemeApplication in X seconds
```

**Once you see "Started NowyouseemeApplication", the app is ready!**

Open your browser: **http://localhost:8080**

---

### **STOP THE APPLICATION**

In the terminal where the app is running, press:

```
Ctrl + C
```

**You'll see:**
```
... 
[INFO] Shutting down...
... 
Process ended
```

---

## 🔄 Alternative Methods

### **Method 2: Run Pre-built JAR**

First, build the JAR file:
```bash
mvn clean package -DskipTests
```

Then run it:
```bash
java -jar target/nowyouseeme-0.0.1-SNAPSHOT.jar
```

Stop it: **Ctrl + C**

---

### **Method 3: Run in Background (Linux/Mac)**

Start in background:
```bash
mvn spring-boot:run &
```

Find the process:
```bash
ps aux | grep NowyouseemeApplication
```

Stop it by process ID (PID):
```bash
kill -9 <PID>
```

Example:
```bash
kill -9 12345
```

---

### **Method 4: Run with Custom Port**

Start on different port (e.g., 3000):
```bash
mvn spring-boot:run -Dspring-boot.run.arguments="--server.port=3000"
```

Then open: **http://localhost:3000**

---

### **Method 5: Use Maven Wrapper (No Maven Required)**

Start:
```bash
./mvnw spring-boot:run
```

Stop: **Ctrl + C**

---

## 📋 Quick Reference

| Task | Command |
|------|---------|
| **Start** | `mvn spring-boot:run` |
| **Stop** | `Ctrl + C` |
| **Build JAR** | `mvn clean package -DskipTests` |
| **Run JAR** | `java -jar target/nowyouseeme-*.jar` |
| **Check if running** | `curl http://localhost:8080` |
| **Kill by port** | `lsof -i :8080` then `kill -9 <PID>` |
| **Different port** | `--server.port=3000` |

---

## ✔️ Verify Application is Running

### **Test 1: URL in Browser**
Open http://localhost:8080 in your browser

Should show the video calling interface

### **Test 2: Using cURL**
```bash
curl http://localhost:8080
```

Should return HTML

### **Test 3: API Test**
```bash
curl -X POST http://localhost:8080/api/meetings/create
```

Should return:
```json
{"meetingId":"ABC12345"}
```

---

## 🛑 Troubleshooting

### **Issue: Port 8080 Already in Use**

Find what's using it:
```bash
lsof -i :8080
```

Output example:
```
COMMAND    PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
java     12345  user   50u  IPv6  0x1234567890ab  0t0  TCP *:8080 (LISTEN)
```

Kill it:
```bash
kill -9 12345
```

Or use different port:
```bash
mvn spring-boot:run -Dspring-boot.run.arguments="--server.port=3000"
```

### **Issue: Java Not Found**

Check if Java is installed:
```bash
java -version
```

If not installed:
- **Ubuntu/Debian**: `sudo apt install openjdk-17-jdk`
- **Mac**: `brew install openjdk@17`
- **Windows**: Download from oracle.com

### **Issue: Maven Not Found**

Check if Maven is installed:
```bash
mvn -version
```

If not installed:
- **Ubuntu/Debian**: `sudo apt install maven`
- **Mac**: `brew install maven`
- **Windows**: Download from maven.apache.org

### **Issue: Application Crashes on Start**

Check the error message in terminal and:
1. Verify Java 17+: `java -version`
2. Verify Maven: `mvn -version`
3. Clean and rebuild: `mvn clean compile`
4. Check logs for specific errors

---

## 📊 Process Management

### **View Running Processes**
```bash
ps aux | grep java
```

### **List Processes on Port 8080**
```bash
lsof -i :8080
```

### **Kill Process by Name**
```bash
pkill -f NowyouseemeApplication
```

### **Kill Process by PID**
```bash
kill -9 <PID>
```

---

## 🎯 Complete Workflow Example

```bash
# 1. Navigate to project
cd /home/abhishek/Documents/Git/NowYouSeeMe/nowyouseeme

# 2. Clean build (optional but recommended first time)
mvn clean package -DskipTests

# 3. Start the application
mvn spring-boot:run

# (In another terminal)

# 4. Test the API
curl -X POST http://localhost:8080/api/meetings/create

# 5. Open in browser
open http://localhost:8080

# Back in original terminal:

# 6. When done, stop the application
# Press: Ctrl + C
```

---

## ⏱️ Expected Start Time

- **First build**: 30-60 seconds (downloads dependencies)
- **Subsequent starts**: 10-15 seconds
- **Ready when you see**: "Started NowyouseemeApplication"

---

## 🔧 Advanced Options

### **Run with Debug Mode**
```bash
mvn spring-boot:run -Dspring-boot.run.arguments="--debug"
```

### **Run with Extra Logging**
```bash
mvn spring-boot:run -Dspring-boot.run.arguments="--logging.level.root=DEBUG"
```

### **Run with Custom JVM Memory**
```bash
mvn spring-boot:run -DskipTests=true -X
```

Or:
```bash
MAVEN_OPTS="-Xmx512m" mvn spring-boot:run
```

### **Run Multiple Instances on Different Ports**

**Terminal 1:**
```bash
mvn spring-boot:run -Dspring-boot.run.arguments="--server.port=8080"
```

**Terminal 2:**
```bash
mvn spring-boot:run -Dspring-boot.run.arguments="--server.port=8081"
```

---

## 📝 Environment Variables

```bash
# Set custom port
export SERVER_PORT=3000
mvn spring-boot:run

# Set profile
export SPRING_PROFILES_ACTIVE=prod
mvn spring-boot:run

# Set custom properties
export SPRING_APPLICATION_JSON='{"server":{"port":8080}}'
mvn spring-boot:run
```

---

## 🎯 Common Workflows

### **Workflow 1: Quick Test**
```bash
cd nowyouseeme
mvn spring-boot:run
# Test in browser (http://localhost:8080)
# Stop with Ctrl+C
```

### **Workflow 2: Build & Deploy**
```bash
cd nowyouseeme
mvn clean package -DskipTests
java -jar target/nowyouseeme-0.0.1-SNAPSHOT.jar
# Stop with Ctrl+C
```

### **Workflow 3: Background Development**
```bash
cd nowyouseeme
mvn spring-boot:run &
# Use app
kill %1  # Kill background job
# Or: kill -9 <PID>
```

### **Workflow 4: Production Systemd Service**
See DEPLOYMENT.md for setting up as Linux service

---

## ✨ Tips & Tricks

### **Tip 1: Rebuild Faster**
```bash
mvn package -DskipTests -q
java -jar target/nowyouseeme-0.0.1-SNAPSHOT.jar
```

### **Tip 2: Check Server Health**
```bash
# While app is running in another terminal
curl http://localhost:8080/api/meetings/create | jq .
```

### **Tip 3: View Live Logs**
App logs appear in the terminal while running

### **Tip 4: Change JVM Heap Size**
```bash
java -Xmx512m -Xms256m -jar target/nowyouseeme-0.0.1-SNAPSHOT.jar
```

### **Tip 5: Run Without Waiting for Maven Download**
First run:
```bash
mvn dependency:resolve
mvn spring-boot:run
```

---

## 🚨 Emergency Stop

If normal Ctrl+C doesn't work:

**Option 1: Kill by Port**
```bash
lsof -ti:8080 | xargs kill -9
```

**Option 2: Kill by Process Name**
```bash
pkill -9 -f java
```

**Option 3: Kill All Java Processes**
```bash
killall -9 java
```

---

## 📞 Quick Help

**Can't connect to http://localhost:8080?**
1. Check if server is running: `curl http://localhost:8080`
2. Check port 8080 is free: `lsof -i :8080`
3. Try different port: `--server.port=3000`

**Server won't start?**
1. Check Java: `java -version` (needs 17+)
2. Clean build: `mvn clean compile`
3. Check errors in console output

**Need to free port 8080?**
```bash
lsof -i :8080
kill -9 <PID>
```

---

## 📚 Related Documentation

- **README.md** - Full project documentation
- **QUICKSTART.md** - Quick start guide
- **DEPLOYMENT.md** - Production deployment
- **FEATURES.md** - Feature list

---

## Summary

```
START:     cd nowyouseeme && mvn spring-boot:run
VERIFY:    curl http://localhost:8080
BROWSER:   http://localhost:8080
STOP:      Ctrl + C
```

**That's it! 🎉**

---

**Happy video calling! 📹**

