/**
 * Rate limiting middleware for Hono
 * Supports per-IP and per-endpoint rate limiting
 */

import type { Context, Next } from "npm:hono";

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number }[];
}

const rateLimitStore: RateLimitStore = {};

export interface RateLimitOptions {
  windowMs?: number; // Time window in milliseconds (default: 60000 = 1 minute)
  maxRequests?: number; // Max requests per window (default: 100)
  keyGenerator?: (c: Context) => string; // Function to generate rate limit key
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

/**
 * Creates a rate limiting middleware
 */
export const createRateLimiter = (options: RateLimitOptions = {}) => {
  const windowMs = options.windowMs || 60000; // 1 minute default
  const maxRequests = options.maxRequests || 100;
  const keyGenerator = options.keyGenerator || ((c: Context) => getClientIP(c));

  return async (c: Context, next: Next) => {
    const key = keyGenerator(c);
    const now = Date.now();

    // Initialize store for key if not exists
    if (!rateLimitStore[key]) {
      rateLimitStore[key] = [];
    }

    // Clean old entries
    rateLimitStore[key] = rateLimitStore[key].filter(
      (entry) => entry.resetTime > now
    );

    // Check if limit exceeded
    if (rateLimitStore[key].length >= maxRequests) {
      const oldestEntry = rateLimitStore[key].reduce((a, b) =>
        a.resetTime < b.resetTime ? a : b
      );
      const retryAfter = Math.ceil((oldestEntry.resetTime - now) / 1000);

      c.header("Retry-After", retryAfter.toString());
      c.header("X-RateLimit-Limit", maxRequests.toString());
      c.header("X-RateLimit-Remaining", "0");

      return c.json(
        {
          error: "Too many requests",
          retryAfter,
        },
        429
      );
    }

    // Add current request to store
    rateLimitStore[key].push({
      count: 1,
      resetTime: now + windowMs,
    });

    // Add rate limit headers
    const remaining = Math.max(0, maxRequests - rateLimitStore[key].length);
    c.header("X-RateLimit-Limit", maxRequests.toString());
    c.header("X-RateLimit-Remaining", remaining.toString());
    c.header(
      "X-RateLimit-Reset",
      (now + windowMs).toString()
    );

    await next();
  };
};

/**
 * Extract client IP from request
 */
export const getClientIP = (c: Context): string => {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const ip = c.req.header("cf-connecting-ip");
  if (ip) return ip;

  return "unknown";
};

/**
 * Different rate limiters for different endpoints
 */
export const rateLimiters = {
  // Strict limit for auth endpoints (prevent brute force)
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per IP per 15 minutes
  }),

  // Standard limit for general API
  api: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
  }),

  // Strict limit for file uploads
  upload: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
  }),

  // Very strict for quiz submission (prevent spam)
  submission: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
  }),
};

/**
 * Clean up old entries periodically
 */
setInterval(() => {
  const now = Date.now();
  Object.keys(rateLimitStore).forEach((key) => {
    rateLimitStore[key] = rateLimitStore[key].filter(
      (entry) => entry.resetTime > now
    );
    if (rateLimitStore[key].length === 0) {
      delete rateLimitStore[key];
    }
  });
}, 5 * 60 * 1000); // Clean every 5 minutes
