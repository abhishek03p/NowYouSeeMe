/**
 * WebRTC Video Calling Client
 * Handles peer connections, signaling, and user interface
 */

class WebRTCClient {
    constructor() {
        this.localStream = null;
        this.peerConnections = new Map();
        this.dataChannels = new Map(); // Map for general data channels (chat)
        this.fileDataChannels = new Map(); // Map specifically for file transfer
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

        // File transfer related properties
        this.fileMetadata = new Map(); // Stores metadata for incoming files
        this.fileBuffers = new Map(); // Stores chunks for incoming files
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
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const msg = chatInput.value.trim();
                    if (msg) {
                        this.sendChatMessage(msg);
                        chatInput.value = '';
                    }
                }
            });
        }

        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.sendFile(file);
                }
                fileInput.value = ''; // Clear the input
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
                this.ws.onopen = () => {
                    console.log('WebSocket: Connected to signaling server.');
                    resolve();
                };
                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this.handleSignalingMessage(message);
                    } catch (e) { console.error('WebSocket: Signaling parse error', e); }
                };
                this.ws.onerror = (error) => {
                    console.error('WebSocket: Error', error);
                    reject(new Error('WebSocket connection failed'));
                };
                this.ws.onclose = () => {
                    console.log('WebSocket: Disconnected from signaling server.');
                    this.showNotification('Connection lost', 'error');
                };
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
            console.log('Local Stream: Obtained local media stream.');
        } catch (error) {
            console.error('Local Stream: Media access error', error);
            throw new Error('Unable to access camera/microphone');
        }
    }

    joinMeeting() {
        this.sendSignalingMessage({
            type: 'join',
            meetingId: this.meetingId,
            from: this.userId
        });
        console.log(`Meeting: User ${this.userId} attempting to join meeting ${this.meetingId}.`);
    }

    handleSignalingMessage(message) {
        // Only process messages from others, or specific server messages like 'existing-users'
        if (message.from === this.userId && message.type !== 'existing-users' && message.type !== 'user-joined') {
            console.log(`Signaling: Ignoring message of type ${message.type} from self.`);
            return;
        }

        console.log(`Signaling: Received message type: ${message.type} from: ${message.from}`);

        switch (message.type) {
            case 'existing-users': this.handleExistingUsers(message); break;
            case 'user-joined':
                if (message.from !== this.userId && !this.peerConnections.has(message.from)) {
                    console.log(`Signaling: New user ${message.from} joined. Creating peer connection.`);
                    this.createPeerConnection(message.from, false); // New user will receive offer
                }
                this.showNotification(`User ${this.displayName(message.from)} joined.`, 'info');
                break;
            case 'offer': this.handleOffer(message); break;
            case 'answer': this.handleAnswer(message); break;
            case 'ice-candidate': this.handleIceCandidate(message); break;
            case 'user-left': this.handleUserLeft(message); break;
            case 'chat':
                if (message.from !== this.userId) {
                    this.displayChatMessage(message.from, message.message);
                }
                break;
            case 'file-metadata':
                if (message.from !== this.userId) {
                    this.handleIncomingFileMetadata(message.from, JSON.parse(message.message));
                }
                break;
            case 'file-end':
                if (message.from !== this.userId) {
                    this.handleIncomingFileEnd(message.from, JSON.parse(message.message));
                }
                break;
            default:
                console.warn(`Signaling: Unknown message type received: ${message.type}`);
        }
    }

    handleExistingUsers(message) {
        const users = JSON.parse(message.data);
        console.log(`Signaling: Existing users in meeting: ${users.join(', ')}`);
        users.forEach(userId => {
            if (userId !== this.userId && !this.peerConnections.has(userId)) {
                console.log(`Signaling: Initiating peer connection with existing user ${userId}.`);
                this.createPeerConnection(userId, true); // We initiate connection to existing users
            }
        });
    }

    async createPeerConnection(remoteUserId, initiator) {
        console.log(`PC: Creating RTCPeerConnection for ${remoteUserId}, initiator: ${initiator}`);
        const pc = new RTCPeerConnection(this.peerConfig);
        pc.iceCandidateQueue = [];
        this.peerConnections.set(remoteUserId, pc);

        // Add local stream tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream);
                console.log(`PC: Added local track (${track.kind}) to PC for ${remoteUserId}.`);
            });
        }

        // ICE Candidate handling
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignalingMessage({
                    type: 'ice-candidate', from: this.userId, to: remoteUserId,
                    meetingId: this.meetingId, data: JSON.stringify(event.candidate)
                });
                console.log(`PC: Sent ICE candidate to ${remoteUserId}.`);
            } else {
                console.log(`PC: ICE gathering complete for ${remoteUserId}.`);
            }
        };

        // Track handling
        pc.ontrack = (event) => {
            console.log(`PC: Received remote track (${event.track.kind}) from ${remoteUserId}.`);
            if (event.streams && event.streams[0]) {
                this.displayVideo(remoteUserId, event.streams[0]);
            }
        };

        // Connection state changes
        pc.onconnectionstatechange = () => {
            console.log(`PC: Connection state with ${remoteUserId}: ${pc.connectionState}`);
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                this.handlePeerDisconnect(remoteUserId);
            } else if (pc.connectionState === 'connected') {
                console.log(`PC: Successfully connected to ${remoteUserId}!`);
            }
        };

        // ICE Connection state changes (more granular)
        pc.oniceconnectionstatechange = () => {
            console.log(`PC: ICE connection state with ${remoteUserId}: ${pc.iceConnectionState}`);
        };

        // Signaling state changes
        pc.onsignalingstatechange = () => {
            console.log(`PC: Signaling state with ${remoteUserId}: ${pc.signalingState}`);
        };

        // Negotiation needed (only for initiator)
        pc.onnegotiationneeded = async () => {
            if (initiator) {
                console.log(`PC: Negotiation needed for ${remoteUserId}. Creating offer.`);
                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    this.sendSignalingMessage({
                        type: 'offer', from: this.userId, to: remoteUserId,
                        meetingId: this.meetingId, data: JSON.stringify(offer)
                    });
                    console.log(`PC: Sent offer to ${remoteUserId}.`);
                } catch (e) {
                    console.error(`PC: Error creating or sending offer to ${remoteUserId}:`, e);
                }
            }
        };

        // Data channel logic
        if (initiator) {
            const chatDc = pc.createDataChannel('chat');
            this.setupDataChannel(remoteUserId, chatDc, 'chat');

            const fileDc = pc.createDataChannel('file');
            this.setupDataChannel(remoteUserId, fileDc, 'file');
        } else {
            // Handle incoming data channels (for non-initiator)
            pc.ondatachannel = (event) => {
                if (event.channel.label === 'chat') {
                    console.log(`PC: Received chat DataChannel from ${remoteUserId}.`);
                    this.setupDataChannel(remoteUserId, event.channel, 'chat');
                } else if (event.channel.label === 'file') {
                    console.log(`PC: Received file DataChannel from ${remoteUserId}.`);
                    this.setupDataChannel(remoteUserId, event.channel, 'file');
                }
            };
        }
    }

    async handleOffer(message) {
        const remoteUserId = message.from;
        let pc = this.peerConnections.get(remoteUserId);
        if (!pc) {
            console.log(`PC: Received offer from ${remoteUserId} but no PC exists. Creating new PC.`);
            await this.createPeerConnection(remoteUserId, false);
            pc = this.peerConnections.get(remoteUserId);
        }
        try {
            const offer = JSON.parse(message.data);
            console.log(`PC: Setting remote description (offer) from ${remoteUserId}.`);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            this.processIceQueue(pc);
            console.log(`PC: Creating answer for ${remoteUserId}.`);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            this.sendSignalingMessage({
                type: 'answer', from: this.userId, to: remoteUserId,
                meetingId: this.meetingId, data: JSON.stringify(answer)
            });
            console.log(`PC: Sent answer to ${remoteUserId}.`);
        } catch (e) { console.error(`PC: Error handling offer from ${remoteUserId}:`, e); }
    }

    async handleAnswer(message) {
        const pc = this.peerConnections.get(message.from);
        if (pc) {
            try {
                console.log(`PC: Setting remote description (answer) from ${message.from}.`);
                await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(message.data)));
                this.processIceQueue(pc);
            } catch (e) { console.error(`PC: Error handling answer from ${message.from}:`, e); }
        } else {
            console.warn(`PC: Received answer from ${message.from} but no peer connection found.`);
        }
    }

    async handleIceCandidate(message) {
        const pc = this.peerConnections.get(message.from);
        if (pc) {
            try {
                const candidate = new RTCIceCandidate(JSON.parse(message.data));
                if (pc.remoteDescription && pc.remoteDescription.type) {
                    console.log(`PC: Adding ICE candidate from ${message.from}.`);
                    await pc.addIceCandidate(candidate);
                } else {
                    console.log(`PC: Queuing ICE candidate from ${message.from} until remoteDescription is set.`);
                    if (!pc.iceCandidateQueue) pc.iceCandidateQueue = [];
                    pc.iceCandidateQueue.push(candidate);
                }
            } catch (e) { console.error(`PC: Error handling ICE candidate from ${message.from}:`, e); }
        } else {
            console.warn(`PC: Received ICE candidate from ${message.from} but no peer connection found.`);
        }
    }

    async processIceQueue(pc) {
        if (pc.iceCandidateQueue && pc.iceCandidateQueue.length > 0) {
            console.log(`PC: Processing ${pc.iceCandidateQueue.length} queued ICE candidates.`);
            for (const candidate of pc.iceCandidateQueue) {
                try {
                    await pc.addIceCandidate(candidate);
                } catch (e) {
                    console.error(`PC: Error adding queued ICE candidate:`, e);
                }
            }
            pc.iceCandidateQueue = [];
        }
    }

    setupDataChannel(remoteUserId, dc, type) {
        if (type === 'chat') {
            this.dataChannels.set(remoteUserId, dc);
            dc.onmessage = (e) => this.displayChatMessage(remoteUserId, e.data);
            dc.onopen = () => console.log(`DataChannel (Chat): Opened with ${remoteUserId}.`);
            dc.onclose = () => {
                console.log(`DataChannel (Chat): Closed with ${remoteUserId}.`);
                this.dataChannels.delete(remoteUserId);
            };
            dc.onerror = (error) => console.error(`DataChannel (Chat): Error with ${remoteUserId}:`, error);
            console.log(`DataChannel (Chat): Setup for ${remoteUserId}.`);
        } else if (type === 'file') {
            this.fileDataChannels.set(remoteUserId, dc);
            dc.binaryType = 'arraybuffer'; // Important for file transfer
            dc.onmessage = (e) => this.handleFileChunk(remoteUserId, e.data);
            dc.onopen = () => console.log(`DataChannel (File): Opened with ${remoteUserId}.`);
            dc.onclose = () => {
                console.log(`DataChannel (File): Closed with ${remoteUserId}.`);
                this.fileDataChannels.delete(remoteUserId);
            };
            dc.onerror = (error) => console.error(`DataChannel (File): Error with ${remoteUserId}:`, error);
            console.log(`DataChannel (File): Setup for ${remoteUserId}.`);
        }
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

        if (sentCount > 0) {
            console.log(`Chat: Sent message via ${sentCount} DataChannels.`);
        } else if (this.peerConnections.size > 0) {
            console.warn(`Chat: Message could not be sent. No open DataChannels.`);
        } else {
            console.warn(`Chat: Message not sent. No peer connections.`);
        }
    }

    async sendFile(file) {
        const CHUNK_SIZE = 16 * 1024; // 16KB chunks
        const fileId = `${this.userId}-${Date.now()}-${file.name}`; // Unique ID for this file transfer
        const metadata = {
            fileId: fileId,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            senderId: this.userId,
            timestamp: Date.now()
        };

        // Send metadata via signaling server to all peers
        this.sendSignalingMessage({
            type: 'file-metadata',
            from: this.userId,
            meetingId: this.meetingId,
            message: JSON.stringify(metadata)
        });

        this.showNotification(`Sending file "${file.name}"...`, 'info');
        this.displayFileSending(metadata);
        console.log(`File Transfer: Initiating send for file "${file.name}" (${file.size} bytes).`);

        let offset = 0;
        const reader = new FileReader();
        reader.onload = (e) => {
            const chunk = e.target.result; // ArrayBuffer
            this.fileDataChannels.forEach(dc => {
                if (dc.readyState === 'open') {
                    dc.send(chunk);
                }
            });
            offset += chunk.byteLength;
            // Update progress bar here if you have one
            // const progress = (offset / file.size) * 100;
            // console.log(`File Transfer: Sent ${progress.toFixed(2)}% of "${file.name}".`);

            if (offset < file.size) {
                readNextChunk();
            } else {
                this.sendSignalingMessage({
                    type: 'file-end',
                    from: this.userId,
                    meetingId: this.meetingId,
                    message: JSON.stringify({ fileId: fileId, fileName: file.name, senderId: this.userId })
                });
                this.showNotification(`File "${file.name}" sent.`, 'success');
                console.log(`File Transfer: Completed sending file "${file.name}".`);
            }
        };

        const readNextChunk = () => {
            const slice = file.slice(offset, offset + CHUNK_SIZE);
            reader.readAsArrayBuffer(slice);
        };

        readNextChunk();
    }

    handleIncomingFileMetadata(senderId, metadata) {
        console.log(`File Transfer: Received metadata for file "${metadata.fileName}" from ${senderId}.`);
        // Store metadata for this incoming file
        this.fileMetadata.set(metadata.fileId, {
            ...metadata,
            receivedSize: 0,
            buffer: []
        });
        this.fileBuffers.set(metadata.fileId, []); // Initialize buffer for this file
        this.displayFileReceiving(metadata);
        this.showNotification(`Receiving file "${metadata.fileName}" from ${this.displayName(senderId)}.`, 'info');
    }

    handleFileChunk(senderId, chunk) {
        // Find which file this chunk belongs to.
        // This assumes that fileId is unique and metadata is received before chunks.
        // A more robust solution would embed fileId in each chunk or use separate DataChannels per file.
        // For simplicity, we'll iterate through pending files for this sender.
        let targetMetadata = null;
        for (const [fileId, metadata] of this.fileMetadata.entries()) {
            if (metadata.senderId === senderId && !metadata.completed) {
                targetMetadata = metadata;
                break;
            }
        }

        if (targetMetadata) {
            targetMetadata.buffer.push(chunk);
            targetMetadata.receivedSize += chunk.byteLength;
            // Update progress bar if implemented
            // const progress = (targetMetadata.receivedSize / targetMetadata.fileSize) * 100;
            // console.log(`File Transfer: Received ${progress.toFixed(2)}% of "${targetMetadata.fileName}".`);
        } else {
            console.warn(`File Transfer: Received file chunk from ${senderId} but no matching metadata found.`);
        }
    }

    handleIncomingFileEnd(senderId, endMessage) {
        const fileId = endMessage.fileId;
        const metadata = this.fileMetadata.get(fileId);

        if (metadata) {
            console.log(`File Transfer: Received end signal for file "${metadata.fileName}" from ${senderId}.`);
            const blob = new Blob(metadata.buffer, { type: metadata.fileType });
            this.displayFileReceived(senderId, blob, metadata);
            metadata.completed = true; // Mark as completed
            this.fileMetadata.delete(fileId); // Clean up
            this.fileBuffers.delete(fileId); // Clean up
        } else {
            console.error(`File Transfer: Received file-end for unknown fileId: ${fileId}`);
        }
    }

    displayFileSending(metadata) {
        const chatMessages = document.getElementById('chatMessages');
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble sent';
        const senderName = 'You';
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        bubble.innerHTML = `
            <div class="message-info">${senderName} • ${time}</div>
            <div class="file-message-content">
                <i class="fas fa-file"></i> Sending: <strong>${metadata.fileName}</strong> (${(metadata.fileSize / (1024 * 1024)).toFixed(2)} MB)
                <div class="file-progress-bar" id="progress-${metadata.fileId}"></div>
            </div>
        `;
        chatMessages.appendChild(bubble);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    displayFileReceiving(metadata) {
        const chatMessages = document.getElementById('chatMessages');
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble received';
        const senderName = this.displayName(metadata.senderId);
        const time = new Date(metadata.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        bubble.innerHTML = `
            <div class="message-info">${senderName} • ${time}</div>
            <div class="file-message-content">
                <i class="fas fa-file-download"></i> Receiving: <strong>${metadata.fileName}</strong> (${(metadata.fileSize / (1024 * 1024)).toFixed(2)} MB)
                <div class="file-progress-bar" id="progress-${metadata.fileId}"></div>
            </div>
        `;
        chatMessages.appendChild(bubble);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    displayFileReceived(senderId, blob, metadata) {
        const chatMessages = document.getElementById('chatMessages');
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble received';
        const senderName = this.displayName(senderId);
        const time = new Date(metadata.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let fileContentHtml = `
            <div class="file-message-content">
                <div>Received: <strong>${metadata.fileName}</strong> (${(metadata.fileSize / (1024 * 1024)).toFixed(2)} MB)</div>
        `;

        if (metadata.fileType.startsWith('image/')) {
            const imgUrl = URL.createObjectURL(blob);
            fileContentHtml += `<img src="${imgUrl}" class="received-image" alt="${metadata.fileName}">`;
        }
        const fileUrl = URL.createObjectURL(blob);
        fileContentHtml += `<a href="${fileUrl}" download="${metadata.fileName}" class="download-link"><i class="fas fa-download"></i> Download</a>
            </div>`;

        bubble.innerHTML = `
            <div class="message-info">${senderName} • ${time}</div>
            ${fileContentHtml}
        `;
        chatMessages.appendChild(bubble);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        this.showNotification(`File "${metadata.fileName}" received from ${senderName}.`, 'success');
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
            label.textContent = isLocal ? 'You' : this.displayName(userId);
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

        const senderName = isSent ? 'You' : this.displayName(senderId);
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const info = document.createElement('div');
        info.className = 'message-info';
        info.textContent = `${senderName} • ${time}`;
        bubble.appendChild(info);

        const textSpan = document.createElement('span');
        textSpan.textContent = message;
        bubble.appendChild(textSpan);

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
            console.log(`Controls: Video toggled ${this.videoEnabled ? 'ON' : 'OFF'}.`);
        }
    }

    toggleAudio() {
        if (this.localStream) {
            this.audioEnabled = !this.audioEnabled;
            this.localStream.getAudioTracks().forEach(t => t.enabled = this.audioEnabled);
            const btn = document.getElementById('audioBtn');
            btn.classList.toggle('off', !this.audioEnabled);
            btn.innerHTML = this.audioEnabled ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
            console.log(`Controls: Audio toggled ${this.audioEnabled ? 'ON' : 'OFF'}.`);
        }
    }

    handleUserLeft(message) {
        const userId = message.from;
        this.closePeerConnection(userId);
        const el = document.getElementById('video-' + userId);
        if (el) el.remove();
        this.showNotification(`User ${this.displayName(userId)} left.`, 'info');
        console.log(`Meeting: User ${userId} left.`);
    }

    closePeerConnection(userId) {
        const pc = this.peerConnections.get(userId);
        if (pc) {
            pc.close();
            this.peerConnections.delete(userId);
            console.log(`PC: Closed peer connection with ${userId}.`);
        }
        if (this.dataChannels.has(userId)) {
            this.dataChannels.delete(userId);
            console.log(`DataChannel (Chat): Deleted for ${userId}.`);
        }
        if (this.fileDataChannels.has(userId)) {
            this.fileDataChannels.delete(userId);
            console.log(`DataChannel (File): Deleted for ${userId}.`);
        }
    }

    handlePeerDisconnect(userId) {
        console.log(`PC: Peer ${userId} disconnected.`);
        this.closePeerConnection(userId);
        const el = document.getElementById('video-' + userId);
        if (el) el.remove();
        this.showNotification(`User ${this.displayName(userId)} disconnected.`, 'error');
    }

    endCall() {
        console.log('Meeting: Ending call.');
        this.peerConnections.forEach((pc, id) => this.closePeerConnection(id));
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            console.log('Local Stream: Stopped local media tracks.');
        }
        if (this.ws) {
            this.ws.close();
            console.log('WebSocket: Closed connection.');
        }
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
            console.log(`Signaling: Sent message type: ${message.type} to: ${message.to || 'all'}.`);
        } else {
            console.warn(`Signaling: Failed to send message (WebSocket not open): ${message.type}.`);
        }
    }

    displayName(userId) {
        return 'User-' + userId.substr(5, 4);
    }
}

let client;
document.addEventListener('DOMContentLoaded', () => {
    client = new WebRTCClient();
    client.initialize();
    window.client = client; // Make client globally accessible for HTML event handlers

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return; // Don't trigger shortcuts if typing in an input field
        const key = e.key.toLowerCase();
        if (key === 'v') client.toggleVideo();
        if (key === 'a') client.toggleAudio();
        if (key === 'q') if (confirm('Leave meeting?')) client.endCall();
    });
});

// Global functions for HTML event handlers
window.toggleVideo = function() { if (client) client.toggleVideo(); };
window.toggleAudio = function() { if (client) client.toggleAudio(); };
window.endCall = function() { if (client && confirm('Leave meeting?')) client.endCall(); };
window.sendChatMessage = function() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (msg) {
        client.sendChatMessage(msg);
        input.value = '';
    }
};
window.copyMeetingId = function() {
    const id = document.getElementById('meetingId').textContent;
    const url = window.location.origin + '/meeting?meetingId=' + id;
    navigator.clipboard.writeText(url).then(() => {
        const btn = document.querySelector('.copy-btn i');
        btn.className = 'fas fa-check'; // Change icon to checkmark
        setTimeout(() => btn.className = 'far fa-copy', 2000); // Revert icon after 2 seconds
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Share link: ' + url); // Fallback for browsers that don't support clipboard API
    });
};

window.triggerFileInput = function() {
    document.getElementById('fileInput').click();
};

window.togglePanel = function(panelId) {
    const panels = ['emojiPanel']; // Only emoji panel now
    panels.forEach(p => {
        const el = document.getElementById(p);
        if (p === panelId) {
            const shouldShow = el.style.display !== 'block';
            el.style.display = shouldShow ? 'block' : 'none';
            if (p === 'emojiPanel' && shouldShow) {
                renderEmojiGrid(emojis); // Render static emojis
            }
        } else {
            el.style.display = 'none';
        }
    });
};

// Static Emojis
const emojis = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','🤨','🧐','🤓'];
const emojiGrid = document.getElementById('emojiGrid');

function renderEmojiGrid(emojisToRender) {
    emojiGrid.innerHTML = '';
    emojisToRender.forEach(emoji => {
        const span = document.createElement('span');
        span.className = 'emoji-item';
        span.textContent = emoji;
        span.onclick = () => {
            const input = document.getElementById('chatInput');
            input.value += emoji;
            input.focus();
            togglePanel('emojiPanel'); // Close panel after selecting emoji
        };
        emojiGrid.appendChild(span);
    });
}
