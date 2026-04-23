# 🚀 Quick Start Guide - Now You See Me

## System Requirements
- Java 17 or higher: `java -version`
- Maven 3.6+: `mvn -version`
- Modern browser (Chrome, Firefox, Safari, Edge)

## Installation & Running

### 1️⃣ Build the Project
```bash
cd /home/abhishek/Documents/Git/NowYouSeeMe/nowyouseeme
mvn clean package -DskipTests
```

### 2️⃣ Run the Application
```bash
mvn spring-boot:run
```

You should see:
```
... Started NowyouseemeApplication in ... seconds ...
```

### 3️⃣ Open in Browser
Open `http://localhost:8080` in your browser

## How to Use

### For Host (First User)
1. Open http://localhost:8080
2. Click the **"Copy Link"** button (the meeting ID will be copied)
3. Share the copied link with guests

### For Guests (Subsequent Users)
1. Receive the link from host (e.g., http://localhost:8080/?meetingId=ABC12345)
2. Open the link in your browser
3. Grant camera/microphone permissions
4. Video call starts automatically!

## User Interface

```
┌─────────────────────────────────────────────────┐
│    📹 Now You See Me                   [Copy]   │  ← Meeting ID & Copy Button
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────┐  ┌──────────────┐           │
│  │              │  │              │ │ 💬 Chat │
│  │  Your Video  │  │  Guest Video │ │ Panel   │
│  │              │  │              │ │         │
│  └──────────────┘  └──────────────┘ │         │
│                                      │         │
│  [More Participants]...              │         │
│                                      │         │
│                                      └─────────┘
├─────────────────────────────────────────────────┤
│         📹 🎤 📞                                │  ← Control Buttons
│      (Video, Audio, End Call)                  │
└─────────────────────────────────────────────────┘
```

## Controls & Shortcuts

### Mouse Controls
- Click 📹 button to toggle video on/off
- Click 🎤 button to toggle audio on/off
- Click 📞 button to end the call
- Type message in chat and press Enter or click Send

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| **V** | Toggle Video |
| **A** | Toggle Audio |
| **Q** | End Call |
| **Enter** | Send Chat Message |

## Troubleshooting

### Issue: "Allow camera access" prompt not appearing
**Solution**: 
- Check browser settings for microphone/camera permissions
- Try using HTTPS in production (localhost HTTP is OK for development)
- Try a different browser

### Issue: Other user can't see your video
**Solution**:
- Click the 📹 button to ensure video is ON (not red/off)
- Check browser console for errors (F12 → Console tab)
- Both users must click "Allow" on the permission prompt
- Try refreshing the page and re-entering the meeting

### Issue: No audio from other person
**Solution**:
- Click the 🎤 button to ensure audio is ON
- Check system volume settings
- Check browser volume settings
- Disable echo cancellation if having issues

### Issue: Can't connect to another user
**Solution**:
- Both users must have the exact same Meeting ID
- Verify WebSocket connection (check Console tab in F12)
- Check firewall settings allow WebSocket
- Restart browser and try again

### Issue: Application won't start
**Solution**:
- Check Java version: `java -version` (needs 17+)
- Check port 8080 is not in use: `netstat -tuln | grep 8080`
- Look at console output for errors
- Try: `mvn clean install -DskipTests` first

## API Testing

### Create a Meeting
```bash
curl -X POST http://localhost:8080/api/meetings/create \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "meetingId": "ABC12345"
}
```

### Check if Meeting Exists
```bash
curl http://localhost:8080/api/meetings/ABC12345/exists
```

Response:
```json
{
  "exists": true
}
```

### Get Meeting Info
```bash
curl http://localhost:8080/api/meetings/ABC12345
```

Response:
```json
{
  "meetingId": "ABC12345",
  "participantCount": 2,
  "hostId": "uuid-string"
}
```

## Architecture Overview

```
Browser 1 (Host)          Browser 2 (Guest)
    ↓                          ↓
    └──→ Spring Boot Server ←──┘
         (Signaling only)
         
    ↓──────────────────────────↓
    Direct P2P Connection
    (Audio/Video/Chat)
```

- **Server Role**: Routes signaling messages (offers, answers, ICE candidates)
- **Peer-to-Peer**: Video, audio, and chat data flows directly between peers
- **No Recording**: Server doesn't store video or audio
- **Auto Cleanup**: Meeting deleted when last person leaves

## Project Structure

```
nowyouseeme/
├── src/main/java/com/redbaron/nowyouseeme/
│   ├── controller/          # REST API endpoints
│   ├── service/             # Business logic
│   ├── model/               # Data models
│   ├── config/              # WebSocket setup
│   └── websocket/           # Signaling handler
├── src/main/resources/
│   ├── templates/index.html # UI page
│   ├── static/js/           # WebRTC client
│   └── application.properties
├── pom.xml                  # Maven dependencies
└── README.md                # Full documentation
```

## Performance Tips

1. **Bandwidth**: Each peer connection uses ~1-2 Mbps for HD video
2. **CPU**: Encoding/decoding video is CPU intensive
3. **Latency**: <100ms is ideal, <500ms is acceptable
4. **Bandwidth Per Participant**: ~1-3 Mbps (depends on resolution)

## Network Requirements

- **Minimum**: 1 Mbps upload/download
- **Recommended**: 5 Mbps upload/download for HD
- **Firewall**: Must allow WebSocket and P2P connections

## Testing with Multiple Browsers

To test locally with multiple users:

**Terminal 1**: Run server
```bash
mvn spring-boot:run
```

**Terminal 2**: Open first user
```bash
open http://localhost:8080
# or firefox http://localhost:8080
```

**Terminal 3**: Open second user
```bash
open http://localhost:8080/?meetingId=COPY_THE_ID
```

## Need Help?

1. Check browser console: Press **F12** → **Console** tab
2. Check server logs: Look at terminal where `mvn spring-boot:run` is running
3. Read the full README.md file
4. Check Java/Maven versions match requirements

---

**Enjoy your video calls! 🎉**

