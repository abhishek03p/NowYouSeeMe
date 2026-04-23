# 🔧 UI Issue - Quick Troubleshooting

## ❌ You're Seeing Only Icons?

Here's what to do immediately:

### Step 1: Hard Refresh the Browser
```
Windows/Linux:  Ctrl + Shift + R
Mac:           Cmd + Shift + R
```

### Step 2: Clear Browser Cache
```
Windows/Linux:  Ctrl + Shift + Delete
Mac:           Cmd + Shift + Delete
```
Then click "Clear browsing data"

### Step 3: Check Browser Console
Press **F12** to open developer tools

Look for red errors like:
- ❌ `GET /static/js/webrtc-client.js 404` → Already fixed!
- ❌ `GET /js/webrtc-client.js 404` → JavaScript file missing
- ❌ `WebSocket failed` → Normal at startup

### Step 4: Restart Server
In your terminal:
```bash
# Stop current server
Ctrl + C

# Start fresh
mvn spring-boot:run
```

Wait for:
```
Started NowyouseemeApplication in X seconds
```

### Step 5: Open in Fresh Browser Tab
- Close current tab with the app
- Open new tab
- Go to: `http://localhost:8080`

---

## ✅ Expected Look After Fix

### Header Section
```
📹 Now You See Me                  Meeting ID: ABC123        [📋 Copy Link]
```

### Main Area
Left side: **Video Grid** (empty until someone joins)
Right side: **Chat Panel** (💬 Chat header, message area, input box)

### Bottom
Centered control buttons: **📹 🎤 📞**

---

## 🆘 If Still Broken

### Check #1: Is Server Running?
```bash
curl http://localhost:8080
```
Should return HTML (not an error)

### Check #2: Is JavaScript File There?
```bash
ls src/main/resources/static/js/webrtc-client.js
```
Should show the file exists

### Check #3: Check Browser Console
Press F12, go to Console tab

**Look for errors about:**
- Failed to load `/js/webrtc-client.js` → Restart server
- WebSocket errors → Normal, will work when another user joins
- Other JavaScript errors → Report them

### Check #4: Try Different Browser
- Try Chrome, Firefox, Safari, or Edge
- If one works, it's browser-specific
- Clear that browser's cache first

### Check #5: Try Incognito/Private Mode
```
Ctrl+Shift+N (Chrome/Edge)
Ctrl+Shift+P (Firefox)
Cmd+Shift+N (Safari)
```
This ignores cached files

---

## 🔧 Common Fixes

| Symptom | Fix |
|---------|-----|
| Only icons showing | Hard refresh + clear cache |
| Page is blank | Restart server |
| Can't connect to other user | Both need to allow camera/mic |
| Script not loading | Check console (F12), restart server |
| Page looks different | Clear browser cache |
| Mobile layout broken | Try on desktop first |

---

## 📞 If All Else Fails

1. **Kill the server**
   ```bash
   pkill -f NowyouseemeApplication
   # OR
   lsof -ti:8080 | xargs kill -9
   ```

2. **Clean rebuild**
   ```bash
   mvn clean package -DskipTests
   ```

3. **Start fresh**
   ```bash
   java -jar target/nowyouseeme-0.0.1-SNAPSHOT.jar
   ```

4. **Test**
   ```bash
   curl http://localhost:8080
   ```

---

## ✨ What Should Appear

```
╔════════════════════════════════════════════════════╗
║  📹 Now You See Me   ID: ABC123  [📋 Copy Link]   ║
╠════════════════════════════════════════════════════╣
║                                                    ║
║  ┌─────────────────────────────┬──────────────┐   ║
║  │                             │   💬 Chat    │   ║
║  │  Video Grid Area            │              │   ║
║  │  (empty at start)           │ Messages...  │   ║
║  │                             │              │   ║
║  │ Videos appear here when     │ [Input box]  │   ║
║  │ someone joins               │ [Send]       │   ║
║  │                             │              │   ║
║  └─────────────────────────────┴──────────────┘   ║
║                                                    ║
║              📹  🎤  📞  (Controls)               ║
║                                                    ║
╚════════════════════════════════════════════════════╝
```

---

## 🎯 Verification Checklist

- [ ] Page loads at http://localhost:8080
- [ ] See header with title and meeting ID
- [ ] See video grid area on left
- [ ] See chat panel on right
- [ ] See control buttons at bottom
- [ ] Browser console has no major errors
- [ ] Can grant camera/microphone permission

If all ✅ then you're good to go!

---

## 📚 Files to Check

All are in: `/home/abhishek/Documents/Git/NowYouSeeMe/nowyouseeme/`

- `src/main/resources/templates/index.html` - Main page
- `src/main/resources/static/js/webrtc-client.js` - JavaScript
- `src/main/resources/application.properties` - Configuration

---

**After fix, everything should work smoothly! 🚀**

