package com.floppfun.repository;

import com.floppfun.model.entity.UserHolding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserHoldingRepository extends JpaRepository<UserHolding, Long> {

    Optional<UserHolding> findByUserIdAndTokenId(Long userId, Long tokenId);

    List<UserHolding> findByUserIdAndAmountGreaterThan(Long userId, Long amount);

    List<UserHolding> findByTokenIdAndAmountGreaterThan(Long tokenId, Long amount);

    @Query("SELECT COUNT(DISTINCT h.user.id) FROM UserHolding h WHERE h.token.id = :tokenId AND h.amount > 0")
    Long countHoldersByTokenId(@Param("tokenId") Long tokenId);

    @Query("SELECT h FROM UserHolding h WHERE h.user.id = :userId AND h.amount > 0 ORDER BY h.updatedAt DESC")
    List<UserHolding> findActiveHoldingsByUserId(@Param("userId") Long userId);
}
