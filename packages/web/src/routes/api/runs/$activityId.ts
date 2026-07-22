import { createFileRoute } from "@tanstack/react-router";

import { apiResponse, runById } from "../../../services/garmin-api.server.ts";

export const Route = createFileRoute("/api/runs/$activityId")({
  server: {
    handlers: {
      GET: ({ params, request }) =>
        apiResponse(() => runById(request, params.activityId)),
    },
  },
});
