package com.redbaron.nowyouseeme.websocket;

import com.google.gson.Gson;
import com.redbaron.nowyouseeme.model.SignalingMessage;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
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
        userMeetingMap.put(userId, meetingId);

        // Add user to meeting
        meetingUsers.computeIfAbsent(meetingId, k -> ConcurrentHashMap.newKeySet())
                    .add(userId);

        System.out.println("User " + userId + " joined meeting " + meetingId);
        System.out.println("Users in meeting: " + meetingUsers.get(meetingId));

        // Notify all participants in the meeting about the new user
        Set<String> participants = meetingUsers.get(meetingId);
        if (participants != null) {
            SignalingMessage joinNotif = new SignalingMessage();
            joinNotif.setType("user-joined");
            joinNotif.setFrom(userId);
            joinNotif.setMeetingId(meetingId);
            joinNotif.setData(userId);

            broadcastToMeeting(joinNotif);

            // Send existing participants list to the new user
            SignalingMessage existingUsers = new SignalingMessage();
            existingUsers.setType("existing-users");
            existingUsers.setData(gson.toJson(participants));
            existingUsers.setMeetingId(meetingId);

            WebSocketSession userSession = userSessions.get(userId);
            if (userSession != null && userSession.isOpen()) {
                userSession.sendMessage(new TextMessage(gson.toJson(existingUsers)));
            }
        }
    }

    private void forwardToUser(SignalingMessage msg) throws IOException {
        String recipientId = msg.getTo();
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

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        // Find the user ID associated with this session
        String userId = null;
        for (Map.Entry<String, WebSocketSession> entry : userSessions.entrySet()) {
            if (entry.getValue().getId().equals(session.getId())) {
                userId = entry.getKey();
                break;
            }
        }

        if (userId != null) {
            String meetingId = userMeetingMap.get(userId);

            // Remove user from meeting
            if (meetingId != null) {
                Set<String> participants = meetingUsers.get(meetingId);
                if (participants != null) {
                    participants.remove(userId);

                    // Notify remaining participants
                    SignalingMessage leaveNotif = new SignalingMessage();
                    leaveNotif.setType("user-left");
                    leaveNotif.setFrom(userId);
                    leaveNotif.setMeetingId(meetingId);
                    leaveNotif.setData(userId);

                    broadcastToMeeting(leaveNotif);

                    // Delete meeting if empty
                    if (participants.isEmpty()) {
                        meetingUsers.remove(meetingId);
                        System.out.println("Meeting " + meetingId + " deleted (empty)");
                    }
                }
            }

            // Remove user
            userSessions.remove(userId);
            userMeetingMap.remove(userId);
            System.out.println("User " + userId + " disconnected");
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        System.err.println("WebSocket transport error: " + exception.getMessage());
    }
}

