# ❓ FAQ - Frequently Asked Questions

## Getting Started

### Q: How do I start the application?
**A:** 
```bash
cd /home/abhishek/Documents/Git/NowYouSeeMe/nowyouseeme
mvn spring-boot:run
```
Then open http://localhost:8080 in your browser.

### Q: Do I need Java installed?
**A:** Yes, Java 17 or higher. Check with: `java -version`

### Q: Do I need Maven installed?
**A:** Yes, Maven 3.6+. Check with: `mvn -version`

### Q: Which browsers are supported?
**A:** Chrome, Firefox, Safari, Edge, Opera (any browser with WebRTC support)

### Q: Does it work on mobile?
**A:** Yes, it works on mobile browsers (Chrome, Safari on iOS)

---

## Using the App

### Q: How do I create a meeting?
**A:** Just open http://localhost:8080 and a meeting ID is generated automatically.

### Q: How do I invite someone?
**A:** Click "Copy Link" button and send the copied link to others.

### Q: Why do I need to allow camera/microphone access?
**A:** WebRTC needs access to stream video and audio between users.

### Q: Can I join without allowing camera/microphone?
**A:** No, both are required to use video calling. You can deny, but the app won't work.

### Q: What if I want audio only (no video)?
**A:** Start with video enabled, then click the 📹 button to disable video. Audio will continue.

### Q: How many people can join one meeting?
**A:** Theoretically unlimited, but practical limits depend on:
- Computer CPU (video encoding)
- Network bandwidth (1-3 Mbps per person)
- Browser limitations (~10+ usually works fine)

### Q: Can I use keyboard shortcuts?
**A:** Yes!
- **V** = Toggle Video
- **A** = Toggle Audio
- **Q** = End Call
- **Enter** = Send Chat

### Q: How do I send a chat message?
**A:** Type in the chat box on the right and press Enter or click Send.

### Q: Can I see who I'm talking to?
**A:** Yes, video labels show "You" for your own video and user IDs for others.

---

## Troubleshooting

### Q: The page won't load
**A:** 
1. Check server is running: `curl http://localhost:8080`
2. Check port 8080 is free: `lsof -i :8080`
3. Try different browser

### Q: Camera/microphone not working
**A:**
1. Check browser permissions (usually top-right of address bar)
2. Check system volume settings
3. Try another app (like Zoom) to verify camera works
4. Try different browser
5. Check no other app is using the camera

### Q: Other user can't see my video
**A:**
1. Click the 📹 button to ensure video is ON
2. Check their camera works too
3. Both must grant permission
4. Try refreshing page

### Q: No audio from other person
**A:**
1. Click 🎤 button to ensure audio is ON
2. Check system volume
3. Unmute browser tab (right-click on tab)
4. Check microphone isn't muted in OS settings

### Q: Can't connect to another user
**A:**
1. Verify same Meeting ID
2. Both users must have opened the link
3. Both must grant permissions
4. Check browser console for errors (F12)
5. Try reloading page
6. Check firewall allows WebSocket

### Q: Meeting disappears when I refresh
**A:** This is by design! Meetings are temporary. Reconnect to create a new one.

### Q: Server won't start
**A:**
1. Check Java version: `java -version` (needs 17+)
2. Check Maven: `mvn -version`
3. Check port 8080 not in use: `lsof -i :8080`
4. Try: `mvn clean compile`
5. Check error messages in console

### Q: Port 8080 already in use
**A:**
1. Find what's using it: `lsof -i :8080`
2. Kill the process: `kill -9 <PID>`
3. Or change port in application.properties: `server.port=8081`

### Q: CPU usage very high
**A:**
1. Close other applications
2. Reduce number of participants
3. Disable video if only audio needed
4. Check browser isn't using 100% CPU (task manager)

### Q: Video quality bad
**A:**
1. Check internet speed: speedtest.net
2. Reduce resolution (can't change without coding)
3. Reduce number of participants
4. Close background applications using bandwidth

### Q: Getting error messages
**A:**
1. Check browser console: Press F12
2. Check server console (terminal where you ran mvn)
3. Look for specific error messages
4. Google the error message
5. Check QUICKSTART.md troubleshooting

---

## Technical Questions

### Q: Is my video/audio stored anywhere?
**A:** No! Everything is streamed P2P. Server only handles signaling (connection setup).

### Q: Is my chat stored?
**A:** No! Chat is sent P2P through WebRTC data channels. Nothing is logged.

### Q: What about security/privacy?
**A:** 
- No user accounts
- No data collection
- P2P encryption (WebRTC built-in)
- Meetings auto-deleted
- HTTPS recommended for production

### Q: Can someone see my conversation if they know the Meeting ID?
**A:** The meeting is auto-deleted when the last person leaves. If someone has the link within that timeframe, they could theoretically join.

### Q: How are STUN servers used?
**A:** STUN servers help find your public IP for P2P connection. They don't relay your data. Using Google's free STUN servers.

### Q: What if STUN servers don't work?
**A:** You might be behind a strict firewall. You'd need a TURN server (see DEPLOYMENT.md).

### Q: Does the server need internet?
**A:** No, it works on localhost without internet for local testing. For remote users, you need internet.

### Q: Can I use this on my own domain?
**A:** Yes! Follow DEPLOYMENT.md guide to deploy to your server.

### Q: Can I add authentication?
**A:** Yes, you can modify the code to add login. See DEPLOYMENT.md for guidance.

### Q: Can I add recording?
**A:** You can implement MediaRecorder API on the frontend or server-side recording.

### Q: Can I add screen sharing?
**A:** Yes, use RTCDesktopCaptureAPI. Complex but possible.

---

## Customization

### Q: Can I change the colors?
**A:** Yes! Edit index.html CSS section. Look for gradient colors like `#667eea` and `#764ba2`.

### Q: Can I change the meeting link format?
**A:** Yes, edit MeetingService.java generateMeetingId() method.

### Q: Can I add a logo?
**A:** Yes, add `<img>` tag in index.html header section.

### Q: Can I change the port?
**A:** Yes, edit `application.properties`: `server.port=3000`

### Q: Can I add custom TURN server?
**A:** Yes, edit webrtc-client.js iceServers array.

### Q: Can I store meetings in a database?
**A:** Yes, add Spring Data JPA dependency and replace MeetingService.

---

## Deployment

### Q: How do I deploy to the cloud?
**A:** See DEPLOYMENT.md file for Docker, Kubernetes, AWS, etc.

### Q: Do I need HTTPS?
**A:** Yes, for production. Local development can use HTTP.

### Q: What's a TURN server?
**A:** A relay server for when P2P doesn't work due to firewalls.

### Q: Where can I get a free TURN server?
**A:** Coturn (self-hosted), XIRSYS, Twillio, or use cloud provider's TURN service.

### Q: How much does it cost to run?
**A:** Depends on provider. Local: free. Cloud: $5-50/month for low traffic.

### Q: Can multiple servers handle the same app?
**A:** Yes, but meetings need Redis/DB for sharing state. See DEPLOYMENT.md.

---

## Advanced

### Q: Can I use a CDN?
**A:** For static files (JS/CSS), yes. For WebSocket signaling, no (needs live connection).

### Q: Can I run multiple instances?
**A:** Yes, with Redis pub/sub for distributed signaling. See DEPLOYMENT.md.

### Q: How do I monitor the app?
**A:** Check logs, monitor WebSocket connections, track memory/CPU. See DEPLOYMENT.md.

### Q: Can I add analytics?
**A:** Yes, add monitoring tools like DataDog, Prometheus, etc.

### Q: How do I backup data?
**A:** Currently no persistent data. If adding database, use standard DB backup tools.

### Q: Can I use this commercially?
**A:** Yes, it's open source. Check license for requirements.

---

## Performance

### Q: What's the minimum bandwidth needed?
**A:** ~1 Mbps per participant. 5 Mbps recommended for HD.

### Q: What's latency like?
**A:** <100ms optimal, <500ms acceptable for most use cases.

### Q: How many concurrent users can one server handle?
**A:** ~1000+ WebSocket connections. Limited by:
- CPU for relaying messages
- Memory for storing connections
- Network bandwidth for signaling

### Q: Does video quality adjust automatically?
**A:** WebRTC's built-in mechanism helps. Can't directly control from app.

### Q: Why is my CPU usage high?
**A:** WebRTC video encoding is CPU intensive. Multiple participants = higher CPU.

### Q: How can I reduce bandwidth usage?
**A:** 
1. Lower video resolution
2. Reduce frame rate
3. Use audio-only mode
4. Reduce number of participants

---

## Support & Help

### Q: Where do I find documentation?
**A:** 
- README.md - Full docs
- QUICKSTART.md - Quick help
- DEPLOYMENT.md - Production guide
- FEATURES.md - Feature list
- PROJECT_SUMMARY.md - Overview

### Q: How do I report a bug?
**A:** Check browser console (F12), check server logs, verify setup is correct.

### Q: Can I fork and modify the code?
**A:** Yes! It's your code. Modify as needed.

### Q: How do I contribute improvements?
**A:** Fork the repo, make changes, test thoroughly, submit pull request.

### Q: Where can I get help?
**A:** 
1. Check documentation files
2. Check browser console for errors
3. Google the error message
4. Try Stack Overflow
5. Ask on GitHub issues

---

## Common Issues Summary

| Problem | Solution |
|---------|----------|
| Port 8080 in use | Kill process or change port |
| Camera won't work | Check browser permissions |
| Can't connect to peer | Verify same Meeting ID, reload |
| High CPU | Reduce participants, disable video |
| Server won't start | Check Java version, try clean build |
| No audio from other | Ensure audio is ON, check volume |
| Looks ugly on mobile | It's responsive, might need zoom out |
| Meeting disappeared | Normal! Meetings are temporary |

---

## Still Need Help?

1. **Check Documentation**: See README.md, QUICKSTART.md, DEPLOYMENT.md
2. **Check Browser Console**: F12 → Console tab for JavaScript errors
3. **Check Server Logs**: Look at terminal output where you ran mvn spring-boot:run
4. **Google It**: Search for the specific error message
5. **Try Different Browser**: Check if browser-specific issue
6. **Restart Everything**: Refresh browser, restart server, try again

---

**Hope this helps! Happy video calling! 📹🎉**

