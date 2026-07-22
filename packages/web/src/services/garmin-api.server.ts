import "@tanstack/react-start/server-only";

import { randomBytes } from "node:crypto";
import {
  authenticateGarmin,
  GarminSource,
  type GarminTokens,
  type GarminTokenStore,
  getMostRecentRun,
} from "run-stats";

import { LoginRateLimiter } from "./login-rate-limit.server.ts";
import { createSessionCodec, type SessionCodec } from "./session.ts";

export async function apiResponse(
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    console.error(error);
    return json(
      error instanceof HttpError ? error.status : 500,
      {
        error:
          error instanceof HttpError ? error.message : "Internal server error",
      },
      error instanceof HttpError ? error.headers : undefined,
    );
  }
}

export async function authStatus(request: Request): Promise<Response> {
  return json(200, { authenticated: Boolean(readTokens(request)) });
}

export async function login(request: Request): Promise<Response> {
  const body = await readJson(request);
  const email = text(body.email).trim();
  const password = text(body.password);
  const mfaCode = text(body.mfaCode).trim();
  if (!email || !password)
    throw new HttpError(400, "Email and password are required");
  checkLoginRateLimit(email);

  try {
    const tokens = await authenticateGarmin(email, password, async (method) => {
      if (!mfaCode) throw new MfaRequired(method);
      return mfaCode;
    });
    return json(
      200,
      { authenticated: true },
      { "Set-Cookie": sessions().cookie(tokens, secureCookies()) },
    );
  } catch (error) {
    if (error instanceof MfaRequired) {
      return json(409, { mfaRequired: true, method: error.method });
    }
    const message = errorMessage(error);
    if (message.includes("Invalid Garmin email or password"))
      throw new HttpError(401, message);
    if (message.includes("rate limited")) throw new HttpError(429, message);
    throw new HttpError(502, message);
  }
}

export async function logout(): Promise<Response> {
  return json(
    200,
    { authenticated: false },
    {
      "Set-Cookie": sessions().clearCookie(secureCookies()),
    },
  );
}

export async function recentRuns(request: Request): Promise<Response> {
  return withGarmin(request, async (source) =>
    source.recentRuns(queryLimit(request, "limit", 10)),
  );
}

export async function bulkRuns(request: Request): Promise<Response> {
  return withGarmin(request, async (source) =>
    source.runSummaries(queryLimit(request, "count", 50)),
  );
}

export async function latestRun(request: Request): Promise<Response> {
  return withGarmin(request, getMostRecentRun);
}

export async function runById(
  request: Request,
  activityId: string,
): Promise<Response> {
  if (!/^\d+$/.test(activityId))
    throw new HttpError(400, "Activity ID must contain digits only");
  return withGarmin(request, (source) => source.getRun(activityId));
}

async function withGarmin<T>(
  request: Request,
  operation: (source: GarminSource) => Promise<T>,
): Promise<Response> {
  const tokens = readTokens(request);
  if (!tokens) throw new HttpError(401, "Log in to Garmin first");
  const store = new BrowserTokenStore(tokens);
  const result = await operation(new GarminSource(store));
  return json(200, result, {
    "Set-Cookie": sessions().cookie(store.tokens, secureCookies()),
  });
}

class BrowserTokenStore implements GarminTokenStore {
  readonly description = "the encrypted browser session";
  tokens: GarminTokens;

  constructor(tokens: GarminTokens) {
    this.tokens = tokens;
  }

  async load(): Promise<GarminTokens> {
    return this.tokens;
  }
  async save(tokens: GarminTokens): Promise<void> {
    this.tokens = tokens;
  }
}

class MfaRequired extends Error {
  readonly method: string;

  constructor(method: string) {
    super("Garmin MFA code is required");
    this.method = method;
  }
}

class HttpError extends Error {
  readonly status: number;
  readonly headers?: HeadersInit;

  constructor(status: number, message: string, headers?: HeadersInit) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

let sessionCodec: SessionCodec | undefined;
let developmentSecret: string | undefined;

function sessions(): SessionCodec {
  if (sessionCodec) return sessionCodec;
  let secret = process.env.WEB_SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new HttpError(500, "WEB_SESSION_SECRET is required in production");
  }
  if (!secret) {
    developmentSecret ??= randomBytes(32).toString("base64url");
    secret = developmentSecret;
    console.warn(
      "WEB_SESSION_SECRET is unset; browser sessions reset when the dev server restarts",
    );
  }
  sessionCodec = createSessionCodec(secret);
  return sessionCodec;
}

function readTokens(request: Request): GarminTokens | undefined {
  return sessions().read(request.headers.get("cookie") ?? undefined);
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json");
  }
  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (declaredSize > 16_384)
    throw new HttpError(413, "Request body is too large");
  const value = await request.text();
  if (Buffer.byteLength(value) > 16_384)
    throw new HttpError(413, "Request body is too large");
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "Request body must be a JSON object");
  }
}

function queryLimit(request: Request, name: string, fallback: number): number {
  const value = new URL(request.url).searchParams.get(name);
  if (value === null) return fallback;
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 200) {
    throw new HttpError(400, `${name} must be an integer between 1 and 200`);
  }
  return result;
}

function json(status: number, value: unknown, headers?: HeadersInit): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...Object.fromEntries(new Headers(headers)),
    },
  });
}

function secureCookies(): boolean {
  return process.env.NODE_ENV === "production";
}
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const loginRateLimiter = new LoginRateLimiter();
function checkLoginRateLimit(email: string): void {
  const result = loginRateLimiter.consume(email);
  if (!result.allowed) {
    throw new HttpError(429, "Too many login attempts; try again later", {
      "Retry-After": String(result.retryAfterSeconds),
    });
  }
}
