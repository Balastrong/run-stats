import type { RunReference, RunReport } from "run-stats";

export type Selection =
  | { kind: "recent" }
  | { kind: "latest" }
  | { kind: "bulk" }
  | { kind: "report"; id: string };

export type RunResult =
  | { kind: "recent"; runs: RunReference[] }
  | { kind: "report"; report: RunReport }
  | { kind: "json"; data: unknown };

/** Shape of the `/` route's query params, used to drive `Selection` from the URL. */
export type RunSearch = {
  view?: Selection["kind"];
  id?: string;
};

export function selectionToSearch(selection: Selection | null): RunSearch {
  if (selection === null) return {};
  if (selection.kind === "report") return { view: "report", id: selection.id };
  return { view: selection.kind };
}

export function searchToSelection(search: RunSearch): Selection | null {
  switch (search.view) {
    case "recent":
      return { kind: "recent" };
    case "latest":
      return { kind: "latest" };
    case "bulk":
      return { kind: "bulk" };
    case "report":
      return search.id ? { kind: "report", id: search.id } : null;
    default:
      return null;
  }
}
