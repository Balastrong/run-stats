import type { RunReport, RunSource } from "./types.ts";

/** Retrieve the full report for the source's most recent run. */
export async function getMostRecentRun(source: RunSource): Promise<RunReport> {
  const [mostRecent] = await source.recentRuns(1);
  if (!mostRecent) {
    throw new Error(`No recent runs found in ${source.displayName}`);
  }
  return source.getRun(mostRecent.id);
}
