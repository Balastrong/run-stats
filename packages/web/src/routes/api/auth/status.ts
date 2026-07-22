import { createFileRoute } from "@tanstack/react-router";

import {
  apiResponse,
  authStatus,
} from "../../../services/garmin-api.server.ts";

export const Route = createFileRoute("/api/auth/status")({
  server: {
    handlers: {
      GET: ({ request }) => apiResponse(() => authStatus(request)),
    },
  },
});
