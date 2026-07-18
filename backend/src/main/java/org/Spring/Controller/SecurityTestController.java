package org.Spring.Controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class SecurityTestController {

    @GetMapping("/admin/dashboard")
    public String admin() { 
        return "Welcome, Admin! Access Granted."; 
    }

    @GetMapping("/client/data")
    public String client() { 
        return "Welcome, Client! Access Granted."; 
    }

    @GetMapping("/user/profile")
    public String user() { 
        return "Welcome, User! Access Granted."; 
    }
}