package com.redbaron.nowyouseeme.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class HomeController {

    @GetMapping("/")
    public String index() {
        return "landing";
    }

    @GetMapping("/meeting")
    public String meeting() {
        return "meeting";
    }
}

