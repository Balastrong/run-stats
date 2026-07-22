import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start";

const securityHeaders = createMiddleware().server(async ({ context, next }) => {
  const nonce = (context as unknown as { nonce?: string }).nonce ?? globalThis.crypto.randomUUID();
  const result = await next();
  result.response.headers.set("X-Content-Type-Options", "nosniff");
  result.response.headers.set("Referrer-Policy", "no-referrer");
  result.response.headers.set(
    "Content-Security-Policy",
    `default-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; script-src 'self' 'nonce-${nonce}'`,
  );
  return result;
});

const csrfProtection = createCsrfMiddleware({
  filter: ({ request }) => !new Set(["GET", "HEAD", "OPTIONS"]).has(request.method),
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfProtection, securityHeaders],
}));
