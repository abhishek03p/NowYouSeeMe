package com.redbaron.nowyouseeme.controller;

import com.redbaron.nowyouseeme.model.Meeting;
import com.redbaron.nowyouseeme.service.MeetingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/meetings")
@CrossOrigin(origins = "*")
public class MeetingController {

    @Autowired
    private MeetingService meetingService;

    @PostMapping("/create")
    public ResponseEntity<Map<String, String>> createMeeting() {
        String meetingId = meetingService.createMeeting();
        Map<String, String> response = new HashMap<>();
        response.put("meetingId", meetingId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{meetingId}")
    public ResponseEntity<Map<String, Object>> getMeeting(@PathVariable String meetingId) {
        Meeting meeting = meetingService.getMeeting(meetingId);
        if (meeting != null) {
            Map<String, Object> response = new HashMap<>();
            response.put("meetingId", meeting.getMeetingId());
            response.put("participantCount", meeting.getParticipantIds().size());
            response.put("hostId", meeting.getHostId());
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/{meetingId}/exists")
    public ResponseEntity<Map<String, Boolean>> checkMeetingExists(@PathVariable String meetingId) {
        boolean exists = meetingService.meetingExists(meetingId);
        Map<String, Boolean> response = new HashMap<>();
        response.put("exists", exists);
        return ResponseEntity.ok(response);
    }
}

