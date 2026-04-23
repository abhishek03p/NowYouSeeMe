package com.redbaron.nowyouseeme.model;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public class Meeting {
    private String meetingId;
    private String hostId;
    private Set<String> participantIds;
    private LocalDateTime createdAt;

    public Meeting(String meetingId, String hostId) {
        this.meetingId = meetingId;
        this.hostId = hostId;
        this.participantIds = ConcurrentHashMap.newKeySet();
        this.createdAt = LocalDateTime.now();
    }

    public String getMeetingId() {
        return meetingId;
    }

    public void setMeetingId(String meetingId) {
        this.meetingId = meetingId;
    }

    public String getHostId() {
        return hostId;
    }

    public void setHostId(String hostId) {
        this.hostId = hostId;
    }

    public Set<String> getParticipantIds() {
        return participantIds;
    }

    public void setParticipantIds(Set<String> participantIds) {
        this.participantIds = participantIds;
    }

    public void addParticipant(String userId) {
        this.participantIds.add(userId);
    }

    public void removeParticipant(String userId) {
        this.participantIds.remove(userId);
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}

