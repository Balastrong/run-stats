import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";
import type { Register } from "@tanstack/react-router";
import type { RequestHandler } from "@tanstack/react-start/server";

type ServerEntry = { fetch: RequestHandler<Register> };

const serverEntry: ServerEntry = {
  async fetch(request) {
    const nonce = globalThis.crypto.randomUUID();
    const handler = createStartHandler((context) => {
      context.router.options.ssr = { ...context.router.options.ssr, nonce };
      return defaultStreamHandler(context);
    });
    return handler(request, { context: { nonce } });
  },
};

export default serverEntry;
