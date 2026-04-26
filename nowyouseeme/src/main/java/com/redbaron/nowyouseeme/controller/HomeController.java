package com.redbaron.nowyouseeme.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.ui.Model;

@Controller
public class HomeController {

    @Value("${emoji.api.access-key:}")
    private String emojiApiAccessKey;

    @Value("${tenor.api.key:LIVDSRZULELA}")
    private String tenorApiKey;

    @Value("${tenor.api.client-key:nowyouseeme-web}")
    private String tenorApiClientKey;

    @GetMapping("/")
    public String index() {
        return "landing";
    }

    @GetMapping("/meeting")
    public String meeting(Model model) {
        model.addAttribute("emojiApiAccessKey", emojiApiAccessKey);
        model.addAttribute("tenorApiKey", tenorApiKey);
        model.addAttribute("tenorApiClientKey", tenorApiClientKey);
        return "meeting";
    }
}

