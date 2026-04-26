/**
 * WebRTC Video Calling Client
 * Handles peer connections, signaling, and user interface
 */

class WebRTCClient {
    constructor() {
        this.localStream = null;
        this.peerConnections = new Map();
        this.dataChannels = new Map();
        this.ws = null;
        this.meetingId = null;
        this.userId = this.generateUserId();
        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        this.signalingServerUrl = protocol + "://" + window.location.host + "/ws/signaling";

        // STUN servers for NAT traversal
        this.iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
        ];

        this.peerConfig = {
            iceServers: this.iceServers
        };

        this.videoEnabled = true;
        this.audioEnabled = true;
        this.isInitialized = false;
    }

    generateUserId() {
        return 'user-' + Math.random().toString(36).substr(2, 9);
    }

    async initialize() {
        try {
            // 1. Get local media stream first to ensure tracks are ready
            await this.getLocalStream();

            // 2. Get or create meeting ID
            await this.getMeetingIdFromUrl();

            // 3. Connect to signaling server
            await this.connectWebSocket();

            // 4. Join the meeting
            this.joinMeeting();

            this.isInitialized = true;
        } catch (error) {
            console.error('Initialization error:', error);
            this.showNotification('Error: ' + error.message, 'error');
        }
    }

    async getMeetingIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        this.meetingId = params.get('meetingId');

        if (!this.meetingId) {
            const response = await fetch('/api/meetings/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            this.meetingId = data.meetingId;
            window.history.replaceState({}, '', `/meeting?meetingId=${this.meetingId}`);
        }

        const meetingIdElement = document.getElementById('meetingId');
        if (meetingIdElement) {
            meetingIdElement.textContent = this.meetingId;
        }
    }

    connectWebSocket() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.signalingServerUrl);
                this.ws.onopen = () => {
                    console.log('Connected to signaling server');
                    resolve();
                };
                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this.handleSignalingMessage(message);
                    } catch (e) {
                        console.error('Error parsing signaling message:', e);
                    }
                };
                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    reject(new Error('WebSocket connection failed'));
                };
                this.ws.onclose = () => {
                    console.log('Disconnected from signaling server');
                    this.showNotification('Connection lost', 'error');
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    async getLocalStream() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            });
            this.displayVideo(this.userId, this.localStream, true);
            console.log('Local stream obtained');
        } catch (error) {
            console.error('Error getting local stream:', error);
            throw new Error('Unable to access camera/microphone: ' + error.message);
        }
    }

    joinMeeting() {
        const message = {
            type: 'join',
            meetingId: this.meetingId,
            from: this.userId
        };
        this.sendSignalingMessage(message);
    }

    handleSignalingMessage(message) {
        // Don't process messages from ourselves (except broadcasted chat if needed, but we handle that locally)
        if (message.from === this.userId && message.type !== 'existing-users') return;

        console.log('Received signaling message:', message.type, 'from:', message.from);

        switch (message.type) {
            case 'user-joined':
                this.handleUserJoined(message);
                break;
            case 'existing-users':
                this.handleExistingUsers(message);
                break;
            case 'offer':
                this.handleOffer(message);
                break;
            case 'answer':
                this.handleAnswer(message);
                break;
            case 'ice-candidate':
                this.handleIceCandidate(message);
                break;
            case 'user-left':
                this.handleUserLeft(message);
                break;
            case 'chat':
                if (message.from !== this.userId) {
                    this.displayChatMessage(message.from, message.message);
                }
                break;
        }
    }

    handleUserJoined(message) {
        const newUserId = message.from;
        if (!this.peerConnections.has(newUserId)) {
            console.log('New user joined:', newUserId);
            // The person who just joined will receive 'existing-users' and initiate.
            // But to be safe, if we are already here, we can also initiate or wait for their offer.
            // Let's have the NEW joiner initiate connections to everyone.
        }
    }

    handleExistingUsers(message) {
        const users = JSON.parse(message.data);
        console.log('Existing users in meeting:', users);

        for (let userId of users) {
            if (userId !== this.userId && !this.peerConnections.has(userId)) {
                // We (the new user) initiate connections to existing users
                this.createPeerConnection(userId, true);
            }
        }
    }

    async createPeerConnection(remoteUserId, initiator) {
        console.log('Creating PC for:', remoteUserId, 'initiator:', initiator);
        const pc = new RTCPeerConnection(this.peerConfig);
        this.peerConnections.set(remoteUserId, pc);

        // Add tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream);
            });
        }

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignalingMessage({
                    type: 'ice-candidate',
                    from: this.userId,
                    to: remoteUserId,
                    meetingId: this.meetingId,
                    data: JSON.stringify(event.candidate)
                });
            }
        };

        pc.ontrack = (event) => {
            console.log('Track received from:', remoteUserId);
            if (event.streams && event.streams[0]) {
                this.displayVideo(remoteUserId, event.streams[0]);
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`PC state with ${remoteUserId}: ${pc.connectionState}`);
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                this.handlePeerDisconnect(remoteUserId);
            }
        };

        // Data channel for chat
        if (initiator) {
            const dc = pc.createDataChannel('chat');
            this.setupDataChannel(remoteUserId, dc);
        } else {
            pc.ondatachannel = (event) => {
                this.setupDataChannel(remoteUserId, event.channel);
            };
        }

        if (initiator) {
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                this.sendSignalingMessage({
                    type: 'offer',
                    from: this.userId,
                    to: remoteUserId,
                    meetingId: this.meetingId,
                    data: JSON.stringify(offer)
                });
            } catch (e) {
                console.error('Offer error:', e);
            }
        }
    }

    async handleOffer(message) {
        const remoteUserId = message.from;
        let pc = this.peerConnections.get(remoteUserId);
        if (!pc) {
            await this.createPeerConnection(remoteUserId, false);
            pc = this.peerConnections.get(remoteUserId);
        }

        try {
            const offer = JSON.parse(message.data);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            this.sendSignalingMessage({
                type: 'answer',
                from: this.userId,
                to: remoteUserId,
                meetingId: this.meetingId,
                data: JSON.stringify(answer)
            });
        } catch (e) {
            console.error('Answer error:', e);
        }
    }

    async handleAnswer(message) {
        const pc = this.peerConnections.get(message.from);
        if (pc) {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(message.data)));
            } catch (e) {
                console.error('Set remote description error:', e);
            }
        }
    }

    async handleIceCandidate(message) {
        const pc = this.peerConnections.get(message.from);
        if (pc) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(message.data)));
            } catch (e) {
                console.error('Add ICE candidate error:', e);
            }
        }
    }

    setupDataChannel(remoteUserId, dc) {
        this.dataChannels.set(remoteUserId, dc);
        dc.onmessage = (e) => this.displayChatMessage(remoteUserId, e.data);
        dc.onopen = () => console.log('DC opened with:', remoteUserId);
        dc.onclose = () => this.dataChannels.delete(remoteUserId);
    }

    sendChatMessage(text) {
        if (!text.trim()) return;
        this.displayChatMessage('You', text);

        // Try sending via DataChannels first
        let sentCount = 0;
        this.dataChannels.forEach((dc) => {
            if (dc.readyState === 'open') {
                dc.send(text);
                sentCount++;
            }
        });

        // Fallback to signaling server if any DCs are not open
        if (sentCount < this.peerConnections.size) {
            this.sendSignalingMessage({
                type: 'chat',
                from: this.userId,
                meetingId: this.meetingId,
                message: text
            });
        }
    }

    displayVideo(userId, stream, isLocal = false) {
        let videoContainer = document.getElementById('video-' + userId);
        if (!videoContainer) {
            videoContainer = document.createElement('div');
            videoContainer.id = 'video-' + userId;
            videoContainer.className = 'video-container';
            const video = document.createElement('video');
            video.autoplay = true;
            video.playsinline = true;
            if (isLocal) video.muted = true;
            const label = document.createElement('div');
            label.className = 'video-label';
            label.textContent = isLocal ? 'You' : 'User-' + userId.substr(5, 4);
            videoContainer.appendChild(video);
            videoContainer.appendChild(label);
            document.getElementById('videoGrid').appendChild(videoContainer);
        }
        const video = videoContainer.querySelector('video');
        if (video.srcObject !== stream) {
            video.srcObject = stream;
        }
    }

    removeVideoElement(userId) {
        const el = document.getElementById('video-' + userId);
        if (el) el.remove();
    }

    displayChatMessage(userName, message) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        // Clean up user name for display
        const displayName = userName === 'You' ? 'You' : 'User-' + userName.substr(5, 4);
        messageDiv.innerHTML = `<strong>${displayName}:</strong> ${this.escapeHtml(message)}`;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    sendSignalingMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    toggleVideo() {
        if (this.localStream) {
            this.videoEnabled = !this.videoEnabled;
            this.localStream.getVideoTracks().forEach(t => t.enabled = this.videoEnabled);
            document.getElementById('videoBtn').classList.toggle('off', !this.videoEnabled);
        }
    }

    toggleAudio() {
        if (this.localStream) {
            this.audioEnabled = !this.audioEnabled;
            this.localStream.getAudioTracks().forEach(t => t.enabled = this.audioEnabled);
            document.getElementById('audioBtn').classList.toggle('off', !this.audioEnabled);
        }
    }

    handleUserLeft(message) {
        const userId = message.from;
        this.closePeerConnection(userId);
        this.removeVideoElement(userId);
    }

    closePeerConnection(userId) {
        const pc = this.peerConnections.get(userId);
        if (pc) {
            pc.close();
            this.peerConnections.delete(userId);
        }
        this.dataChannels.delete(userId);
    }

    handlePeerDisconnect(userId) {
        this.closePeerConnection(userId);
        this.removeVideoElement(userId);
    }

    endCall() {
        this.peerConnections.forEach((pc, id) => this.closePeerConnection(id));
        if (this.localStream) this.localStream.getTracks().forEach(t => t.stop());
        if (this.ws) this.ws.close();
        window.location.href = '/';
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.background = type === 'error' ? 'rgba(244, 67, 54, 0.9)' : 'rgba(0, 0, 0, 0.8)';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

let client;
document.addEventListener('DOMContentLoaded', () => {
    client = new WebRTCClient();
    client.initialize();
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        if (e.key.toLowerCase() === 'v') toggleVideo();
        if (e.key.toLowerCase() === 'a') toggleAudio();
        if (e.key.toLowerCase() === 'q') endCall();
    });
});

function toggleVideo() { if (client) client.toggleVideo(); }
function toggleAudio() { if (client) client.toggleAudio(); }
function endCall() { if (client && confirm('End call?')) client.endCall(); }
function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (msg && client) {
        client.sendChatMessage(msg);
        input.value = '';
    }
}
function copyMeetingId() {
    const meetingId = document.getElementById('meetingId').textContent;
    const shareLink = window.location.origin + '/meeting?meetingId=' + meetingId;
    navigator.clipboard.writeText(shareLink).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = '✓ Copied!';
        setTimeout(() => btn.textContent = 'Copy Link', 2000);
    });
}
