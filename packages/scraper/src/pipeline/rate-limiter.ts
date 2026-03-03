/**
 * Token-bucket rate limiter (in-memory).
 *
 * Tokens are consumed on each `acquire()` call. If no tokens remain,
 * the call awaits until enough tokens have been refilled.
 */
export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillPerSecond: number;
  private lastRefill: number;
  private readonly label: string;

  constructor(maxTokens: number, refillPerSecond: number, label = "unknown") {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillPerSecond = refillPerSecond;
    this.lastRefill = Date.now();
    this.label = label;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const newTokens = elapsed * this.refillPerSecond;

    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Calculate how long to wait for one token to become available
    const deficit = 1 - this.tokens;
    const waitMs = (deficit / this.refillPerSecond) * 1000;

    console.log(`[rate-limiter] ${this.label}: throttled, waiting ${(waitMs / 1000).toFixed(1)}s`);
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));

    this.refill();
    this.tokens -= 1;
  }
}

/** Google Places API: 10 requests per minute */
export const googlePlacesLimiter = new RateLimiter(10, 10 / 60, "Google Places");

/** Website scraping: 3 requests per minute */
export const websiteLimiter = new RateLimiter(3, 3 / 60, "Website");

/** Yelp Fusion API: 50 requests per minute */
export const yelpLimiter = new RateLimiter(50, 50 / 60, "Yelp");
