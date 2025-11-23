package com.floppfun.service;

import com.floppfun.model.dto.UserDTO;
import com.floppfun.model.entity.User;
import com.floppfun.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    /**
     * Get or create user by wallet address
     */
    @Transactional
    public User getOrCreateUser(String walletAddress) {
        return userRepository.findByWalletAddress(walletAddress)
                .orElseGet(() -> createUser(walletAddress));
    }

    /**
     * Create a new user
     */
    @Transactional
    public User createUser(String walletAddress) {
        log.info("Creating new user with wallet: {}", walletAddress);

        User user = User.builder()
                .walletAddress(walletAddress)
                .build();

        return userRepository.save(user);
    }

    /**
     * Get user by wallet address
     */
    public Optional<User> getUserByWallet(String walletAddress) {
        return userRepository.findByWalletAddress(walletAddress);
    }

    /**
     * Get user by ID
     */
    public Optional<User> getUserById(Long id) {
        return userRepository.findById(id);
    }

    /**
     * Update user profile
     */
    @Transactional
    public User updateProfile(String walletAddress, String username, String bio,
                             String avatarUrl, String twitterHandle, String telegramHandle) {
        User user = getOrCreateUser(walletAddress);

        if (username != null) user.setUsername(username);
        if (bio != null) user.setBio(bio);
        if (avatarUrl != null) user.setAvatarUrl(avatarUrl);
        if (twitterHandle != null) user.setTwitterHandle(twitterHandle);
        if (telegramHandle != null) user.setTelegramHandle(telegramHandle);

        return userRepository.save(user);
    }

    /**
     * Convert entity to DTO
     */
    public UserDTO toDTO(User user) {
        return UserDTO.builder()
                .id(user.getId())
                .walletAddress(user.getWalletAddress())
                .username(user.getUsername())
                .avatarUrl(user.getAvatarUrl())
                .bio(user.getBio())
                .twitterHandle(user.getTwitterHandle())
                .telegramHandle(user.getTelegramHandle())
                .isVerified(user.getIsVerified())
                .totalVolumeTraded(user.getTotalVolumeTraded())
                .tokensCreated(user.getTokensCreated())
                .reputationScore(user.getReputationScore())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
