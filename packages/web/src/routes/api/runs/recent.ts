import { createFileRoute } from "@tanstack/react-router";

import {
  apiResponse,
  recentRuns,
} from "../../../services/garmin-api.server.ts";

export const Route = createFileRoute("/api/runs/recent")({
  server: {
    handlers: {
      GET: ({ request }) => apiResponse(() => recentRuns(request)),
    },
  },
});
