import { chmod, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const SSO_URL = "https://sso.garmin.com/mobile/api/login";
const MFA_URL = "https://sso.garmin.com/mobile/api/mfa/verifyCode";
const TOKEN_URL = "https://diauth.garmin.com/di-oauth2-service/oauth/token";
const SSO_CLIENT_ID = "GCM_IOS_DARK";
const SSO_SERVICE_URL = "https://mobile.integration.garmin.com/gcm/ios";
const DI_GRANT_TYPE =
  "https://connectapi.garmin.com/di-oauth2-service/oauth/grant/service_ticket";
const DI_CLIENT_IDS = [
  "GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2",
  "GARMIN_CONNECT_MOBILE_ANDROID_DI_2024Q4",
  "GARMIN_CONNECT_MOBILE_ANDROID_DI",
  "GARMIN_CONNECT_MOBILE_IOS_DI",
] as const;

const LOGIN_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  Accept: "application/json, text/plain, */*",
  "Content-Type": "application/json",
  Origin: "https://sso.garmin.com",
} as const;

const NATIVE_HEADERS = {
  "User-Agent": "GCM-Android-5.23",
  "X-Garmin-User-Agent":
    "com.garmin.android.apps.connectmobile/5.23; ; Google/sdk_gphone64_arm64/google; Android/33; Dalvik/2.1.0",
  "X-Garmin-Paired-App-Version": "10861",
  "X-Garmin-Client-Platform": "Android",
  "X-App-Ver": "10861",
  "X-Lang": "en",
  "X-GCExperience": "GC5",
  "Accept-Language": "en-US,en;q=0.9",
} as const;

export interface GarminTokens {
  di_token: string;
  di_refresh_token: string;
  di_client_id: string;
}

interface LoginResponse {
  responseStatus?: { type?: string };
  customerMfaInfo?: { mfaLastMethodUsed?: string };
  serviceTicketId?: string;
  error?: { "status-code"?: string };
}

export type MfaPrompt = (method: string) => Promise<string>;
type Fetch = typeof fetch;

export function defaultGarminTokenFile(): string {
  return join(homedir(), ".config", "run-stats", "garmin", "garmin_tokens.json");
}

export async function authenticateGarmin(
  email: string,
  password: string,
  promptMfa: MfaPrompt,
  request: Fetch = fetch,
): Promise<GarminTokens> {
  const params = new URLSearchParams({
    clientId: SSO_CLIENT_ID,
    locale: "en-US",
    service: SSO_SERVICE_URL,
  });
  const cookies = new Map<string, string>();
  const loginResponse = await request(`${SSO_URL}?${params}`, {
    method: "POST",
    headers: LOGIN_HEADERS,
    body: JSON.stringify({
      username: email,
      password,
      rememberMe: true,
      captchaToken: "",
    }),
  });
  rememberCookies(loginResponse.headers, cookies);
  const login = await loginResult(loginResponse, "Garmin login");

  let ticket: string | undefined;
  switch (login.responseStatus?.type) {
    case "SUCCESSFUL":
      ticket = login.serviceTicketId;
      break;
    case "MFA_REQUIRED": {
      const method = login.customerMfaInfo?.mfaLastMethodUsed ?? "email";
      const code = (await promptMfa(method)).trim();
      if (!code) throw new Error("MFA code is required");
      const mfaResponse = await request(`${MFA_URL}?${params}`, {
        method: "POST",
        headers: {
          ...LOGIN_HEADERS,
          ...(cookies.size ? { Cookie: cookieHeader(cookies) } : {}),
        },
        body: JSON.stringify({
          mfaMethod: method,
          mfaVerificationCode: code,
          rememberMyBrowser: true,
          reconsentList: [],
          mfaSetup: false,
        }),
      });
      const mfa = await loginResult(mfaResponse, "Garmin MFA verification");
      if (mfa.responseStatus?.type !== "SUCCESSFUL") {
        throw loginFailure("Garmin MFA verification", mfa);
      }
      ticket = mfa.serviceTicketId;
      break;
    }
    default:
      throw loginFailure("Garmin login", login);
  }

  if (!ticket) throw new Error("Garmin login succeeded without a service ticket");
  return exchangeServiceTicket(ticket, request);
}

export async function saveGarminTokens(
  tokens: GarminTokens,
  tokenFile: string,
): Promise<void> {
  await mkdir(dirname(tokenFile), { recursive: true, mode: 0o700 });
  await chmod(dirname(tokenFile), 0o700).catch(() => undefined);
  await writeFile(tokenFile, `${JSON.stringify(tokens, null, 2)}\n`, {
    mode: 0o600,
  });
  await chmod(tokenFile, 0o600).catch(() => undefined);
}

async function exchangeServiceTicket(
  ticket: string,
  request: Fetch,
): Promise<GarminTokens> {
  for (const clientId of DI_CLIENT_IDS) {
    const body = new URLSearchParams({
      client_id: clientId,
      service_ticket: ticket,
      grant_type: DI_GRANT_TYPE,
      service_url: SSO_SERVICE_URL,
    });
    const response = await request(TOKEN_URL, {
      method: "POST",
      headers: {
        ...NATIVE_HEADERS,
        Authorization: basicAuth(clientId),
        Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
      },
      body,
    });
    if (response.status === 429) {
      throw new Error("Garmin token exchange was rate limited; wait a few minutes and try again");
    }
    if (!response.ok) continue;

    const result = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
    };
    if (result.access_token && result.refresh_token) {
      return {
        di_token: result.access_token,
        di_refresh_token: result.refresh_token,
        di_client_id: jwtClientId(result.access_token) ?? clientId,
      };
    }
  }
  throw new Error("Garmin token exchange failed for every supported client");
}

async function loginResult(response: Response, label: string): Promise<LoginResponse> {
  if (response.status === 429) {
    throw new Error(`${label} was rate limited; wait a few minutes and try again`);
  }
  if (response.status === 403) {
    throw new Error(`${label} was blocked by Garmin's bot protection; wait and try another network`);
  }
  try {
    return (await response.json()) as LoginResponse;
  } catch {
    throw new Error(`${label} returned an unexpected response (${response.status})`);
  }
}

function loginFailure(label: string, result: LoginResponse): Error {
  const type = result.responseStatus?.type;
  if (type === "INVALID_USERNAME_PASSWORD") {
    return new Error("Invalid Garmin email or password");
  }
  if (type === "CAPTCHA_REQUIRED") {
    return new Error(`${label} requires a CAPTCHA; wait and try again from another network`);
  }
  if (result.error?.["status-code"] === "429") {
    return new Error(`${label} was rate limited; wait a few minutes and try again`);
  }
  return new Error(`${label} failed${type ? ` (${type})` : ""}`);
}

function rememberCookies(headers: Headers, cookies: Map<string, string>): void {
  const values =
    (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ??
    splitSetCookie(headers.get("set-cookie"));
  for (const value of values) {
    const pair = value.split(";", 1)[0];
    const separator = pair?.indexOf("=") ?? -1;
    if (pair && separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

function splitSetCookie(value: string | null): string[] {
  return value?.split(/,(?=[^;,]+=)/) ?? [];
}

function cookieHeader(cookies: Map<string, string>): string {
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

function basicAuth(clientId: string): string {
  return `Basic ${Buffer.from(`${clientId}:`).toString("base64")}`;
}

function jwtClientId(token: string): string | undefined {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as {
      client_id?: string;
    };
    return payload.client_id;
  } catch {
    return undefined;
  }
}
