import type { RunReference, RunReport } from "run-stats";

import { api } from "./api.ts";
import type { RunResult, Selection } from "./run-types.ts";

export async function fetchRuns(selection: Selection): Promise<RunResult> {
  switch (selection.kind) {
    case "recent":
      return {
        kind: "recent",
        runs: (await api(
          "/api/runs/recent?limit=10",
        )) as unknown as RunReference[],
      };
    case "latest":
      return {
        kind: "report",
        report: (await api("/api/runs/latest")) as unknown as RunReport,
      };
    case "report":
      return {
        kind: "report",
        report: (await api(
          `/api/runs/${selection.id}`,
        )) as unknown as RunReport,
      };
    case "bulk":
      return { kind: "json", data: await api("/api/runs/bulk?count=50") };
  }
}
