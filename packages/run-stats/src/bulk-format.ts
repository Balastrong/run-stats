import type { RunSummary } from "./types.ts";

export function toBulkText(runs: RunSummary[]): string {
  const lines = [
    "# Garmin running activities",
    `Runs: ${runs.length}`,
    "",
  ];
  for (const [index, run] of runs.entries()) {
    const fields = [
      dateTime(run.start),
      run.name,
      optional(run.location),
      unit(run.distanceKm, "km"),
      run.movingSeconds === undefined ? undefined : `${duration(run.movingSeconds)} moving`,
      run.elapsedSeconds === undefined ? undefined : `${duration(run.elapsedSeconds)} elapsed`,
      pace(run.movingSeconds, run.distanceKm),
      heartRate(run.averageHeartRateBpm, run.maxHeartRateBpm),
      unit(run.averageCadenceSpm, "spm cadence"),
      power(run.averagePowerW, run.maxPowerW),
      elevation(run.elevationGainM, run.elevationLossM),
      unit(run.caloriesKcal, "kcal"),
      trainingEffect(run.aerobicEffect, run.anaerobicEffect),
      `ID ${run.id}`,
    ].filter((field): field is string => field !== undefined);
    lines.push(`${index + 1}. ${fields.join(" | ")}`);
    if (run.workoutPhases?.length) {
      lines.push(`   - Workout phases: ${run.workoutPhases.map(workoutPhase).join("; ")}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function workoutPhase(phase: NonNullable<RunSummary["workoutPhases"]>[number]): string {
  const values = [
    phase.count === undefined ? phase.type : `${phase.type} ${phase.count}×`,
    phase.durationSeconds === undefined ? undefined : duration(phase.durationSeconds),
    unit(phase.distanceKm, "km"),
    pace(phase.durationSeconds, phase.distanceKm),
  ].filter((value): value is string => value !== undefined);
  return values.join(", ");
}

function dateTime(value: string | undefined): string | undefined {
  return value?.replace("T", " ").replace(/\.\d+$/, "");
}

function optional(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

function unit(value: number | undefined, suffix: string): string | undefined {
  return value === undefined ? undefined : `${value} ${suffix}`;
}

function duration(seconds: number): string {
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainder = rounded % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function pace(seconds: number | undefined, distanceKm: number | undefined): string | undefined {
  if (seconds === undefined || distanceKm === undefined || distanceKm <= 0) return undefined;
  return `${duration(seconds / distanceKm)}/km`;
}

function heartRate(average: number | undefined, maximum: number | undefined): string | undefined {
  if (average === undefined && maximum === undefined) return undefined;
  if (average !== undefined && maximum !== undefined) return `HR ${average} avg / ${maximum} max bpm`;
  return `HR ${average ?? maximum} ${average === undefined ? "max" : "avg"} bpm`;
}

function power(average: number | undefined, maximum: number | undefined): string | undefined {
  if (average === undefined && maximum === undefined) return undefined;
  if (average !== undefined && maximum !== undefined) return `${average} avg / ${maximum} max W`;
  return `${average ?? maximum} ${average === undefined ? "max" : "avg"} W`;
}

function elevation(gain: number | undefined, loss: number | undefined): string | undefined {
  if (gain === undefined && loss === undefined) return undefined;
  return `elevation +${gain ?? "?"}/-${loss ?? "?"} m`;
}

function trainingEffect(aerobic: number | undefined, anaerobic: number | undefined): string | undefined {
  if (aerobic === undefined && anaerobic === undefined) return undefined;
  const values = [
    aerobic === undefined ? undefined : `${aerobic} aerobic`,
    anaerobic === undefined ? undefined : `${anaerobic} anaerobic`,
  ].filter(Boolean);
  return `TE ${values.join(" / ")}`;
}
