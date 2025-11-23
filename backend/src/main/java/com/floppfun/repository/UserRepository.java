package com.floppfun.repository;

import com.floppfun.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByWalletAddress(String walletAddress);

    boolean existsByWalletAddress(String walletAddress);

    Optional<User> findByUsername(String username);

    @Query("SELECT u FROM User u WHERE u.totalVolumeTraded > 0 ORDER BY u.totalVolumeTraded DESC")
    java.util.List<User> findTopTraders(org.springframework.data.domain.Pageable pageable);

    @Query("SELECT u FROM User u WHERE u.tokensCreated > 0 ORDER BY u.tokensCreated DESC")
    java.util.List<User> findTopCreators(org.springframework.data.domain.Pageable pageable);
}
