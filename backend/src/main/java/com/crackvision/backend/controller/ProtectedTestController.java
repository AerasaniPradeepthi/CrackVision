package com.crackvision.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/protected")
public class ProtectedTestController {

    @GetMapping("/test")
    public String test() {
        return "Protected endpoint accessed successfully";
    }
}
