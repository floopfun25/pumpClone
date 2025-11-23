package com.floppfun.repository;

import com.floppfun.model.entity.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    Optional<Transaction> findBySignature(String signature);

    boolean existsBySignature(String signature);

    Page<Transaction> findByTokenIdOrderByCreatedAtDesc(Long tokenId, Pageable pageable);

    Page<Transaction> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    @Query("SELECT t FROM Transaction t WHERE t.token.id = :tokenId AND t.createdAt > :since ORDER BY t.createdAt DESC")
    List<Transaction> findRecentTokenTransactions(@Param("tokenId") Long tokenId, @Param("since") LocalDateTime since);

    @Query("SELECT t FROM Transaction t WHERE t.createdAt > :since ORDER BY t.createdAt DESC")
    List<Transaction> findRecentTransactions(@Param("since") LocalDateTime since, Pageable pageable);

    @Query("SELECT COUNT(t) FROM Transaction t WHERE t.token.id = :tokenId AND t.transactionType = :type")
    Long countByTokenIdAndType(@Param("tokenId") Long tokenId, @Param("type") Transaction.TransactionType type);

    @Query("SELECT SUM(t.solAmount) FROM Transaction t WHERE t.token.id = :tokenId AND t.createdAt > :since")
    Long calculateVolumeForToken(@Param("tokenId") Long tokenId, @Param("since") LocalDateTime since);
}
