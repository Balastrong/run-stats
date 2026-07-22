import assert from "node:assert/strict";
import test from "node:test";

import { createSessionCodec } from "./services/session.ts";

const tokens = {
  di_token: "access-token",
  di_refresh_token: "refresh-token",
  di_client_id: "client-id",
};

test("round trips a Garmin session through an encrypted HttpOnly cookie", () => {
  const codec = createSessionCodec("a sufficiently long test secret value");
  const cookie = codec.cookie(tokens, true);
  const requestCookie = cookie.split(";", 1)[0];

  assert.deepEqual(codec.read(requestCookie), tokens);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);
  assert.doesNotMatch(cookie, /access-token|refresh-token/);
});

test("rejects a tampered browser session", () => {
  const codec = createSessionCodec("a sufficiently long test secret value");
  const cookie = codec.cookie(tokens, false).split(";", 1)[0] ?? "";
  const separator = cookie.indexOf("=");
  const index = separator + Math.floor((cookie.length - separator) / 2);
  const tampered = `${cookie.slice(0, index)}${cookie[index] === "A" ? "B" : "A"}${cookie.slice(index + 1)}`;
  assert.equal(codec.read(tampered), undefined);
});

test("requires a strong application session secret", () => {
  assert.throws(() => createSessionCodec("short"), /at least 32 characters/);
});
