import { createFileRoute } from "@tanstack/react-router";

import { apiResponse, logout } from "../../../services/garmin-api.server.ts";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: () => apiResponse(logout),
    },
  },
});
