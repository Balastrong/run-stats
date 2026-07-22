import type { RunLap, RunReport, RunSplit } from "../../types.ts";
import type {
  GarminActivity,
  GarminDetails,
  GarminHeartRateZone,
  GarminMetricRow,
  GarminObject,
  GarminSplits,
  GarminWeather,
} from "./types.js";

export function normalizeGarminRun(
  rawActivity: GarminActivity,
  splits: GarminSplits,
  details: GarminDetails,
  rawHeartRateZones?: GarminHeartRateZone[],
  weather?: GarminWeather,
): RunReport {
  const activity = flattenActivity(rawActivity);
  const distance = number(activity.distance);
  const moving = number(first(activity, "movingDuration", "duration"));
  const elapsed = number(first(activity, "elapsedDuration", "duration"));
  const chartSplits = chartKilometreSplits(details);
  const report: RunReport = {
    run: compact({
      name: string(activity.activityName),
      start: activityStart(activity),
      sport: activityType(activity),
      distanceKm: rounded(distance / 1000, 2),
      movingTime: duration(moving),
      elapsedTime: duration(elapsed),
      averagePacePerKm: pace(moving, distance),
      elevationGainM: rounded(first(activity, "elevationGain", "totalAscent"), 0),
      elevationLossM: rounded(first(activity, "elevationLoss", "totalDescent"), 0),
      minElevationM: rounded(activity.minElevation, 1),
      maxElevationM: rounded(activity.maxElevation, 1),
    }),
    effort: compact({
      averageHeartRateBpm: rounded(first(activity, "averageHR", "averageHeartRate"), 0),
      maxHeartRateBpm: rounded(first(activity, "maxHR", "maxHeartRate"), 0),
      averageCadenceSpm: rounded(
        first(activity, "averageRunCadence", "averageRunningCadenceInStepsPerMinute"),
        0,
      ),
      caloriesKcal: rounded(first(activity, "calories", "caloriesConsumed"), 0),
      averagePowerW: rounded(activity.averagePower, 0),
      normalizedPowerW: rounded(activity.normalizedPower, 0),
      maxPowerW: rounded(activity.maxPower, 0),
    }),
    training: compact({
      aerobicEffect: rounded(first(activity, "aerobicTrainingEffect", "trainingEffect"), 1),
      anaerobicEffect: rounded(activity.anaerobicTrainingEffect, 1),
      primaryBenefit: string(activity.trainingEffectLabel),
      selfReportedRpe: garminRpe(activity.directWorkoutRpe),
      workoutFeel: rounded(activity.directWorkoutFeel, 0),
    }),
    runningDynamics: compact({
      gradeAdjustedPacePerKm: speedToPace(activity.avgGradeAdjustedSpeed),
      strideLengthCm: rounded(activity.strideLength, 1),
      verticalOscillationCm: rounded(activity.verticalOscillation, 1),
      verticalRatioPercent: rounded(activity.verticalRatio, 1),
      groundContactTimeMs: rounded(activity.groundContactTime, 0),
    }),
    impact: compact({
      bodyBatteryChange: rounded(activity.differenceBodyBattery, 0),
      estimatedSweatLossMl: rounded(activity.waterEstimated, 0),
    }),
    environment: normalizeEnvironment(activity, weather),
    heartRateZones: normalizeHeartRateZones(rawHeartRateZones),
    source: {
      id: "garmin",
      activityId: String(activity.activityId ?? "unknown"),
    },
  };

  if (chartSplits.length) report.splitsPerKm = chartSplits;
  const laps = (splits.lapDTOs ?? []).map(normalizeLap);
  if (laps.length && (!chartSplits.length || recordedLapsAreDistinct(laps))) {
    report.recordedLaps = laps;
  }
  removeEmptySections(report);
  return report;
}

function flattenActivity(activity: GarminActivity): GarminObject {
  const summary = isObject(activity.summaryDTO) ? activity.summaryDTO : {};
  const result: GarminObject = { ...activity, ...summary };
  result.activityType ??= activity.activityTypeDTO;
  return result;
}

function chartKilometreSplits(details: GarminDetails): RunSplit[] {
  const rows = details.activityDetailMetrics ?? [];
  const indices = new Map(
    (details.metricDescriptors ?? [])
      .filter((item) => item.key !== undefined && item.metricsIndex !== undefined)
      .map((item) => [item.key as string, item.metricsIndex as number]),
  );
  if (!rows.length || !indices.has("sumDistance") || !indices.has("sumMovingDuration")) return [];

  const totalDistance = metric(rows.at(-1), "sumDistance", indices) ?? 0;
  const result: RunSplit[] = [];
  let startIndex = 0;
  let startDistance = 0;
  for (let boundary = 1000; boundary <= totalDistance; boundary += 1000) {
    const relativeIndex = rows
      .slice(startIndex)
      .findIndex((row) => (metric(row, "sumDistance", indices) ?? 0) >= boundary);
    if (relativeIndex < 0) break;
    const endIndex = startIndex + relativeIndex;
    result.push(chartSegment(result.length + 1, rows, startIndex, endIndex, indices));
    startIndex = endIndex;
    startDistance = boundary;
  }
  if (totalDistance - startDistance >= 100) {
    result.push(chartSegment(roundNumber(totalDistance / 1000, 2), rows, startIndex, rows.length - 1, indices));
  }
  return result;
}

function chartSegment(
  label: number,
  rows: GarminMetricRow[],
  start: number,
  end: number,
  indices: Map<string, number>,
): RunSplit {
  const startRow = rows[start];
  const endRow = rows[end];
  const distance =
    (metric(endRow, "sumDistance", indices) ?? 0) - (metric(startRow, "sumDistance", indices) ?? 0);
  const seconds =
    (metric(endRow, "sumMovingDuration", indices) ?? 0) -
    (metric(startRow, "sumMovingDuration", indices) ?? 0);
  const heartRates = rows
    .slice(start, end + 1)
    .map((row) => metric(row, "directHeartRate", indices))
    .filter((value): value is number => value !== undefined);
  const averagePower = metricAverage(rows, start, end, indices, "directPower");
  const averageCadence =
    metricAverage(rows, start, end, indices, "directDoubleCadence") ??
    doubled(metricAverage(rows, start, end, indices, "directRunCadence"));
  const averageGradeAdjustedSpeed = metricAverage(
    rows,
    start,
    end,
    indices,
    "directGradeAdjustedSpeed",
  );
  const startElevation = metric(startRow, "directElevation", indices);
  const endElevation = metric(endRow, "directElevation", indices);
  return compact({
    km: label,
    pacePerKm: pace(seconds, distance),
    averageHeartRateBpm: heartRates.length
      ? Math.round(heartRates.reduce((sum, value) => sum + value, 0) / heartRates.length)
      : undefined,
    averagePowerW: rounded(averagePower, 0),
    averageCadenceSpm: rounded(averageCadence, 0),
    gradeAdjustedPacePerKm: speedToPace(averageGradeAdjustedSpeed),
    elevationChangeM:
      startElevation !== undefined && endElevation !== undefined
        ? roundNumber(endElevation - startElevation, 0)
        : undefined,
  });
}

function metricAverage(
  rows: GarminMetricRow[],
  start: number,
  end: number,
  indices: Map<string, number>,
  key: string,
): number | undefined {
  const values = rows
    .slice(start, end + 1)
    .map((row) => metric(row, key, indices))
    .filter((value): value is number => value !== undefined);
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : undefined;
}

function metric(
  row: GarminMetricRow | undefined,
  key: string,
  indices: Map<string, number>,
): number | undefined {
  const index = indices.get(key);
  if (!row?.metrics || index === undefined) return undefined;
  const value = row.metrics[index];
  return value === null || value === undefined ? undefined : value;
}

function normalizeLap(lap: GarminObject, index: number): RunLap {
  const distanceM = number(lap.distance);
  const seconds = number(first(lap, "movingDuration", "duration", "elapsedDuration"));
  return compact({
    lap: index + 1,
    type: string(lap.intensityType)?.replaceAll("_", " ").toLowerCase(),
    distanceKm: rounded(distanceM / 1000, 2),
    time: duration(seconds),
    pacePerKm: pace(seconds, distanceM),
    averageHeartRateBpm: rounded(first(lap, "averageHR", "averageHeartRate"), 0),
    averagePowerW: rounded(lap.averagePower, 0),
    averageCadenceSpm: rounded(lap.averageRunCadence, 0),
    gradeAdjustedPacePerKm: speedToPace(lap.avgGradeAdjustedSpeed),
    elevationGainM: rounded(lap.elevationGain, 0),
    elevationLossM: rounded(lap.elevationLoss, 0),
  });
}

function recordedLapsAreDistinct(laps: RunLap[]): boolean {
  return laps.slice(0, -1).some((lap) => {
    const distance = lap.distanceKm ?? 0;
    return distance < 0.95 || distance > 1.05;
  });
}

function normalizeHeartRateZones(
  zones: GarminHeartRateZone[] | undefined,
): RunReport["heartRateZones"] {
  if (!zones?.length) return undefined;
  return zones
    .filter((zone) => zone.zoneNumber !== undefined && zone.secsInZone !== undefined)
    .map((zone) => compact({
      zone: Number(zone.zoneNumber),
      seconds: roundNumber(Number(zone.secsInZone), 0),
      lowerBoundaryBpm: rounded(zone.zoneLowBoundary, 0),
    }));
}

function normalizeEnvironment(
  activity: GarminObject,
  weather: GarminWeather | undefined,
): RunReport["environment"] {
  const weatherTemperature = fahrenheitToCelsius(weather?.temp);
  const environment = compact({
    conditions: string(weather?.weatherTypeDTO?.desc),
    temperatureC:
      weatherTemperature ?? rounded(activity.averageTemperature, 0),
    apparentTemperatureC: fahrenheitToCelsius(weather?.apparentTemp),
    relativeHumidityPercent: rounded(weather?.relativeHumidity, 0),
    windSpeedKph: milesPerHourToKph(weather?.windSpeed),
    windDirection: string(weather?.windDirectionCompassPoint)?.toUpperCase(),
    temperatureSource: weatherTemperature !== undefined
      ? "weather" as const
      : activity.averageTemperature !== undefined
        ? "activity" as const
        : undefined,
  });
  return Object.keys(environment).length ? environment : undefined;
}

function activityStart(activity: GarminObject): string | undefined {
  const local = string(activity.startTimeLocal);
  const gmt = string(activity.startTimeGMT);
  if (local && gmt && !hasTimeZone(local)) {
    const localMs = Date.parse(`${local}Z`);
    const gmtMs = Date.parse(`${gmt}Z`);
    if (Number.isFinite(localMs) && Number.isFinite(gmtMs)) {
      const offsetMinutes = Math.round((localMs - gmtMs) / 60_000);
      const sign = offsetMinutes >= 0 ? "+" : "-";
      const absolute = Math.abs(offsetMinutes);
      return `${local}${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
    }
  }
  if (local) return local;
  return gmt && !hasTimeZone(gmt) ? `${gmt}Z` : gmt;
}

function hasTimeZone(value: string): boolean {
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
}

function fahrenheitToCelsius(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? roundNumber((numeric - 32) * 5 / 9, 0) : undefined;
}

function milesPerHourToKph(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? roundNumber(numeric * 1.609344, 0) : undefined;
}

function doubled(value: number | undefined): number | undefined {
  return value === undefined ? undefined : value * 2;
}

function garminRpe(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? roundNumber(numeric / 10, 1) : undefined;
}

function activityType(activity: GarminObject): string | undefined {
  const value = activity.activityType;
  return isObject(value) ? string(value.typeKey) : string(value);
}

function removeEmptySections(report: RunReport): void {
  for (const key of ["effort", "training", "runningDynamics", "impact", "environment"] as const) {
    if (Object.keys(report[key] ?? {}).length === 0) delete report[key];
  }
}

function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function first(source: GarminObject, ...keys: string[]): unknown {
  return keys.map((key) => source[key]).find((value) => value !== null && value !== undefined);
}

function number(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function string(value: unknown): string | undefined {
  return typeof value === "string" && value.length ? value : undefined;
}

function rounded(value: unknown, places: number): number | undefined {
  if (value === undefined || value === null) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? roundNumber(numeric, places) : undefined;
}

function roundNumber(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function duration(seconds: number): string | undefined {
  if (!seconds) return undefined;
  const whole = Math.round(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remainder = whole % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function pace(seconds: number, metres: number): string | undefined {
  if (!seconds || !metres) return undefined;
  const paceSeconds = Math.round(seconds / (metres / 1000));
  return `${Math.floor(paceSeconds / 60)}:${String(paceSeconds % 60).padStart(2, "0")}`;
}

function speedToPace(value: unknown): string | undefined {
  const speed = Number(value);
  return Number.isFinite(speed) && speed > 0 ? pace(1000 / speed, 1000) : undefined;
}

function isObject(value: unknown): value is GarminObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
