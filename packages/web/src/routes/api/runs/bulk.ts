import { createFileRoute } from "@tanstack/react-router";

import { apiResponse, bulkRuns } from "../../../services/garmin-api.server.ts";

export const Route = createFileRoute("/api/runs/bulk")({
  server: {
    handlers: {
      GET: ({ request }) => apiResponse(() => bulkRuns(request)),
    },
  },
});
