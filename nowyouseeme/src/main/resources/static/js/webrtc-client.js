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
        this.signalingServerUrl = 'ws://' + window.location.host + '/ws/signaling';

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
            // Get or create meeting ID
            await this.getMeetingIdFromUrl();

            // Connect to signaling server
            await this.connectWebSocket();

            // Get local media stream
            await this.getLocalStream();

            // Join the meeting
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
            // Create new meeting
            const response = await fetch('/api/meetings/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            this.meetingId = data.meetingId;

            // Update URL
            window.history.replaceState({}, '', `/?meetingId=${this.meetingId}`);
        }

        // Update UI safely
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
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Display local video
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
        console.log('Received signaling message:', message.type);

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
                this.displayChatMessage(message.from, message.message);
                break;
        }
    }

    handleUserJoined(message) {
        const newUserId = message.from;

        if (newUserId !== this.userId && !this.peerConnections.has(newUserId)) {
            console.log('New user joined:', newUserId);
            this.createPeerConnection(newUserId, true);
            this.showNotification('User joined', 'info');
        }
    }

    handleExistingUsers(message) {
        const users = JSON.parse(message.data);
        console.log('Existing users:', users);

        for (let userId of users) {
            if (userId !== this.userId && !this.peerConnections.has(userId)) {
                this.createPeerConnection(userId, true);
            }
        }
    }

    async createPeerConnection(remoteUserId, initiator) {
        console.log('Creating peer connection with:', remoteUserId, 'Initiator:', initiator);

        const peerConnection = new RTCPeerConnection(this.peerConfig);
        this.peerConnections.set(remoteUserId, peerConnection);

        // Add local stream tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });
        }

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
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

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', peerConnection.connectionState);
            if (peerConnection.connectionState === 'failed' ||
                peerConnection.connectionState === 'disconnected') {
                this.handlePeerDisconnect(remoteUserId);
            }
        };

         // Handle remote stream
         peerConnection.ontrack = (event) => {
             console.log('Received remote track:', event.track.kind, 'Streams:', event.streams.length);
             if (event.streams && event.streams.length > 0) {
                 this.displayVideo(remoteUserId, event.streams[0]);
             } else {
                 console.warn('No streams in track event');
             }
         };

        // Create data channel for chat
        if (initiator) {
            this.createDataChannel(remoteUserId, peerConnection);
        } else {
            peerConnection.ondatachannel = (event) => {
                this.setupDataChannel(remoteUserId, event.channel);
            };
        }

        // Create and send offer if initiator
        if (initiator) {
            try {
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);

                this.sendSignalingMessage({
                    type: 'offer',
                    from: this.userId,
                    to: remoteUserId,
                    meetingId: this.meetingId,
                    data: JSON.stringify(offer)
                });
            } catch (error) {
                console.error('Error creating offer:', error);
            }
        }
    }

    async handleOffer(message) {
        const remoteUserId = message.from;
        let peerConnection = this.peerConnections.get(remoteUserId);

        if (!peerConnection) {
            await this.createPeerConnection(remoteUserId, false);
            peerConnection = this.peerConnections.get(remoteUserId);
        }

        try {
            const offer = JSON.parse(message.data);
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            this.sendSignalingMessage({
                type: 'answer',
                from: this.userId,
                to: remoteUserId,
                meetingId: this.meetingId,
                data: JSON.stringify(answer)
            });
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    }

    async handleAnswer(message) {
        const peerConnection = this.peerConnections.get(message.from);
        if (peerConnection) {
            try {
                const answer = JSON.parse(message.data);
                await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (error) {
                console.error('Error handling answer:', error);
            }
        }
    }

    async handleIceCandidate(message) {
        const peerConnection = this.peerConnections.get(message.from);
        if (peerConnection) {
            try {
                const candidate = JSON.parse(message.data);
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        }
    }

    handleUserLeft(message) {
        const userId = message.from;
        this.closePeerConnection(userId);
        this.removeVideoElement(userId);
        this.showNotification('User left', 'info');
    }

    createDataChannel(remoteUserId, peerConnection) {
        const dataChannel = peerConnection.createDataChannel('chat', {
            ordered: true
        });
        this.setupDataChannel(remoteUserId, dataChannel);
    }

    setupDataChannel(remoteUserId, dataChannel) {
        dataChannel.onopen = () => {
            console.log('Data channel opened with', remoteUserId);
        };

        dataChannel.onmessage = (event) => {
            this.displayChatMessage(remoteUserId, event.data);
        };

        dataChannel.onclose = () => {
            console.log('Data channel closed with', remoteUserId);
        };

        dataChannel.onerror = (error) => {
            console.error('Data channel error:', error);
        };

        this.dataChannels.set(remoteUserId, dataChannel);
    }

    sendChatMessage(text) {
        if (!text.trim()) return;

        // Display locally
        this.displayChatMessage('You', text);

        // Send to all peers
        let sentToSomeone = false;
        this.dataChannels.forEach((dataChannel, userId) => {
            if (dataChannel.readyState === 'open') {
                dataChannel.send(text);
                sentToSomeone = true;
            }
        });

        // Also send via signaling if no data channels available
        if (!sentToSomeone) {
            this.peerConnections.forEach((pc, userId) => {
                this.sendSignalingMessage({
                    type: 'chat',
                    from: this.userId,
                    to: userId,
                    meetingId: this.meetingId,
                    message: text
                });
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

            const indicator = document.createElement('div');
            indicator.className = 'status-indicator';

            videoContainer.appendChild(video);
            videoContainer.appendChild(label);
            videoContainer.appendChild(indicator);

            document.getElementById('videoGrid').appendChild(videoContainer);
        }

        const video = videoContainer.querySelector('video');
        if (video.srcObject !== stream) {
            video.srcObject = stream;
        }
    }

    removeVideoElement(userId) {
        const element = document.getElementById('video-' + userId);
        if (element) {
            element.remove();
        }
    }

    displayChatMessage(userName, message) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        messageDiv.innerHTML = `<strong>${userName}:</strong> ${this.escapeHtml(message)}`;
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
            this.localStream.getVideoTracks().forEach(track => {
                track.enabled = this.videoEnabled;
            });

            const btn = document.getElementById('videoBtn');
            btn.classList.toggle('off', !this.videoEnabled);
            this.showNotification('Video ' + (this.videoEnabled ? 'ON' : 'OFF'), 'info');
        }
    }

    toggleAudio() {
        if (this.localStream) {
            this.audioEnabled = !this.audioEnabled;
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = this.audioEnabled;
            });

            const btn = document.getElementById('audioBtn');
            btn.classList.toggle('off', !this.audioEnabled);
            this.showNotification('Audio ' + (this.audioEnabled ? 'ON' : 'OFF'), 'info');
        }
    }

    closePeerConnection(userId) {
        const peerConnection = this.peerConnections.get(userId);
        if (peerConnection) {
            peerConnection.close();
            this.peerConnections.delete(userId);
        }

        const dataChannel = this.dataChannels.get(userId);
        if (dataChannel) {
            dataChannel.close();
            this.dataChannels.delete(userId);
        }
    }

    handlePeerDisconnect(userId) {
        console.log('Peer disconnected:', userId);
        this.closePeerConnection(userId);
        this.removeVideoElement(userId);
    }

    endCall() {
        // Close all peer connections
        this.peerConnections.forEach((pc, userId) => {
            this.closePeerConnection(userId);
            this.removeVideoElement(userId);
        });

        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }

        // Close WebSocket
        if (this.ws) {
            this.ws.close();
        }

        this.showNotification('Call ended', 'info');
        setTimeout(() => {
            window.location.href = '/';
        }, 1000);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.background = type === 'error' ? 'rgba(244, 67, 54, 0.9)' : 'rgba(0, 0, 0, 0.8)';

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Global instance
let client;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    client = new WebRTCClient();
    client.initialize();

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'v' || e.key === 'V') toggleVideo();
        if (e.key === 'a' || e.key === 'A') toggleAudio();
        if (e.key === 'q' || e.key === 'Q') endCall();
        if (e.key === 'Enter' && document.activeElement.id === 'chatInput') {
            sendChatMessage();
        }
    });
});

// Global functions for buttons
function toggleVideo() {
    if (client) client.toggleVideo();
}

function toggleAudio() {
    if (client) client.toggleAudio();
}

function endCall() {
    if (client && confirm('Are you sure you want to end the call?')) {
        client.endCall();
    }
}

function copyMeetingId() {
    const meetingId = document.getElementById('meetingId').textContent;
    const shareLink = window.location.origin + '/?meetingId=' + meetingId;

    navigator.clipboard.writeText(shareLink).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = '✓ Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = 'Copy Link';
            btn.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Share link: ' + shareLink);
    });
}

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    if (message && client) {
        client.sendChatMessage(message);
        input.value = '';
        input.focus();
    }
}

