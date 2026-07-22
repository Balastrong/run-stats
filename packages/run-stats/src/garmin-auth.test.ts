import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { authenticateGarmin } from "./sources/garmin/auth.ts";

describe("Garmin authentication", () => {
  it("exchanges a successful login ticket for refreshable tokens", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const tokens = await authenticateGarmin(
      "runner@example.com",
      "secret",
      async () => "unused",
      mockFetch(requests, [
        jsonResponse({ responseStatus: { type: "SUCCESSFUL" }, serviceTicketId: "ST-1" }),
        jsonResponse({ access_token: jwt({ client_id: "client-from-token" }), refresh_token: "refresh" }),
      ]),
    );

    assert.equal(tokens.di_client_id, "client-from-token");
    assert.equal(tokens.di_refresh_token, "refresh");
    assert.match(requests[0]?.url ?? "", /mobile\/api\/login/);
    assert.match(String(requests[1]?.init?.body), /service_ticket=ST-1/);
  });

  it("prompts for MFA and retains the login cookie", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const mfaRequired = jsonResponse(
      {
        responseStatus: { type: "MFA_REQUIRED" },
        customerMfaInfo: { mfaLastMethodUsed: "email" },
      },
      { "set-cookie": "SESSION=abc; Path=/; Secure; HttpOnly" },
    );
    await authenticateGarmin(
      "runner@example.com",
      "secret",
      async (method) => {
        assert.equal(method, "email");
        return "123456";
      },
      mockFetch(requests, [
        mfaRequired,
        jsonResponse({ responseStatus: { type: "SUCCESSFUL" }, serviceTicketId: "ST-2" }),
        jsonResponse({ access_token: jwt({}), refresh_token: "refresh" }),
      ]),
    );

    assert.match(requests[1]?.url ?? "", /mfa\/verifyCode/);
    assert.equal((requests[1]?.init?.headers as Record<string, string>).Cookie, "SESSION=abc");
    assert.match(String(requests[1]?.init?.body), /123456/);
  });
});

function mockFetch(
  requests: Array<{ url: string; init?: RequestInit }>,
  responses: Response[],
): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    const response = responses.shift();
    if (!response) throw new Error("Unexpected request");
    return response;
  }) as typeof fetch;
}

function jsonResponse(value: unknown, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  });
}

function jwt(payload: object): string {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}
