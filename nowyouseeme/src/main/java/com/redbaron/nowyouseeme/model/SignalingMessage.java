package com.redbaron.nowyouseeme.model;

public class SignalingMessage {
    private String type; // "join", "offer", "answer", "ice-candidate", "chat", "user-joined", "user-left"
    private String from;
    private String to;
    private String meetingId;
    private String data; // JSON payload for WebRTC
    private String message; // For chat messages

    public SignalingMessage() {
    }

    public SignalingMessage(String type, String from, String meetingId) {
        this.type = type;
        this.from = from;
        this.meetingId = meetingId;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getFrom() {
        return from;
    }

    public void setFrom(String from) {
        this.from = from;
    }

    public String getTo() {
        return to;
    }

    public void setTo(String to) {
        this.to = to;
    }

    public String getMeetingId() {
        return meetingId;
    }

    public void setMeetingId(String meetingId) {
        this.meetingId = meetingId;
    }

    public String getData() {
        return data;
    }

    public void setData(String data) {
        this.data = data;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}

