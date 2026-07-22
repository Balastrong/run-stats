import { createFileRoute } from "@tanstack/react-router";

import { App } from "../App.tsx";
import type { RunSearch } from "../services/run-types.ts";

const VIEWS = ["recent", "latest", "bulk", "report"] as const;

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): RunSearch => {
    const rawView = search.view;
    if (!VIEWS.includes(rawView as (typeof VIEWS)[number])) return {};
    const view = rawView as (typeof VIEWS)[number];
    if (view === "report") {
      const id = search.id;
      return typeof id === "string" && id.length > 0
        ? { view: "report", id }
        : {};
    }
    return { view };
  },
  component: App,
});
