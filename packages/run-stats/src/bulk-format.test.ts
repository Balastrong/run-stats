import assert from "node:assert/strict";
import test from "node:test";

import { toBulkText } from "./bulk-format.ts";

test("formats compact AI-friendly run summaries", () => {
  const text = toBulkText([{
    id: "123",
    name: "Tempo Run",
    start: "2026-07-13T08:01:02.0",
    location: "Rome",
    distanceKm: 10,
    movingSeconds: 3000,
    elapsedSeconds: 3030,
    averageHeartRateBpm: 150,
    maxHeartRateBpm: 170,
    averageCadenceSpm: 174,
    caloriesKcal: 620,
    averagePowerW: 250,
    maxPowerW: 310,
    elevationGainM: 80,
    elevationLossM: 75,
    aerobicEffect: 3.4,
    anaerobicEffect: 0.5,
    workoutPhases: [
      { type: "warmup", count: 1, durationSeconds: 600, distanceKm: 2 },
      { type: "active", count: 5, durationSeconds: 1800, distanceKm: 6 },
      { type: "recovery", count: 4, durationSeconds: 480, distanceKm: 1.2 },
    ],
  }]);

  assert.match(text, /^# Garmin running activities\nRuns: 1/);
  assert.match(text, /2026-07-13 08:01:02 \| Tempo Run \| Rome/);
  assert.match(text, /10 km \| 50:00 moving \| 50:30 elapsed \| 5:00\/km/);
  assert.match(text, /HR 150 avg \/ 170 max bpm \| 174 spm cadence/);
  assert.match(text, /250 avg \/ 310 max W \| elevation \+80\/-75 m/);
  assert.match(text, /620 kcal \| TE 3\.4 aerobic \/ 0\.5 anaerobic \| ID 123/);
  assert.match(text, /Workout phases: warmup 1×, 10:00, 2 km, 5:00\/km/);
  assert.match(text, /active 5×, 30:00, 6 km, 5:00\/km/);
  assert.match(text, /recovery 4×, 8:00, 1\.2 km, 6:40\/km/);
});
