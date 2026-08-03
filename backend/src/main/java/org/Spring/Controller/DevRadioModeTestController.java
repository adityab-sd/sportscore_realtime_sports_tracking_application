package org.Spring.Controller;

import org.Spring.producer.EventHubProducer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Files;

// DEV/TEST ONLY — delete this class (or gate behind a profile) before shipping.
@RestController
public class DevRadioModeTestController {

    @Autowired
    private EventHubProducer eventHubProducer;

    @PostMapping("/dev/test-radio-mode")
    public String triggerMockRadioEvent() throws Exception {
        ClassPathResource resource = new ClassPathResource("mock-radio-payload-2.json");
        String json = Files.readString(resource.getFile().toPath());

        eventHubProducer.send(json);

        return "Published mock radio-mode payload.";
    }
}