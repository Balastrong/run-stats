import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toMarkdown } from "./format.ts";
import { normalizeGarminRun } from "./sources/garmin/normalize.ts";

describe("Garmin normalization", () => {
  it("flattens activity details and calculates kilometre splits", () => {
    const report = normalizeGarminRun(
      {
        activityId: 456,
        activityName: "Morning Run",
        activityTypeDTO: { typeKey: "running" },
        timeZoneUnitDTO: { timeZone: "Europe/Rome" },
        summaryDTO: {
          startTimeLocal: "2026-07-13T08:00:00.0",
          startTimeGMT: "2026-07-13T06:00:00.0",
          distance: 2100,
          movingDuration: 630,
          elapsedDuration: 640,
          averageHR: 150,
          maxHR: 170,
          averageRunCadence: 172,
          trainingEffect: 3.2,
          averagePower: 250,
          maxPower: 310,
          elevationGain: 12,
          elevationLoss: 8,
          minElevation: 10.2,
          maxElevation: 22.8,
          directWorkoutFeel: 75,
          directWorkoutRpe: 30,
        },
      },
      {
        lapDTOs: [
          { distance: 400, duration: 110, averageHR: 140, averagePower: 245, intensityType: "ACTIVE" },
          { distance: 1700, duration: 520, averageHR: 155, averagePower: 255, intensityType: "RECOVERY" },
        ],
      },
      {
        metricDescriptors: [
          { key: "sumDistance", metricsIndex: 0 },
          { key: "sumMovingDuration", metricsIndex: 1 },
          { key: "directHeartRate", metricsIndex: 2 },
          { key: "directPower", metricsIndex: 3 },
          { key: "directRunCadence", metricsIndex: 4 },
          { key: "directGradeAdjustedSpeed", metricsIndex: 5 },
          { key: "directElevation", metricsIndex: 6 },
        ],
        activityDetailMetrics: [
          { metrics: [0, 0, 130, 240, 84, 3.4, 10] },
          { metrics: [1000, 295, 145, 250, 86, 3.3, 15] },
          { metrics: [2000, 600, 155, 260, 88, 3.2, 12] },
          { metrics: [2100, 630, 160, 270, 90, 3.1, 14] },
        ],
      },
      [
        { zoneNumber: 1, secsInZone: 30.4, zoneLowBoundary: 100 },
        { zoneNumber: 2, secsInZone: 599.6, zoneLowBoundary: 130 },
      ],
      {
        temp: 86,
        apparentTemp: 89.6,
        relativeHumidity: 40,
        windSpeed: 5,
        windDirectionCompassPoint: "ne",
        weatherTypeDTO: { desc: "Fair" },
      },
    );

    assert.equal(report.run.distanceKm, 2.1);
    assert.equal(report.run.averagePacePerKm, "5:00");
    assert.equal(report.effort?.averagePowerW, 250);
    assert.equal(report.training?.aerobicEffect, 3.2);
    assert.equal(report.training?.workoutFeel, 75);
    assert.equal(report.training?.selfReportedRpe, 3);
    assert.equal(report.run.start, "2026-07-13T08:00:00.0+02:00");
    assert.deepEqual(report.environment, {
      conditions: "Fair",
      temperatureC: 30,
      apparentTemperatureC: 32,
      relativeHumidityPercent: 40,
      windSpeedKph: 8,
      windDirection: "NE",
      temperatureSource: "weather",
    });
    assert.deepEqual(report.heartRateZones, [
      { zone: 1, seconds: 30, lowerBoundaryBpm: 100 },
      { zone: 2, seconds: 600, lowerBoundaryBpm: 130 },
    ]);
    assert.deepEqual(report.splitsPerKm?.map((split) => split.pacePerKm), [
      "4:55",
      "5:05",
      "5:00",
    ]);
    assert.deepEqual(report.splitsPerKm?.[0], {
      km: 1,
      pacePerKm: "4:55",
      averageHeartRateBpm: 138,
      averagePowerW: 245,
      averageCadenceSpm: 170,
      gradeAdjustedPacePerKm: "4:59",
      elevationChangeM: 5,
    });
    assert.equal(report.recordedLaps?.length, 2);
    assert.deepEqual(report.recordedLaps?.map((lap) => lap.type), ["active", "recovery"]);
  });

  it("falls back to recorded laps when chart details are unavailable", () => {
    const report = normalizeGarminRun(
      {
        activityId: 456,
        activityName: "Run",
        summaryDTO: { distance: 1000, duration: 300 },
      },
      { lapDTOs: [{ distance: 1000, duration: 300, averageHR: 150 }] },
      {},
    );
    assert.deepEqual(report.recordedLaps, [
      { lap: 1, distanceKm: 1, time: "5:00", pacePerKm: "5:00", averageHeartRateBpm: 150 },
    ]);
  });

  it("omits recorded laps when they only duplicate kilometre splits", () => {
    const report = normalizeGarminRun(
      { activityId: 456, summaryDTO: { distance: 2000, duration: 600 } },
      { lapDTOs: [{ distance: 1000, duration: 300 }, { distance: 1000, duration: 300 }] },
      {
        metricDescriptors: [
          { key: "sumDistance", metricsIndex: 0 },
          { key: "sumMovingDuration", metricsIndex: 1 },
        ],
        activityDetailMetrics: [
          { metrics: [0, 0] },
          { metrics: [1000, 300] },
          { metrics: [2000, 600] },
        ],
      },
    );

    assert.equal(report.splitsPerKm?.length, 2);
    assert.equal(report.recordedLaps, undefined);
  });
});

describe("Markdown formatting", () => {
  it("labels the provider generically as a source", () => {
    const markdown = toMarkdown({
      run: { name: "Run", distanceKm: 5 },
      source: { id: "garmin", activityId: "123" },
    });
    assert.match(markdown, /Source ID: garmin 123/);
  });

  it("emits compact environment, zones, enriched splits, and distinct laps", () => {
    const markdown = toMarkdown({
      run: {
        name: "Hot Run",
        start: "2026-07-13T18:35:00.0",
        distanceKm: 2,
        elevationGainM: 5,
        elevationLossM: 4,
        minElevationM: 10,
        maxElevationM: 15,
      },
      environment: {
        conditions: "Fair",
        temperatureC: 30,
        apparentTemperatureC: 32,
        relativeHumidityPercent: 40,
        windSpeedKph: 8,
        windDirection: "NE",
        temperatureSource: "weather",
      },
      heartRateZones: [
        { zone: 1, seconds: 30, lowerBoundaryBpm: 100 },
        { zone: 2, seconds: 3600, lowerBoundaryBpm: 130 },
      ],
      splitsPerKm: [{
        km: 1,
        pacePerKm: "5:00",
        gradeAdjustedPacePerKm: "4:58",
        averageHeartRateBpm: 145,
        averagePowerW: 250,
        averageCadenceSpm: 172,
        elevationChangeM: 3,
      }],
      recordedLaps: [{ lap: 1, type: "recovery", distanceKm: 0.4, pacePerKm: "4:30" }],
      source: { id: "garmin", activityId: "123" },
    });

    assert.match(markdown, /30 °C; feels like 32 °C; 40% humidity; 8 km\/h wind NE/);
    assert.match(markdown, /Z1 0:30 \(≥100 bpm\); Z2 1:00:00 \(≥130 bpm\)/);
    assert.match(markdown, /## Kilometre splits[\s\S]+## Workout splits/);
    assert.match(markdown, /\| 1 \| 5:00 \| 4:58 \| 145 bpm \| 250 W \| 172 spm \| \+3 m \|/);
    assert.match(markdown, /\| 1 \| recovery \| 0.4 km \| 4:30/);
  });
});
