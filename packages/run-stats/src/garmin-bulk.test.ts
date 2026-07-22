import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { GarminSource } from "./sources/garmin/garmin-source.ts";

test("fetches run summaries in pages of at most 100", async () => {
  const directory = await mkdtemp(join(tmpdir(), "run-stats-bulk-"));
  const tokenFile = join(directory, "tokens.json");
  await writeFile(tokenFile, JSON.stringify(validTokens()));
  const requests: URL[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    const start = Number(url.searchParams.get("start"));
    const limit = Number(url.searchParams.get("limit"));
    return Response.json(Array.from({ length: limit }, (_, index) => activity(start + index + 1)));
  };

  try {
    const runs = await new GarminSource(tokenFile).runSummaries(101);
    assert.equal(runs.length, 101);
    assert.deepEqual(requests.map((url) => url.searchParams.get("start")), ["0", "100"]);
    assert.deepEqual(requests.map((url) => url.searchParams.get("limit")), ["100", "1"]);
    assert.ok(requests.every((url) => url.searchParams.get("activityType") === "running"));
    assert.ok(requests.every((url) => url.searchParams.get("excludeChildren") === "false"));
    assert.deepEqual(runs[0], {
      id: "1",
      name: "Run 1",
      start: "2026-07-13T08:00:00.0",
      location: "Rome",
      distanceKm: 10,
      movingSeconds: 3000,
      elapsedSeconds: 3030,
      averageHeartRateBpm: 150,
      maxHeartRateBpm: 170,
      averageCadenceSpm: 174,
      caloriesKcal: 600,
      averagePowerW: 250,
      maxPowerW: 310,
      elevationGainM: 80,
      elevationLossM: 75,
      aerobicEffect: 3.4,
      anaerobicEffect: 0.5,
      workoutPhases: [
        { type: "active", count: 5, durationSeconds: 1800, distanceKm: 6.09 },
        { type: "recovery", count: 4, durationSeconds: 480, distanceKm: 1.35 },
      ],
    });
  } finally {
    globalThis.fetch = originalFetch;
    await rm(directory, { recursive: true, force: true });
  }
});

function activity(activityId: number) {
  return {
    activityId,
    activityName: `Run ${activityId}`,
    activityType: { typeKey: "running" },
    startTimeLocal: "2026-07-13T08:00:00.0",
    locationName: "Rome",
    distance: 10000,
    movingDuration: 3000,
    elapsedDuration: 3030,
    averageHR: 149.6,
    maxHR: 170.2,
    averageRunningCadenceInStepsPerMinute: 173.6,
    calories: 600.2,
    averagePower: 249.6,
    maxPower: 310.2,
    elevationGain: 80.2,
    elevationLoss: 74.6,
    aerobicTrainingEffect: 3.4,
    anaerobicTrainingEffect: 0.5,
    splitSummaries: [
      {
        noOfSplits: 4,
        duration: 480,
        splitType: "INTERVAL_RECOVERY",
        distance: 1352.94,
      },
      {
        noOfSplits: 2,
        duration: 3831.6,
        splitType: "RWD_RUN",
        distance: 12082.73,
      },
      {
        noOfSplits: 5,
        duration: 1800,
        splitType: "INTERVAL_ACTIVE",
        distance: 6088.81,
      },
    ],
  };
}

function validTokens() {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 3600,
    client_id: "client",
  })).toString("base64url");
  return {
    di_token: `header.${payload}.signature`,
    di_refresh_token: "refresh",
    di_client_id: "client",
  };
}
