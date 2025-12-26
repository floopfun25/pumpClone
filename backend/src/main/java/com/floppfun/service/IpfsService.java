package com.floppfun.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * IPFS Service - Handles metadata and image uploads to Pinata
 */
@Slf4j
@Service
public class IpfsService {

    @Value("${floppfun.ipfs.pinata-api-key}")
    private String pinataApiKey;

    @Value("${floppfun.ipfs.pinata-secret-key}")
    private String pinataSecretKey;

    @Value("${floppfun.ipfs.gateway-url}")
    private String gatewayUrl;

    private static final String PINATA_PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
    private static final String PINATA_PIN_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

    private final OkHttpClient httpClient = new OkHttpClient();
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Upload image to IPFS via Pinata
     *
     * NOTE: Currently using MOCK MODE for testing without real Pinata credentials.
     * To enable real IPFS uploads, add valid Pinata API keys to .env file.
     */
    public String uploadImage(MultipartFile image) throws IOException {
        log.info("Uploading image to IPFS: {}", image.getOriginalFilename());

        // Check if we're in mock mode (invalid API keys)
        if (pinataApiKey == null || pinataApiKey.contains("your_pinata_api_key")) {
            log.warn("⚠️  MOCK MODE: Using fake IPFS hash - no real upload happening. Add real Pinata API keys to enable actual IPFS uploads.");
            String mockHash = "Qm" + generateMockHash();
            String imageUrl = gatewayUrl + mockHash;
            log.info("Mock image URL generated: {}", imageUrl);
            return imageUrl;
        }

        // Real Pinata upload
        RequestBody requestBody = new MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("file", image.getOriginalFilename(),
                        RequestBody.create(image.getBytes(), MediaType.parse(image.getContentType())))
                .build();

        Request request = new Request.Builder()
                .url(PINATA_PIN_FILE_URL)
                .addHeader("pinata_api_key", pinataApiKey)
                .addHeader("pinata_secret_api_key", pinataSecretKey)
                .post(requestBody)
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                throw new IOException("Failed to upload image to IPFS: " + response.body().string());
            }

            String responseBody = response.body().string();
            Map<String, Object> result = objectMapper.readValue(responseBody, Map.class);
            String ipfsHash = (String) result.get("IpfsHash");

            String imageUrl = gatewayUrl + ipfsHash;
            log.info("Image uploaded successfully: {}", imageUrl);
            return imageUrl;
        }
    }

    /**
     * Upload metadata JSON to IPFS
     *
     * NOTE: Currently using MOCK MODE for testing without real Pinata credentials.
     * To enable real IPFS uploads, add valid Pinata API keys to .env file.
     */
    public String uploadMetadata(String name, String symbol, String description, String imageUrl) throws IOException {
        log.info("Uploading metadata to IPFS for token: {}", symbol);

        // Check if we're in mock mode (invalid API keys)
        if (pinataApiKey == null || pinataApiKey.contains("your_pinata_api_key")) {
            log.warn("⚠️  MOCK MODE: Using fake metadata hash - no real upload happening. Add real Pinata API keys to enable actual IPFS uploads.");
            String mockHash = "Qm" + generateMockHash();
            String metadataUri = gatewayUrl + mockHash;
            log.info("Mock metadata URI generated: {}", metadataUri);
            return metadataUri;
        }

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("name", name);
        metadata.put("symbol", symbol);
        metadata.put("description", description);
        metadata.put("image", imageUrl);

        // SPL Token Metadata Standard
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("creators", new Object[0]);
        metadata.put("attributes", attributes);
        metadata.put("properties", Map.of(
                "category", "image",
                "files", new Object[]{
                        Map.of(
                                "uri", imageUrl,
                                "type", "image/png"
                        )
                }
        ));

        String json = objectMapper.writeValueAsString(metadata);

        RequestBody requestBody = RequestBody.create(
                json,
                MediaType.parse("application/json")
        );

        Request request = new Request.Builder()
                .url(PINATA_PIN_JSON_URL)
                .addHeader("pinata_api_key", pinataApiKey)
                .addHeader("pinata_secret_api_key", pinataSecretKey)
                .addHeader("Content-Type", "application/json")
                .post(requestBody)
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                throw new IOException("Failed to upload metadata to IPFS: " + response.body().string());
            }

            String responseBody = response.body().string();
            Map<String, Object> result = objectMapper.readValue(responseBody, Map.class);
            String ipfsHash = (String) result.get("IpfsHash");

            String metadataUri = gatewayUrl + ipfsHash;
            log.info("Metadata uploaded successfully: {}", metadataUri);
            return metadataUri;
        }
    }

    /**
     * Generate a mock IPFS hash for testing
     */
    private String generateMockHash() {
        return Long.toHexString(System.currentTimeMillis()) +
               Integer.toHexString((int)(Math.random() * 100000));
    }

    /**
     * Full upload process: image + metadata
     */
    public Map<String, String> uploadTokenAssets(MultipartFile image, String name, String symbol, String description) throws IOException {
        // Upload image first
        String imageUrl = uploadImage(image);

        // Then upload metadata with image URL
        String metadataUri = uploadMetadata(name, symbol, description, imageUrl);

        Map<String, String> result = new HashMap<>();
        result.put("imageUrl", imageUrl);
        result.put("metadataUri", metadataUri);

        return result;
    }
}
