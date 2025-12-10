/**
 * Rate limiting utility
 * Uses in-memory storage (suitable for single-instance deployments)
 * For multi-instance deployments, consider using Redis-based rate limiting
 */

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for rate limiting
// Key format: `${identifier}:${endpoint}`
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupInterval) return;
  
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
}

/**
 * Get rate limit identifier from request
 * Uses IP address for unauthenticated requests, user ID for authenticated requests
 */
function getRateLimitIdentifier(request: Request, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }
  
  // Get IP address from headers (works with proxies)
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0]?.trim() || realIp || "unknown";
  
  return `ip:${ip}`;
}

/**
 * Check if request should be rate limited
 * @param identifier - Rate limit identifier (IP or user ID)
 * @param endpoint - Endpoint name for scoping
 * @param config - Rate limit configuration
 * @returns Object with isLimited boolean and remaining requests
 */
export function checkRateLimit(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig
): { isLimited: boolean; remaining: number; resetAt: number } {
  startCleanup();
  
  const key = `${identifier}:${endpoint}`;
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  // If no entry or window expired, create new entry
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);
    return {
      isLimited: false,
      remaining: config.maxRequests - 1,
      resetAt: entry.resetAt,
    };
  }
  
  // Increment count
  entry.count++;
  
  // Check if limit exceeded
  const isLimited = entry.count > config.maxRequests;
  
  return {
    isLimited,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Rate limit middleware for API routes
 * @param request - Next.js request
 * @param endpoint - Endpoint identifier
 * @param config - Rate limit configuration
 * @param userId - Optional user ID (for authenticated endpoints)
 * @returns NextResponse with 429 status if rate limited, null if allowed
 */
export function rateLimitMiddleware(
  request: Request,
  endpoint: string,
  config: RateLimitConfig,
  userId?: string
): Response | null {
  const identifier = getRateLimitIdentifier(request, userId);
  const result = checkRateLimit(identifier, endpoint, config);
  
  if (result.isLimited) {
    const resetSeconds = Math.ceil((result.resetAt - Date.now()) / 1000);
    return new Response(
      JSON.stringify({
        error: "Too many requests",
        message: `Rate limit exceeded. Please try again in ${resetSeconds} seconds.`,
        retryAfter: resetSeconds,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(resetSeconds),
          "X-RateLimit-Limit": String(config.maxRequests),
          "X-RateLimit-Remaining": String(result.remaining),
          "X-RateLimit-Reset": String(result.resetAt),
        },
      }
    );
  }
  
  return null;
}

/**
 * Predefined rate limit configurations
 */
export const RATE_LIMITS = {
  // Authentication endpoints - stricter limits
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 requests per 15 minutes
  },
  
  // Upload endpoints - moderate limits
  UPLOAD: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 uploads per hour
  },
  
  // Purchase/checkout endpoints - moderate limits
  PURCHASE: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 purchases per hour
  },
  
  // Webhook endpoints - very strict (should only be called by Stripe)
  WEBHOOK: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute (Stripe can send many)
  },
  
  // General API endpoints - more lenient
  API: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  },
  
  // Admin endpoints - moderate limits
  ADMIN: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
  },
} as const;

