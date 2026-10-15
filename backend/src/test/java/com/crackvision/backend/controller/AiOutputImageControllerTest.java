package com.crackvision.backend.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class AiOutputImageControllerTest {

    private RestClient.Builder restClientBuilder;
    private MockRestServiceServer mockServer;
    private AiOutputImageController controller;

    @BeforeEach
    void setUp() {
        restClientBuilder = RestClient.builder().baseUrl("http://127.0.0.1:8000");
        mockServer = MockRestServiceServer.bindTo(restClientBuilder).build();
        controller = new AiOutputImageController(restClientBuilder.build());
    }

    @Test
    void testRejectsPathTraversalAndInvalidExtensions() {
        ResponseEntity<byte[]> response1 = controller.getHighlightedImage("../secret.png");
        assertEquals(400, response1.getStatusCode().value());

        ResponseEntity<byte[]> response2 = controller.getHighlightedImage("sub/file.png");
        assertEquals(400, response2.getStatusCode().value());

        ResponseEntity<byte[]> response3 = controller.getHighlightedImage("   ");
        assertEquals(400, response3.getStatusCode().value());

        ResponseEntity<byte[]> response4 = controller.getHighlightedImage("config.env");
        assertEquals(400, response4.getStatusCode().value());

        ResponseEntity<byte[]> response5 = controller.getHighlightedImage("script.sh");
        assertEquals(400, response5.getStatusCode().value());
    }

    @Test
    void testProxiesFromAiServiceWhenFileNotOnDisk() {
        String testFilename = "highlighted_test_remote_file_000.png";
        byte[] expectedBytes = new byte[]{1, 2, 3, 4, 5};

        mockServer.expect(requestTo("http://127.0.0.1:8000/outputs/" + testFilename))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(expectedBytes, MediaType.IMAGE_PNG));

        ResponseEntity<byte[]> response = controller.getHighlightedImage(testFilename);

        mockServer.verify();
        assertEquals(200, response.getStatusCode().value());
        assertEquals(MediaType.IMAGE_PNG, response.getHeaders().getContentType());
        assertArrayEquals(expectedBytes, response.getBody());
    }

    @Test
    void testReturns404WhenRemoteAndLocalNotFound() {
        String nonexistent = "highlighted_nonexistent_99999.png";

        mockServer.expect(requestTo("http://127.0.0.1:8000/outputs/" + nonexistent))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withResourceNotFound());

        ResponseEntity<byte[]> response = controller.getHighlightedImage(nonexistent);

        mockServer.verify();
        assertEquals(404, response.getStatusCode().value());
    }
}
