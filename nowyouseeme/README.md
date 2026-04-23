# Now You See Me - WebRTC Video Calling Application

A modern, real-time video calling application built with **Spring Boot** backend and **WebRTC** for peer-to-peer communication. No sign-up required - just share a meeting ID!

## 🎯 Features

✅ **No Authentication Required** - Simply share a meeting ID to join  
✅ **HD Video & Audio** - Crystal clear peer-to-peer video calls  
✅ **Real-time Chat** - Text messaging using WebRTC Data Channels  
✅ **Multiple Participants** - Support for group meetings  
✅ **Keyboard Shortcuts** - Quick controls for better UX  
✅ **Responsive Design** - Works on desktop and mobile  
✅ **No Data Storage** - Everything is ephemeral (in-memory only)  
✅ **STUN Servers** - Built-in NAT traversal with Google STUN servers  

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (WebRTC Client)                   │
│                  ┌──────────────────────────┐                │
│                  │  HTML5 Video Elements    │                │
│                  │  WebRTC Peer Connection  │                │
│                  │  Data Channels (Chat)    │                │
│                  └──────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                            ↕ (WebSocket)
┌─────────────────────────────────────────────────────────────┐
│            Spring Boot Backend (Signaling Server)            │
│  ┌──────────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ WebSocket    │  │ REST API │  │ Meeting Management   │  │
│  │ Handler      │  │ (Create) │  │ (In-Memory Storage)  │  │
│  └──────────────┘  └──────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                     ↕ (Peer-to-Peer)
        Direct P2P connections for audio/video
```

## 🚀 Getting Started

### Prerequisites

- Java 17 or higher
- Maven 3.6+
- Modern browser with WebRTC support (Chrome, Firefox, Safari, Edge)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd nowyouseeme
```

2. **Build the project**
```bash
mvn clean package
```

3. **Run the application**
```bash
mvn spring-boot:run
```

The application will start on `http://localhost:8080`

## 📖 How to Use

### For the First User (Host)

1. Open `http://localhost:8080` in your browser
2. Allow camera and microphone access when prompted
3. A unique **Meeting ID** will be generated automatically
4. Click **"Copy Link"** to copy the shareable link

### For Subsequent Users (Guests)

1. Receive the meeting link from the host
2. Open the link in your browser (e.g., `http://localhost:8080/?meetingId=ABC12345`)
3. Allow camera and microphone access
4. Video connection will establish automatically

### Controls

| Action | Button | Keyboard |
|--------|--------|----------|
| Toggle Video | 📹 Button | `V` |
| Toggle Audio | 🎤 Button | `A` |
| End Call | 📞 Button | `Q` |
| Send Chat | Send Button | `Enter` |

## 🔧 Project Structure

```
nowyouseeme/
├── src/
│   ├── main/
│   │   ├── java/com/redbaron/nowyouseeme/
│   │   │   ├── NowyouseemeApplication.java        # Main Spring Boot app
│   │   │   ├── controller/
│   │   │   │   ├── HomeController.java            # Serves UI
│   │   │   │   └── MeetingController.java         # REST API
│   │   │   ├── model/
│   │   │   │   ├── Meeting.java                   # Meeting entity
│   │   │   │   └── SignalingMessage.java          # WebRTC signaling messages
│   │   │   ├── service/
│   │   │   │   └── MeetingService.java            # Business logic
│   │   │   ├── config/
│   │   │   │   └── WebSocketConfig.java           # WebSocket setup
│   │   │   └── websocket/
│   │   │       └── SignalingWebSocketHandler.java # Signaling logic
│   │   └── resources/
│   │       ├── application.properties             # App configuration
│   │       ├── templates/
│   │       │   └── index.html                     # Main UI
│   │       └── static/
│   │           └── js/
│   │               └── webrtc-client.js           # Client-side WebRTC
│   └── test/
│       └── java/com/redbaron/nowyouseeme/
│           └── NowyouseemeApplicationTests.java
├── pom.xml                                         # Maven configuration
└── README.md
```

## 🔐 Security & Privacy

- **No User Data Collection** - No logs of conversations or connections
- **No Database** - All data is ephemeral (in-memory)
- **Peer-to-Peer** - Video/audio flows directly between peers, not through server
- **Meeting Isolation** - Each meeting ID is isolated from others
- **Auto-cleanup** - Meetings are automatically deleted when empty

## 🛠️ Technical Details

### Backend Stack
- **Spring Boot 3.2.4** - Web framework
- **Spring WebSocket** - Real-time signaling
- **Thymeleaf** - Server-side templating
- **GSON** - JSON serialization

### Frontend Stack
- **HTML5** - Structure
- **CSS3** - Styling with responsive grid layout
- **WebRTC API** - P2P communication
- **WebSocket** - Signaling channel

### Key Components

#### 1. **WebRTC Signaling Flow**
```
User A                          Server                    User B
  │                               │                         │
  ├──────────── join ────────────→│                         │
  │                               ├───────── user-joined ──→│
  │                               │←────── offer ─────────┤
  │←────── offer ────────────────┤                         │
  │────── answer ────────────────→│                         │
  │                               ├────────── answer ─────→│
  │                               │←──── ice-candidate ───┤
  ├────── ice-candidate ─────────→│                         │
  │                         P2P Connection Established    │
  ├═════════════════════════════════════════════════════════│
  │ (Direct video/audio/data streams - Server not involved)
  │═════════════════════════════════════════════════════════│
```

#### 2. **Data Storage**
- **Meetings**: `ConcurrentHashMap<meetingId, Meeting>`
- **User Sessions**: `ConcurrentHashMap<userId, WebSocketSession>`
- **Active Users per Meeting**: `ConcurrentHashMap<meetingId, Set<userId>>`
- **Cleanup**: Meetings auto-deleted when no participants

#### 3. **WebRTC Configuration**
- **STUN Servers**: Multiple Google STUN servers for NAT traversal
- **Video Constraints**: 1280x720 resolution (HD)
- **Audio Features**: Echo cancellation, noise suppression, auto-gain
- **Data Channels**: Ordered, reliable messaging for chat

## 📊 API Reference

### Create Meeting
```bash
POST /api/meetings/create
Response: { "meetingId": "ABC12345" }
```

### Get Meeting Info
```bash
GET /api/meetings/{meetingId}
Response: {
  "meetingId": "ABC12345",
  "participantCount": 2,
  "hostId": "uuid"
}
```

### Check Meeting Exists
```bash
GET /api/meetings/{meetingId}/exists
Response: { "exists": true }
```

### WebSocket Signaling
```
ws://localhost:8080/ws/signaling

Messages:
- join: User joins meeting
- offer: WebRTC offer
- answer: WebRTC answer
- ice-candidate: ICE candidate
- user-joined: Notification of new user
- user-left: Notification of user leaving
- chat: Text message
```

## 🌐 Deployment

### Docker (Optional)
```dockerfile
FROM openjdk:17-slim
COPY target/nowyouseeme-0.0.1-SNAPSHOT.jar app.jar
ENTRYPOINT ["java","-jar","/app.jar"]
```

### Environment Variables
- `server.port` - Port to run on (default: 8080)
- `spring.profiles.active` - Profile (dev/prod)

### Production Notes
1. Use HTTPS (WebSocket requires secure connections)
2. Configure proper CORS if behind a proxy
3. Use a TURN server for better NAT traversal
4. Add rate limiting for signaling endpoint
5. Monitor WebSocket connections for dead connections

## 📱 Browser Support

| Browser | Desktop | Mobile |
|---------|---------|--------|
| Chrome | ✅ | ✅ |
| Firefox | ✅ | ✅ |
| Safari | ✅ | ✅ |
| Edge | ✅ | ✅ |
| Opera | ✅ | ✅ |

## 🐛 Troubleshooting

### Camera/Microphone Not Working
- Check browser permissions
- Ensure HTTPS if deployed (development can use HTTP)
- Try a different browser

### Can't Connect with Another User
- Verify both users are in the same meeting ID
- Check WebSocket connection in browser console
- Ensure firewall allows WebSocket connections
- Both users need to allow camera/mic access

### Video/Audio Quality Issues
- Check internet bandwidth
- Try reducing resolution in browser settings
- Restart the connection
- Disable other bandwidth-heavy applications

### Meeting Not Persisting
- This is by design! Meetings are temporary
- All data is cleared on disconnect
- Reconnect to create a new session

## 📝 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests.

## 💡 Future Enhancements

- [ ] Screen sharing
- [ ] Meeting recording
- [ ] User authentication
- [ ] Persistent storage
- [ ] Meeting scheduling
- [ ] User profiles
- [ ] Rich text formatting in chat
- [ ] File sharing
- [ ] Mobile app
- [ ] Virtual backgrounds

## 📞 Support

For issues or questions, please open an issue on the GitHub repository.

---

**Built with ❤️ using Spring Boot & WebRTC**

