package com.floppfun.repository;

import com.floppfun.entity.TokenHolder;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TokenHolderRepository extends JpaRepository<TokenHolder, Long> {

    /**
     * Get top holders for a token ordered by balance
     */
    @Query("SELECT th FROM TokenHolder th WHERE th.token.id = :tokenId " +
           "ORDER BY th.balance DESC")
    List<TokenHolder> findTopHolders(@Param("tokenId") Long tokenId, Pageable pageable);

    /**
     * Get total number of holders for a token
     */
    @Query("SELECT COUNT(th) FROM TokenHolder th WHERE th.token.id = :tokenId " +
           "AND th.balance > 0")
    Long countHolders(@Param("tokenId") Long tokenId);

    /**
     * Find holder by token and wallet address
     */
    Optional<TokenHolder> findByTokenIdAndWalletAddress(Long tokenId, String walletAddress);

    /**
     * Get all tokens held by a wallet
     */
    @Query("SELECT th FROM TokenHolder th WHERE th.walletAddress = :walletAddress " +
           "AND th.balance > 0 ORDER BY th.lastUpdatedAt DESC")
    List<TokenHolder> findByWalletAddress(@Param("walletAddress") String walletAddress);
}
