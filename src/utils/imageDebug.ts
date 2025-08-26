import { getTokenFallbackImage } from "./paths";

/**
 * Tests if an image URL is accessible via fetch.
 * This helps diagnose issues with broken image links, especially from Supabase Storage.
 */
export async function testImageUrl(
  url: string,
  tokenIdentifier: string,
): Promise<void> {
  // Function body removed to disable logging
}

/**
 * Analyzes a Supabase Storage URL to extract useful information for debugging.
 */
export function analyzeSupabaseUrl(url: string): void {
  // Function body removed to disable logging
}
