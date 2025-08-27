/**
 * Emergency cache clearing script for fake balance data
 * Run this in browser console to clear all fake cached balances
 */

// Clear localStorage cache
console.log("🗑️ [CLEAR CACHE] Starting cache cleanup...");

try {
  // Clear token balance cache from localStorage
  const cacheKey = "token_balance_cache";
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    const cacheData = JSON.parse(cached);
    const entriesBefore = Object.keys(cacheData).length;
    console.log("🔍 [CLEAR CACHE] Found", entriesBefore, "cached entries");

    // Remove entries with fake balances (>= 1 billion tokens)
    const cleanedData = {};
    let removedCount = 0;

    Object.entries(cacheData).forEach(([key, entry]) => {
      if (entry.balance >= 1000000000) {
        console.log("🗑️ [CLEAR CACHE] Removing fake balance:", {
          key,
          balance: entry.balance,
          tokenMint: entry.tokenMint?.slice(0, 8) + "...",
        });
        removedCount++;
      } else {
        cleanedData[key] = entry;
      }
    });

    // Update localStorage with cleaned data
    localStorage.setItem(cacheKey, JSON.stringify(cleanedData));

    console.log("✅ [CLEAR CACHE] Cleaned localStorage cache:", {
      entriesBefore,
      entriesAfter: Object.keys(cleanedData).length,
      removed: removedCount,
    });
  } else {
    console.log("ℹ️ [CLEAR CACHE] No localStorage cache found");
  }

  // Also clear all cache as fallback
  localStorage.removeItem(cacheKey);
  console.log("🗑️ [CLEAR CACHE] Completely cleared localStorage cache");

  console.log(
    "✅ [CLEAR CACHE] Cache cleanup completed! Refresh the page to see updated balances.",
  );
} catch (error) {
  console.error("❌ [CLEAR CACHE] Failed to clear cache:", error);
}
