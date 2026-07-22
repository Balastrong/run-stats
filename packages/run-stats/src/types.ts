export interface RunReference {
  id: string;
  name: string;
  start?: string;
  distanceKm?: number;
}

export interface RunSummary extends RunReference {
  location?: string;
  movingSeconds?: number;
  elapsedSeconds?: number;
  averageHeartRateBpm?: number;
  maxHeartRateBpm?: number;
  averageCadenceSpm?: number;
  caloriesKcal?: number;
  averagePowerW?: number;
  maxPowerW?: number;
  elevationGainM?: number;
  elevationLossM?: number;
  aerobicEffect?: number;
  anaerobicEffect?: number;
  workoutPhases?: WorkoutPhaseSummary[];
}

export interface WorkoutPhaseSummary {
  type: string;
  count?: number;
  durationSeconds?: number;
  distanceKm?: number;
}

export interface RunSource {
  readonly id: string;
  readonly displayName: string;
  recentRuns(limit: number): Promise<RunReference[]>;
  getRun(id: string): Promise<RunReport>;
}

export interface RunReport {
  run: {
    name?: string;
    start?: string;
    sport?: string;
    distanceKm?: number;
    movingTime?: string;
    elapsedTime?: string;
    averagePacePerKm?: string;
    elevationGainM?: number;
    elevationLossM?: number;
    minElevationM?: number;
    maxElevationM?: number;
  };
  effort?: {
    averageHeartRateBpm?: number;
    maxHeartRateBpm?: number;
    averageCadenceSpm?: number;
    caloriesKcal?: number;
    averagePowerW?: number;
    normalizedPowerW?: number;
    maxPowerW?: number;
  };
  training?: {
    aerobicEffect?: number;
    anaerobicEffect?: number;
    primaryBenefit?: string;
    selfReportedRpe?: number;
    workoutFeel?: number;
  };
  runningDynamics?: {
    gradeAdjustedPacePerKm?: string;
    strideLengthCm?: number;
    verticalOscillationCm?: number;
    verticalRatioPercent?: number;
    groundContactTimeMs?: number;
  };
  impact?: {
    bodyBatteryChange?: number;
    estimatedSweatLossMl?: number;
  };
  environment?: {
    conditions?: string;
    temperatureC?: number;
    apparentTemperatureC?: number;
    relativeHumidityPercent?: number;
    windSpeedKph?: number;
    windDirection?: string;
    temperatureSource?: "weather" | "activity";
  };
  heartRateZones?: HeartRateZone[];
  splitsPerKm?: RunSplit[];
  recordedLaps?: RunLap[];
  source: {
    id: string;
    activityId: string;
  };
}

export interface RunSplit {
  km: number;
  pacePerKm?: string;
  averageHeartRateBpm?: number;
  averagePowerW?: number;
  averageCadenceSpm?: number;
  gradeAdjustedPacePerKm?: string;
  elevationChangeM?: number;
}

export interface RunLap {
  lap: number;
  type?: string;
  distanceKm?: number;
  time?: string;
  pacePerKm?: string;
  averageHeartRateBpm?: number;
  averagePowerW?: number;
  averageCadenceSpm?: number;
  gradeAdjustedPacePerKm?: string;
  elevationGainM?: number;
  elevationLossM?: number;
}

export interface HeartRateZone {
  zone: number;
  seconds: number;
  lowerBoundaryBpm?: number;
}
