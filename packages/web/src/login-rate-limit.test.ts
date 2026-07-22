import assert from "node:assert/strict";
import test from "node:test";

import { LoginRateLimiter } from "./services/login-rate-limit.server.ts";

test("limits repeated attempts for the same normalized account", () => {
  const limiter = new LoginRateLimiter({
    windowMs: 60_000,
    maxGlobalAttempts: 100,
    maxAttemptsPerAccount: 2,
  });

  assert.equal(limiter.consume("Runner@Example.com", 1_000).allowed, true);
  assert.equal(limiter.consume(" runner@example.com ", 1_001).allowed, true);
  assert.deepEqual(limiter.consume("RUNNER@example.com", 1_002), {
    allowed: false,
    retryAfterSeconds: 60,
  });
});

test("limits aggregate attempts across distinct accounts", () => {
  const limiter = new LoginRateLimiter({
    windowMs: 60_000,
    maxGlobalAttempts: 2,
    maxAttemptsPerAccount: 10,
  });

  assert.equal(limiter.consume("one@example.com", 1_000).allowed, true);
  assert.equal(limiter.consume("two@example.com", 1_001).allowed, true);
  assert.equal(limiter.consume("three@example.com", 1_002).allowed, false);
});

test("keeps account tracking bounded and expires old entries", () => {
  const limiter = new LoginRateLimiter({
    windowMs: 1_000,
    maxGlobalAttempts: 100,
    maxAttemptsPerAccount: 10,
    maxTrackedAccounts: 2,
  });

  limiter.consume("one@example.com", 1_000);
  limiter.consume("two@example.com", 1_001);
  assert.equal(limiter.trackedAccountCount, 2);
  assert.equal(limiter.consume("three@example.com", 1_002).allowed, false);
  assert.equal(limiter.trackedAccountCount, 2);

  assert.equal(limiter.consume("three@example.com", 2_001).allowed, true);
  assert.equal(limiter.trackedAccountCount, 1);
});
