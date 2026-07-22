import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getMostRecentRun } from "./latest-run.ts";
import type { RunReport, RunSource } from "./types.ts";

describe("getMostRecentRun", () => {
  it("retrieves the full report for the newest run", async () => {
    const expected: RunReport = {
      run: { name: "Evening Run", distanceKm: 8.2 },
      source: { id: "test", activityId: "newest" },
    };
    const requestedIds: string[] = [];
    const source: RunSource = {
      id: "test",
      displayName: "Test Source",
      async recentRuns(limit) {
        assert.equal(limit, 1);
        return [{ id: "newest", name: "Evening Run" }];
      },
      async getRun(id) {
        requestedIds.push(id);
        return expected;
      },
    };

    assert.equal(await getMostRecentRun(source), expected);
    assert.deepEqual(requestedIds, ["newest"]);
  });

  it("reports when the source has no runs", async () => {
    const source: RunSource = {
      id: "test",
      displayName: "Test Source",
      async recentRuns() {
        return [];
      },
      async getRun() {
        throw new Error("getRun should not be called");
      },
    };

    await assert.rejects(
      getMostRecentRun(source),
      new Error("No recent runs found in Test Source"),
    );
  });
});
