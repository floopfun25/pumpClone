package com.floppfun.controller;

import com.floppfun.model.dto.TradeRequest;
import com.floppfun.model.dto.TradeResponse;
import com.floppfun.model.dto.TransactionDTO;
import com.floppfun.model.entity.Transaction;
import com.floppfun.repository.TransactionRepository;
import com.floppfun.service.TradingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@Slf4j
@RestController
@RequestMapping("/trades")
@RequiredArgsConstructor
public class TradingController {

    private final TradingService tradingService;
    private final TransactionRepository transactionRepository;

    /**
     * Buy tokens
     */
    @PostMapping("/buy")
    public ResponseEntity<TradeResponse> buyTokens(
            @Valid @RequestBody TradeRequest request,
            Authentication authentication) {

        try {
            TradeResponse response = tradingService.buyTokens(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error processing buy", e);
            return ResponseEntity.badRequest().body(
                    TradeResponse.builder()
                            .status("ERROR")
                            .message(e.getMessage())
                            .build()
            );
        }
    }

    /**
     * Sell tokens
     */
    @PostMapping("/sell")
    public ResponseEntity<TradeResponse> sellTokens(
            @Valid @RequestBody TradeRequest request,
            Authentication authentication) {

        try {
            TradeResponse response = tradingService.sellTokens(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error processing sell", e);
            return ResponseEntity.badRequest().body(
                    TradeResponse.builder()
                            .status("ERROR")
                            .message(e.getMessage())
                            .build()
            );
        }
    }

    /**
     * Get transaction history for a token
     */
    @GetMapping("/token/{tokenId}")
    public ResponseEntity<Page<TransactionDTO>> getTokenTransactions(
            @PathVariable Long tokenId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size);
        Page<TransactionDTO> transactions = transactionRepository
                .findByTokenIdOrderByCreatedAtDesc(tokenId, pageable)
                .map(this::toDTO);

        return ResponseEntity.ok(transactions);
    }

    /**
     * Get transaction history for a user
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<Page<TransactionDTO>> getUserTransactions(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size);
        Page<TransactionDTO> transactions = transactionRepository
                .findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(this::toDTO);

        return ResponseEntity.ok(transactions);
    }

    /**
     * Get transaction by signature
     */
    @GetMapping("/signature/{signature}")
    public ResponseEntity<TransactionDTO> getTransactionBySignature(@PathVariable String signature) {
        Transaction transaction = transactionRepository.findBySignature(signature)
                .orElseThrow(() -> new RuntimeException("Transaction not found"));

        return ResponseEntity.ok(toDTO(transaction));
    }

    private TransactionDTO toDTO(Transaction tx) {
        return TransactionDTO.builder()
                .id(tx.getId())
                .signature(tx.getSignature())
                .tokenId(tx.getToken().getId())
                .tokenSymbol(tx.getToken().getSymbol())
                .tokenName(tx.getToken().getName())
                .userId(tx.getUser().getId())
                .userWalletAddress(tx.getUser().getWalletAddress())
                .transactionType(tx.getTransactionType().name())
                .solAmount(tx.getSolAmount())
                .tokenAmount(tx.getTokenAmount())
                .pricePerToken(tx.getPricePerToken())
                .platformFee(BigDecimal.valueOf(tx.getPlatformFee()))
                .status(tx.getStatus().name())
                .blockTime(tx.getBlockTime())
                .createdAt(tx.getCreatedAt())
                .build();
    }
}
