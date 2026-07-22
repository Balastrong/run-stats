import type { RunReport } from "./types.ts";

export function toMarkdown(report: RunReport): string {
  const run = report.run;
  const lines = [
    "# Run stats",
    "",
    `- Run: ${run.name ?? "Run"} (${run.start ?? "unknown date"})`,
    `- Distance: ${display(run.distanceKm)} km`,
    `- Time: ${run.movingTime ?? "n/a"} moving, ${run.elapsedTime ?? "n/a"} elapsed`,
    `- Average pace: ${run.averagePacePerKm ?? "n/a"}/km`,
    `- Elevation: ${display(run.elevationGainM)} m gain, ${display(run.elevationLossM)} m loss${elevationRange(run.minElevationM, run.maxElevationM)}`,
  ];

  const effort = report.effort;
  if (effort) {
    const bits: string[] = [];
    if (effort.averageHeartRateBpm !== undefined) {
      bits.push(
        `HR ${effort.averageHeartRateBpm} avg / ${display(effort.maxHeartRateBpm)} max bpm`,
      );
    }
    if (effort.averageCadenceSpm !== undefined)
      bits.push(`cadence ${effort.averageCadenceSpm} spm`);
    if (effort.caloriesKcal !== undefined)
      bits.push(`${effort.caloriesKcal} kcal`);
    if (bits.length) lines.push(`- Effort: ${bits.join("; ")}`);
    if (effort.averagePowerW !== undefined) {
      lines.push(
        `- Power: ${effort.averagePowerW} W average, ${display(effort.normalizedPowerW)} W normalized, ${display(effort.maxPowerW)} W max`,
      );
    }
  }

  if (report.training) {
    const bits: string[] = [];
    const training = report.training;
    if (training.aerobicEffect !== undefined)
      bits.push(`aerobic effect ${training.aerobicEffect}`);
    if (training.anaerobicEffect !== undefined)
      bits.push(`anaerobic effect ${training.anaerobicEffect}`);
    if (training.primaryBenefit)
      bits.push(training.primaryBenefit.replaceAll("_", " ").toLowerCase());
    if (training.selfReportedRpe !== undefined)
      bits.push(`self-reported RPE ${training.selfReportedRpe}/10`);
    if (training.workoutFeel !== undefined)
      bits.push(`workout feel ${workoutFeelLabel(training.workoutFeel)} (${training.workoutFeel}/100)`);
    if (bits.length) lines.push(`- Training: ${bits.join("; ")}`);
  }

  if (report.runningDynamics) {
    const bits: string[] = [];
    const dynamics = report.runningDynamics;
    if (dynamics.gradeAdjustedPacePerKm)
      bits.push(`GAP ${dynamics.gradeAdjustedPacePerKm}/km`);
    if (dynamics.strideLengthCm !== undefined)
      bits.push(`stride ${dynamics.strideLengthCm} cm`);
    if (dynamics.verticalOscillationCm !== undefined)
      bits.push(`vertical oscillation ${dynamics.verticalOscillationCm} cm`);
    if (dynamics.verticalRatioPercent !== undefined)
      bits.push(`vertical ratio ${dynamics.verticalRatioPercent}%`);
    if (dynamics.groundContactTimeMs !== undefined)
      bits.push(`ground contact ${dynamics.groundContactTimeMs} ms`);
    if (bits.length) lines.push(`- Running dynamics: ${bits.join("; ")}`);
  }

  if (report.impact) {
    const bits: string[] = [];
    if (report.impact.bodyBatteryChange !== undefined)
      bits.push(`Body Battery ${report.impact.bodyBatteryChange}`);
    if (report.impact.estimatedSweatLossMl !== undefined)
      bits.push(
        `estimated sweat loss ${report.impact.estimatedSweatLossMl} ml`,
      );
    if (bits.length) lines.push(`- Impact: ${bits.join("; ")}`);
  }

  if (report.environment) {
    const environment = report.environment;
    const bits: string[] = [];
    if (environment.conditions) bits.push(environment.conditions.toLowerCase());
    if (environment.temperatureC !== undefined)
      bits.push(`${environment.temperatureC} °C${environment.temperatureSource === "activity" ? " recorded" : ""}`);
    if (environment.apparentTemperatureC !== undefined)
      bits.push(`feels like ${environment.apparentTemperatureC} °C`);
    if (environment.relativeHumidityPercent !== undefined)
      bits.push(`${environment.relativeHumidityPercent}% humidity`);
    if (environment.windSpeedKph !== undefined)
      bits.push(`${environment.windSpeedKph} km/h wind${environment.windDirection ? ` ${environment.windDirection}` : ""}`);
    if (bits.length) lines.push(`- Environment: ${bits.join("; ")}`);
  }

  if (report.heartRateZones?.length) {
    lines.push(`- HR zones: ${report.heartRateZones.map((zone) =>
      `Z${zone.zone} ${formatSeconds(zone.seconds)}${zone.lowerBoundaryBpm !== undefined ? ` (≥${zone.lowerBoundaryBpm} bpm)` : ""}`
    ).join("; ")}`);
  }

  if (report.splitsPerKm?.length) {
    lines.push(
      "",
      "## Kilometre splits",
      "",
      "| km | pace | GAP | avg HR | avg power | cadence | elev Δ |",
      "|---:|:---:|:---:|---:|---:|---:|---:|",
    );
    for (const split of report.splitsPerKm) {
      lines.push(
        `| ${split.km} | ${split.pacePerKm ?? "—"} | ${split.gradeAdjustedPacePerKm ?? "—"} | ${unit(split.averageHeartRateBpm, "bpm")} | ${unit(split.averagePowerW, "W")} | ${unit(split.averageCadenceSpm, "spm")} | ${signedUnit(split.elevationChangeM, "m")} |`,
      );
    }
  }

  if (report.recordedLaps?.length) {
    lines.push(
      "",
      "## Workout splits",
      "",
      "| lap | type | distance | pace | GAP | avg HR | avg power | cadence | elevation |",
      "|---:|:---:|---:|:---:|:---:|---:|---:|---:|:---:|",
    );
    for (const lap of report.recordedLaps) {
      lines.push(
        `| ${lap.lap} | ${lap.type ?? "—"} | ${display(lap.distanceKm)} km | ${lap.pacePerKm ?? "—"} | ${lap.gradeAdjustedPacePerKm ?? "—"} | ${unit(lap.averageHeartRateBpm, "bpm")} | ${unit(lap.averagePowerW, "W")} | ${unit(lap.averageCadenceSpm, "spm")} | ${lapElevation(lap.elevationGainM, lap.elevationLossM)} |`,
      );
    }
  }

  lines.push("", `Source ID: ${report.source.id} ${report.source.activityId}`);
  return `${lines.join("\n")}\n`;
}

function elevationRange(minimum: number | undefined, maximum: number | undefined): string {
  return minimum !== undefined && maximum !== undefined
    ? `; ${minimum}–${maximum} m range`
    : "";
}

function workoutFeelLabel(value: number): string {
  if (value >= 100) return "very strong";
  if (value >= 75) return "strong";
  if (value >= 50) return "normal";
  if (value >= 25) return "weak";
  return "very weak";
}

function formatSeconds(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remainder = whole % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function unit(value: number | undefined, suffix: string): string {
  return value === undefined ? "—" : `${value} ${suffix}`;
}

function signedUnit(value: number | undefined, suffix: string): string {
  return value === undefined ? "—" : `${value > 0 ? "+" : ""}${value} ${suffix}`;
}

function lapElevation(gain: number | undefined, loss: number | undefined): string {
  if (gain === undefined && loss === undefined) return "—";
  return `+${gain ?? "—"}/-${loss ?? "—"} m`;
}

function display(value: unknown, fallback = "n/a"): string {
  return value === undefined || value === null ? fallback : String(value);
}
