import "@tanstack/react-start/server-only";

import { createHash } from "node:crypto";

type Bucket = { count: number; resetsAt: number };

export interface LoginRateLimitOptions {
  windowMs: number;
  maxGlobalAttempts: number;
  maxAttemptsPerAccount: number;
  maxTrackedAccounts: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

const DEFAULT_OPTIONS: LoginRateLimitOptions = {
  windowMs: 10 * 60_000,
  maxGlobalAttempts: 300,
  maxAttemptsPerAccount: 10,
  maxTrackedAccounts: 1_000,
};

/**
 * A bounded, process-local login limiter that does not trust request headers.
 * Account identifiers are normalized and hashed before they are retained.
 */
export class LoginRateLimiter {
  readonly #options: LoginRateLimitOptions;
  readonly #accounts = new Map<string, Bucket>();
  #global: Bucket = { count: 0, resetsAt: 0 };

  constructor(options: Partial<LoginRateLimitOptions> = {}) {
    this.#options = { ...DEFAULT_OPTIONS, ...options };
  }

  consume(account: string, now = Date.now()): RateLimitDecision {
    this.#removeExpired(now);

    const global = consumeBucket(
      this.#global,
      now,
      this.#options.windowMs,
      this.#options.maxGlobalAttempts,
    );
    this.#global = global.bucket;
    if (!global.allowed) return decision(false, global.bucket.resetsAt, now);

    const key = accountKey(account);
    const existing = this.#accounts.get(key);
    if (!existing && this.#accounts.size >= this.#options.maxTrackedAccounts) {
      return decision(false, this.#global.resetsAt, now);
    }

    const result = consumeBucket(
      existing ?? { count: 0, resetsAt: 0 },
      now,
      this.#options.windowMs,
      this.#options.maxAttemptsPerAccount,
    );
    this.#accounts.set(key, result.bucket);
    return decision(result.allowed, result.bucket.resetsAt, now);
  }

  get trackedAccountCount(): number {
    return this.#accounts.size;
  }

  #removeExpired(now: number): void {
    for (const [key, bucket] of this.#accounts) {
      if (bucket.resetsAt <= now) this.#accounts.delete(key);
    }
  }
}

function consumeBucket(
  current: Bucket,
  now: number,
  windowMs: number,
  maximum: number,
): { allowed: boolean; bucket: Bucket } {
  const bucket =
    current.resetsAt <= now
      ? { count: 1, resetsAt: now + windowMs }
      : { ...current, count: Math.min(current.count + 1, maximum + 1) };
  return { allowed: bucket.count <= maximum, bucket };
}

function accountKey(account: string): string {
  return createHash("sha256")
    .update(account.trim().toLocaleLowerCase("en-US").normalize("NFKC"))
    .digest("base64url");
}

function decision(
  allowed: boolean,
  resetsAt: number,
  now: number,
): RateLimitDecision {
  return {
    allowed,
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil((resetsAt - now) / 1000)),
  };
}
