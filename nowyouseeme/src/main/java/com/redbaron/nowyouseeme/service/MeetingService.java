package com.redbaron.nowyouseeme.service;

import com.redbaron.nowyouseeme.model.Meeting;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class MeetingService {

    private final Map<String, Meeting> meetings = new ConcurrentHashMap<>();

    public String createMeeting() {
        String meetingId = generateMeetingId();
        String hostId = generateUserId();
        Meeting meeting = new Meeting(meetingId, hostId);
        meetings.put(meetingId, meeting);
        return meetingId;
    }

    public Meeting getMeeting(String meetingId) {
        return meetings.get(meetingId);
    }

    public boolean meetingExists(String meetingId) {
        return meetings.containsKey(meetingId);
    }

    public void addParticipant(String meetingId, String userId) {
        Meeting meeting = meetings.get(meetingId);
        if (meeting != null) {
            meeting.addParticipant(userId);
        }
    }

    public void removeParticipant(String meetingId, String userId) {
        Meeting meeting = meetings.get(meetingId);
        if (meeting != null) {
            meeting.removeParticipant(userId);
            // Delete meeting if no participants
            if (meeting.getParticipantIds().isEmpty()) {
                meetings.remove(meetingId);
            }
        }
    }

    private String generateMeetingId() {
        return UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    private String generateUserId() {
        return UUID.randomUUID().toString();
    }
}

