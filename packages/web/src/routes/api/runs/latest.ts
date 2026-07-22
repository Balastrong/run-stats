import { createFileRoute } from "@tanstack/react-router";

import { apiResponse, latestRun } from "../../../services/garmin-api.server.ts";

export const Route = createFileRoute("/api/runs/latest")({
  server: {
    handlers: {
      GET: ({ request }) => apiResponse(() => latestRun(request)),
    },
  },
});
