import "@tanstack/react-start/server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { GarminTokens } from "run-stats";

const COOKIE_NAME = "run_stats_session";
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionCodec {
  cookie(tokens: GarminTokens, secure: boolean): string;
  clearCookie(secure: boolean): string;
  read(cookieHeader: string | undefined): GarminTokens | undefined;
}

export function createSessionCodec(secret: string): SessionCodec {
  if (secret.length < 32)
    throw new Error("WEB_SESSION_SECRET must be at least 32 characters");
  const key = createHash("sha256").update(secret).digest();

  return {
    cookie(tokens, secure) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const encrypted = Buffer.concat([
        cipher.update(
          JSON.stringify({
            tokens,
            expiresAt: Date.now() + SESSION_LIFETIME_MS,
          }),
          "utf8",
        ),
        cipher.final(),
      ]);
      const value = Buffer.concat([
        iv,
        cipher.getAuthTag(),
        encrypted,
      ]).toString("base64url");
      const result = serializeCookie(value, secure, "Max-Age=2592000");
      if (result.length > 4096)
        throw new Error("Garmin session is too large for a browser cookie");
      return result;
    },
    clearCookie(secure) {
      return serializeCookie("", secure, "Max-Age=0");
    },
    read(cookieHeader) {
      const value = parseCookies(cookieHeader)[COOKIE_NAME];
      if (!value) return undefined;
      try {
        const payload = Buffer.from(value, "base64url");
        if (payload.length < 29) return undefined;
        const decipher = createDecipheriv(
          "aes-256-gcm",
          key,
          payload.subarray(0, 12),
        );
        decipher.setAuthTag(payload.subarray(12, 28));
        const parsed = JSON.parse(
          Buffer.concat([
            decipher.update(payload.subarray(28)),
            decipher.final(),
          ]).toString("utf8"),
        ) as { tokens?: Partial<GarminTokens>; expiresAt?: number };
        const tokens = parsed.tokens;
        return parsed.expiresAt &&
          parsed.expiresAt > Date.now() &&
          tokens?.di_token &&
          tokens.di_refresh_token &&
          tokens.di_client_id
          ? (tokens as GarminTokens)
          : undefined;
      } catch {
        return undefined;
      }
    },
  };
}

function serializeCookie(
  value: string,
  secure: boolean,
  lifetime: string,
): string {
  return [
    `${COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    lifetime,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

function parseCookies(header: string | undefined): Record<string, string> {
  return Object.fromEntries(
    (header ?? "").split(";").flatMap((part) => {
      const separator = part.indexOf("=");
      return separator < 0
        ? []
        : [[part.slice(0, separator).trim(), part.slice(separator + 1).trim()]];
    }),
  );
}
