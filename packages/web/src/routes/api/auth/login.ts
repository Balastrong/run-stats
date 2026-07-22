import { createFileRoute } from "@tanstack/react-router";

import { apiResponse, login } from "../../../services/garmin-api.server.ts";

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: ({ request }) => apiResponse(() => login(request)),
    },
  },
});
