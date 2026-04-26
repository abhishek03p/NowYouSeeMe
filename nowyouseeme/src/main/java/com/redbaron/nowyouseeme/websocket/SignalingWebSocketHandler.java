package com.redbaron.nowyouseeme.websocket;

import com.google.gson.Gson;
import com.redbaron.nowyouseeme.model.SignalingMessage;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SignalingWebSocketHandler extends TextWebSocketHandler {

    private static final Gson gson = new Gson();

    // Map of user ID to WebSocket session
    private static final Map<String, WebSocketSession> userSessions = new ConcurrentHashMap<>();

    // Map of meeting ID to set of user IDs in that meeting
    private static final Map<String, Set<String>> meetingUsers = new ConcurrentHashMap<>();

    // Map to track which user is in which meeting
    private static final Map<String, String> userMeetingMap = new ConcurrentHashMap<>();

    // Map of meeting ID to host user ID
    private static final Map<String, String> meetingHosts = new ConcurrentHashMap<>();

    // Map of meeting ID to pending user IDs waiting in lobby
    private static final Map<String, Set<String>> pendingUsers = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        System.out.println("WebSocket connection established: " + session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        try {
            SignalingMessage msg = gson.fromJson(message.getPayload(), SignalingMessage.class);

            switch (msg.getType()) {
                case "join":
                    handleJoin(session, msg);
                    break;
                case "offer":
                case "answer":
                case "ice-candidate":
                    forwardToUser(msg);
                    break;
                case "chat":
                    broadcastToMeeting(msg);
                    break;
                case "admit-user":
                case "reject-user":
                    handleLobbyDecision(msg);
                    break;
            }
        } catch (Exception e) {
            System.err.println("Error handling WebSocket message: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void handleJoin(WebSocketSession session, SignalingMessage msg) throws IOException {
        String meetingId = msg.getMeetingId();
        String userId = msg.getFrom();

        // Store the session
        userSessions.put(userId, session);
        String hostUserId = meetingHosts.get(meetingId);

        // First participant becomes host and is auto-approved.
        if (hostUserId == null) {
            meetingHosts.put(meetingId, userId);
            addApprovedUserToMeeting(meetingId, userId);
            sendJoinApproved(userId, meetingId, true);
            sendExistingUsersTo(userId, meetingId);
            System.out.println("Host " + userId + " started meeting " + meetingId);
            return;
        }

        // Existing meeting: user waits in lobby until host approves.
        pendingUsers.computeIfAbsent(meetingId, k -> ConcurrentHashMap.newKeySet()).add(userId);
        sendLobbyWaiting(userId, meetingId);
        sendJoinRequestToHost(hostUserId, userId, meetingId);
        System.out.println("User " + userId + " waiting in lobby for meeting " + meetingId);
    }

    private void handleLobbyDecision(SignalingMessage msg) throws IOException {
        String meetingId = msg.getMeetingId();
        String hostId = msg.getFrom();
        String pendingUserId = msg.getTo();

        if (meetingId == null || hostId == null || pendingUserId == null) {
            return;
        }

        String actualHostId = meetingHosts.get(meetingId);
        if (!hostId.equals(actualHostId)) {
            return;
        }

        Set<String> waitingUsers = pendingUsers.get(meetingId);
        if (waitingUsers == null || !waitingUsers.remove(pendingUserId)) {
            return;
        }

        if ("admit-user".equals(msg.getType())) {
            addApprovedUserToMeeting(meetingId, pendingUserId);
            sendJoinApproved(pendingUserId, meetingId, false);
            sendExistingUsersTo(pendingUserId, meetingId);

            SignalingMessage joinNotif = new SignalingMessage();
            joinNotif.setType("user-joined");
            joinNotif.setFrom(pendingUserId);
            joinNotif.setMeetingId(meetingId);
            broadcastToMeetingExcept(joinNotif, pendingUserId);
        } else {
            sendJoinRejected(pendingUserId, meetingId);
        }
    }

    private void addApprovedUserToMeeting(String meetingId, String userId) {
        userMeetingMap.put(userId, meetingId);
        meetingUsers.computeIfAbsent(meetingId, k -> ConcurrentHashMap.newKeySet()).add(userId);
    }

    private void sendJoinApproved(String userId, String meetingId, boolean isHost) throws IOException {
        SignalingMessage approved = new SignalingMessage();
        approved.setType("join-approved");
        approved.setMeetingId(meetingId);
        approved.setFrom("server");
        approved.setData(gson.toJson(Map.of("isHost", isHost)));
        sendToUser(userId, approved);
    }

    private void sendLobbyWaiting(String userId, String meetingId) throws IOException {
        SignalingMessage waiting = new SignalingMessage();
        waiting.setType("lobby-waiting");
        waiting.setMeetingId(meetingId);
        waiting.setFrom("server");
        sendToUser(userId, waiting);
    }

    private void sendJoinRequestToHost(String hostUserId, String requesterId, String meetingId) throws IOException {
        SignalingMessage joinRequest = new SignalingMessage();
        joinRequest.setType("join-request");
        joinRequest.setMeetingId(meetingId);
        joinRequest.setFrom(requesterId);
        sendToUser(hostUserId, joinRequest);
    }

    private void sendJoinRejected(String userId, String meetingId) throws IOException {
        SignalingMessage rejected = new SignalingMessage();
        rejected.setType("join-rejected");
        rejected.setMeetingId(meetingId);
        rejected.setFrom("server");
        sendToUser(userId, rejected);
    }

    private void sendExistingUsersTo(String targetUserId, String meetingId) throws IOException {
        Set<String> participants = meetingUsers.get(meetingId);
        Set<String> others = new HashSet<>();
        if (participants != null) {
            others.addAll(participants);
            others.remove(targetUserId);
        }

        SignalingMessage existingUsers = new SignalingMessage();
        existingUsers.setType("existing-users");
        existingUsers.setData(gson.toJson(others));
        existingUsers.setMeetingId(meetingId);
        existingUsers.setFrom("server");
        sendToUser(targetUserId, existingUsers);
    }

    private void sendToUser(String userId, SignalingMessage msg) throws IOException {
        WebSocketSession targetSession = userSessions.get(userId);
        if (targetSession != null && targetSession.isOpen()) {
            targetSession.sendMessage(new TextMessage(gson.toJson(msg)));
        }
    }

    private void forwardToUser(SignalingMessage msg) throws IOException {
        String recipientId = msg.getTo();
        if (recipientId == null) return;
        
        WebSocketSession recipientSession = userSessions.get(recipientId);
        if (recipientSession != null && recipientSession.isOpen()) {
            recipientSession.sendMessage(new TextMessage(gson.toJson(msg)));
        }
    }

    private void broadcastToMeeting(SignalingMessage msg) throws IOException {
        String meetingId = msg.getMeetingId();
        Set<String> participants = meetingUsers.get(meetingId);

        if (participants != null) {
            String messageJson = gson.toJson(msg);
            for (String userId : participants) {
                WebSocketSession session = userSessions.get(userId);
                if (session != null && session.isOpen()) {
                    session.sendMessage(new TextMessage(messageJson));
                }
            }
        }
    }

    private void broadcastToMeetingExcept(SignalingMessage msg, String excludeUserId) throws IOException {
        String meetingId = msg.getMeetingId();
        Set<String> participants = meetingUsers.get(meetingId);

        if (participants != null) {
            String messageJson = gson.toJson(msg);
            for (String userId : participants) {
                if (!userId.equals(excludeUserId)) {
                    WebSocketSession session = userSessions.get(userId);
                    if (session != null && session.isOpen()) {
                        session.sendMessage(new TextMessage(messageJson));
                    }
                }
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String userId = null;
        for (Map.Entry<String, WebSocketSession> entry : userSessions.entrySet()) {
            if (entry.getValue().getId().equals(session.getId())) {
                userId = entry.getKey();
                break;
            }
        }

        if (userId != null) {
            final String disconnectedUserId = userId;
            // Remove from pending lobby state if user disconnects before approval.
            pendingUsers.forEach((meetingId, users) -> {
                users.remove(disconnectedUserId);
                if (users.isEmpty()) {
                    pendingUsers.remove(meetingId);
                }
            });

            String meetingId = userMeetingMap.get(userId);
            if (meetingId != null) {
                Set<String> participants = meetingUsers.get(meetingId);
                if (participants != null) {
                    participants.remove(userId);
                    SignalingMessage leaveNotif = new SignalingMessage();
                    leaveNotif.setType("user-left");
                    leaveNotif.setFrom(userId);
                    leaveNotif.setMeetingId(meetingId);
                    broadcastToMeeting(leaveNotif);

                    if (participants.isEmpty()) {
                        meetingUsers.remove(meetingId);
                        meetingHosts.remove(meetingId);
                    }
                }

                String currentHost = meetingHosts.get(meetingId);
                if (userId.equals(currentHost)) {
                    Set<String> remainingParticipants = meetingUsers.get(meetingId);
                    if (remainingParticipants != null && !remainingParticipants.isEmpty()) {
                        String newHostId = remainingParticipants.iterator().next();
                        meetingHosts.put(meetingId, newHostId);
                    }
                }
            }
            userSessions.remove(userId);
            userMeetingMap.remove(userId);
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        System.err.println("WebSocket transport error: " + exception.getMessage());
    }
}
