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

        this.iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ];

        this.peerConfig = { iceServers: this.iceServers };
        this.videoEnabled = true;
        this.audioEnabled = true;
        this.isInitialized = false;
    }

    generateUserId() {
        return 'user-' + Math.random().toString(36).substr(2, 9);
    }

    async initialize() {
        try {
            await this.getLocalStream();
            await this.getMeetingIdFromUrl();
            await this.connectWebSocket();
            this.joinMeeting();
            this.isInitialized = true;
            this.setupEventListeners();
        } catch (error) {
            console.error('Initialization error:', error);
            this.showNotification('Error: ' + error.message, 'error');
        }
    }

    setupEventListeners() {
        // Chat Enter key
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendChatMessage();
                }
            });
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
        if (meetingIdElement) meetingIdElement.textContent = this.meetingId;
    }

    connectWebSocket() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.signalingServerUrl);
                this.ws.onopen = () => resolve();
                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this.handleSignalingMessage(message);
                    } catch (e) { console.error('Signaling parse error', e); }
                };
                this.ws.onerror = (error) => reject(new Error('WebSocket connection failed'));
                this.ws.onclose = () => this.showNotification('Connection lost', 'error');
            } catch (error) { reject(error); }
        });
    }

    async getLocalStream() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: { echoCancellation: true, noiseSuppression: true }
            });
            this.displayVideo(this.userId, this.localStream, true);
        } catch (error) {
            console.error('Media access error', error);
            throw new Error('Unable to access camera/microphone');
        }
    }

    joinMeeting() {
        this.sendSignalingMessage({
            type: 'join',
            meetingId: this.meetingId,
            from: this.userId
        });
    }

    handleSignalingMessage(message) {
        if (message.from === this.userId && message.type !== 'existing-users') return;

        switch (message.type) {
            case 'existing-users': this.handleExistingUsers(message); break;
            case 'offer': this.handleOffer(message); break;
            case 'answer': this.handleAnswer(message); break;
            case 'ice-candidate': this.handleIceCandidate(message); break;
            case 'user-left': this.handleUserLeft(message); break;
            case 'chat':
                if (message.from !== this.userId) {
                    this.displayChatMessage(message.from, message.message);
                }
                break;
        }
    }

    handleExistingUsers(message) {
        const users = JSON.parse(message.data);
        users.forEach(userId => {
            if (userId !== this.userId && !this.peerConnections.has(userId)) {
                this.createPeerConnection(userId, true);
            }
        });
    }

    async createPeerConnection(remoteUserId, initiator) {
        const pc = new RTCPeerConnection(this.peerConfig);
        this.peerConnections.set(remoteUserId, pc);

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream));
        }

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignalingMessage({
                    type: 'ice-candidate', from: this.userId, to: remoteUserId,
                    meetingId: this.meetingId, data: JSON.stringify(event.candidate)
                });
            }
        };

        pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                this.displayVideo(remoteUserId, event.streams[0]);
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                this.handlePeerDisconnect(remoteUserId);
            }
        };

        if (initiator) {
            const dc = pc.createDataChannel('chat');
            this.setupDataChannel(remoteUserId, dc);
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                this.sendSignalingMessage({
                    type: 'offer', from: this.userId, to: remoteUserId,
                    meetingId: this.meetingId, data: JSON.stringify(offer)
                });
            } catch (e) { console.error(e); }
        } else {
            pc.ondatachannel = (event) => this.setupDataChannel(remoteUserId, event.channel);
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
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(message.data)));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            this.sendSignalingMessage({
                type: 'answer', from: this.userId, to: remoteUserId,
                meetingId: this.meetingId, data: JSON.stringify(answer)
            });
        } catch (e) { console.error(e); }
    }

    async handleAnswer(message) {
        const pc = this.peerConnections.get(message.from);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(message.data)));
    }

    async handleIceCandidate(message) {
        const pc = this.peerConnections.get(message.from);
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(message.data)));
    }

    setupDataChannel(remoteUserId, dc) {
        this.dataChannels.set(remoteUserId, dc);
        dc.onmessage = (e) => this.displayChatMessage(remoteUserId, e.data);
        dc.onclose = () => this.dataChannels.delete(remoteUserId);
    }

    sendChatMessage(text) {
        if (!text.trim()) return;
        this.displayChatMessage('You', text);

        let sentCount = 0;
        this.dataChannels.forEach(dc => {
            if (dc.readyState === 'open') {
                dc.send(text);
                sentCount++;
            }
        });

        if (sentCount < this.peerConnections.size) {
            this.sendSignalingMessage({
                type: 'chat', from: this.userId,
                meetingId: this.meetingId, message: text
            });
        }
    }

    displayVideo(userId, stream, isLocal = false) {
        let container = document.getElementById('video-' + userId);
        if (!container) {
            container = document.createElement('div');
            container.id = 'video-' + userId;
            container.className = 'video-container';
            const video = document.createElement('video');
            video.autoplay = true;
            video.playsinline = true;
            if (isLocal) video.muted = true;
            const label = document.createElement('div');
            label.className = 'video-label';
            label.textContent = isLocal ? 'You' : 'User-' + userId.substr(5, 4);
            container.appendChild(video);
            container.appendChild(label);
            document.getElementById('videoGrid').appendChild(container);
        }
        const video = container.querySelector('video');
        if (video.srcObject !== stream) video.srcObject = stream;
    }

    displayChatMessage(senderId, message) {
        const chatMessages = document.getElementById('chatMessages');
        const bubble = document.createElement('div');
        const isSent = senderId === 'You';
        bubble.className = `message-bubble ${isSent ? 'sent' : 'received'}`;

        const senderName = isSent ? 'You' : 'User-' + senderId.substr(5, 4);
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const info = document.createElement('div');
        info.className = 'message-info';
        info.textContent = `${senderName} • ${time}`;
        bubble.appendChild(info);

        if (message.startsWith('GIF:')) {
            const gifUrl = message.substring(4);
            const img = document.createElement('img');
            img.src = gifUrl;
            img.className = 'gif-message';
            bubble.appendChild(img);
        } else {
            const textSpan = document.createElement('span');
            textSpan.textContent = message;
            bubble.appendChild(textSpan);
        }

        chatMessages.appendChild(bubble);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    toggleVideo() {
        if (this.localStream) {
            this.videoEnabled = !this.videoEnabled;
            this.localStream.getVideoTracks().forEach(t => t.enabled = this.videoEnabled);
            const btn = document.getElementById('videoBtn');
            btn.classList.toggle('off', !this.videoEnabled);
            btn.innerHTML = this.videoEnabled ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
        }
    }

    toggleAudio() {
        if (this.localStream) {
            this.audioEnabled = !this.audioEnabled;
            this.localStream.getAudioTracks().forEach(t => t.enabled = this.audioEnabled);
            const btn = document.getElementById('audioBtn');
            btn.classList.toggle('off', !this.audioEnabled);
            btn.innerHTML = this.audioEnabled ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
        }
    }

    handleUserLeft(message) {
        const userId = message.from;
        this.closePeerConnection(userId);
        const el = document.getElementById('video-' + userId);
        if (el) el.remove();
    }

    closePeerConnection(userId) {
        const pc = this.peerConnections.get(userId);
        if (pc) pc.close();
        this.peerConnections.delete(userId);
        this.dataChannels.delete(userId);
    }

    handlePeerDisconnect(userId) {
        this.closePeerConnection(userId);
        const el = document.getElementById('video-' + userId);
        if (el) el.remove();
    }

    endCall() {
        this.peerConnections.forEach((pc, id) => this.closePeerConnection(id));
        if (this.localStream) this.localStream.getTracks().forEach(t => t.stop());
        if (this.ws) this.ws.close();
        window.location.href = '/';
    }

    showNotification(message, type = 'info') {
        const n = document.createElement('div');
        n.className = `notification ${type}`;
        n.textContent = message;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 3000);
    }

    sendSignalingMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }
}

let client;
document.addEventListener('DOMContentLoaded', () => {
    client = new WebRTCClient();
    client.initialize();
    window.client = client;

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        const key = e.key.toLowerCase();
        if (key === 'v') client.toggleVideo();
        if (key === 'a') client.toggleAudio();
        if (key === 'q') if (confirm('Leave meeting?')) client.endCall();
    });
});

function toggleVideo() { if (client) client.toggleVideo(); }
function toggleAudio() { if (client) client.toggleAudio(); }
function endCall() { if (confirm('Leave meeting?')) client.endCall(); }
function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (msg) {
        client.sendChatMessage(msg);
        input.value = '';
    }
}
function copyMeetingId() {
    const id = document.getElementById('meetingId').textContent;
    const url = window.location.origin + '/meeting?meetingId=' + id;
    navigator.clipboard.writeText(url).then(() => {
        const btn = document.querySelector('.copy-btn i');
        btn.className = 'fas fa-check';
        setTimeout(() => btn.className = 'far fa-copy', 2000);
    });
}
