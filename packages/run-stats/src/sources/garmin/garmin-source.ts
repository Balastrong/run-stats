import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type {
  RunReference,
  RunReport,
  RunSource,
  RunSummary,
  WorkoutPhaseSummary,
} from "../../types.ts";
import { defaultGarminTokenFile, type GarminTokens } from "./auth.ts";
import { normalizeGarminRun } from "./normalize.ts";
import type {
  GarminActivity,
  GarminDetails,
  GarminHeartRateZone,
  GarminSplits,
  GarminWeather,
} from "./types.ts";

const CONNECT_API = "https://connectapi.garmin.com";
const TOKEN_URL = "https://diauth.garmin.com/di-oauth2-service/oauth/token";
const NATIVE_HEADERS = {
  "User-Agent": "GCM-Android-5.23",
  "X-Garmin-User-Agent":
    "com.garmin.android.apps.connectmobile/5.23; ; Google/sdk_gphone64_arm64/google; Android/33; Dalvik/2.1.0",
  "X-Garmin-Paired-App-Version": "10861",
  "X-Garmin-Client-Platform": "Android",
  "X-App-Ver": "10861",
  "X-Lang": "en",
  "X-GCExperience": "GC5",
  "Accept-Language": "en-US,en;q=0.9",
} as const;

export class GarminSource implements RunSource {
  readonly id = "garmin";
  readonly displayName = "Garmin Connect";
  readonly #tokenStore: GarminTokenStore;
  #client?: GarminApiClient;

  constructor(
    tokenStore: string | GarminTokenStore =
      process.env.GARMIN_TOKEN_FILE ?? defaultGarminTokenFile(),
  ) {
    this.#tokenStore =
      typeof tokenStore === "string" ? new FileGarminTokenStore(tokenStore) : tokenStore;
  }

  async recentRuns(limit: number): Promise<RunReference[]> {
    return (await this.runSummaries(limit)).map(({ id, name, start, distanceKm }) =>
      compact({ id, name, start, distanceKm })
    );
  }

  async runSummaries(limit: number): Promise<RunSummary[]> {
    const client = await this.#connect();
    const runs: GarminActivity[] = [];
    let start = 0;
    while (runs.length < limit) {
      const pageSize = Math.min(limit - runs.length, 100);
      const activities = await client.get<GarminActivity[]>(
        `/activitylist-service/activities/search/activities?activityType=running&limit=${pageSize}&start=${start}&excludeChildren=false`,
      );
      runs.push(...activities.filter(isRun));
      if (activities.length < pageSize) break;
      start += activities.length;
    }
    return runs.slice(0, limit).map(toRunSummary);
  }

  async getRun(id: string): Promise<RunReport> {
    const client = await this.#connect();
    if (!/^\d+$/.test(id)) throw new Error(`Invalid Garmin activity ID '${id}'`);
    const activity = await client.get<GarminActivity>(`/activity-service/activity/${id}`);
    const [splits, details, heartRateZones, weather] = await Promise.all([
      client.get<GarminSplits>(`/activity-service/activity/${id}/splits`),
      client.get<GarminDetails>(
        `/activity-service/activity/${id}/details?maxChartSize=4000&maxPolylineSize=0`,
      ),
      client.getOptional<GarminHeartRateZone[]>(
        `/activity-service/activity/${id}/hrTimeInZones`,
      ),
      client.getOptional<GarminWeather>(`/activity-service/activity/${id}/weather`),
    ]);
    return normalizeGarminRun(activity, splits, details, heartRateZones, weather);
  }

  async #connect(): Promise<GarminApiClient> {
    if (this.#client) return this.#client;
    try {
      const parsed = await this.#tokenStore.load();
      if (!parsed.di_token || !parsed.di_refresh_token || !parsed.di_client_id) {
        throw new Error("session is missing DI token fields");
      }
      this.#client = new GarminApiClient(parsed as GarminTokens, this.#tokenStore);
      return this.#client;
    } catch (error) {
      throw new Error(
        `No valid Garmin session found in ${this.#tokenStore.description}.`,
        { cause: error },
      );
    }
  }
}

export interface GarminTokenStore {
  readonly description: string;
  load(): Promise<Partial<GarminTokens>>;
  save(tokens: GarminTokens): Promise<void>;
}

class FileGarminTokenStore implements GarminTokenStore {
  readonly description: string;
  readonly #tokenFile: string;

  constructor(tokenFile: string) {
    this.#tokenFile = tokenFile;
    this.description = `${tokenFile}. Set GARMIN_TOKEN_FILE if your token is elsewhere`;
  }

  async load(): Promise<Partial<GarminTokens>> {
    return JSON.parse(await readFile(this.#tokenFile, "utf8")) as Partial<GarminTokens>;
  }

  async save(tokens: GarminTokens): Promise<void> {
    await mkdir(dirname(this.#tokenFile), { recursive: true, mode: 0o700 });
    await writeFile(this.#tokenFile, `${JSON.stringify(tokens, null, 2)}\n`, { mode: 0o600 });
    await chmod(this.#tokenFile, 0o600).catch(() => undefined);
  }
}

class GarminApiClient {
  private tokens: GarminTokens;
  private readonly tokenStore: GarminTokenStore;

  constructor(tokens: GarminTokens, tokenStore: GarminTokenStore) {
    this.tokens = tokens;
    this.tokenStore = tokenStore;
  }

  async get<T>(path: string): Promise<T> {
    const response = await this.request(path);
    if (!response.ok) throw new Error(`Garmin request failed (${response.status}): ${await response.text()}`);
    return (await response.json()) as T;
  }

  async getOptional<T>(path: string): Promise<T | undefined> {
    const response = await this.request(path);
    if (!response.ok && response.status !== 401) return undefined;
    if (!response.ok) throw new Error(`Garmin request failed (${response.status}): ${await response.text()}`);
    return (await response.json()) as T;
  }

  private async request(path: string): Promise<Response> {
    if (tokenExpiresSoon(this.tokens.di_token)) await this.refresh();
    let response = await fetch(`${CONNECT_API}${path}`, { headers: this.headers() });
    if (response.status === 401) {
      await this.refresh();
      response = await fetch(`${CONNECT_API}${path}`, { headers: this.headers() });
    }
    return response;
  }

  private async refresh(): Promise<void> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.tokens.di_client_id,
      refresh_token: this.tokens.di_refresh_token,
    });
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        ...NATIVE_HEADERS,
        Authorization: `Basic ${Buffer.from(`${this.tokens.di_client_id}:`).toString("base64")}`,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
      },
      body,
    });
    if (!response.ok) throw new Error(`Garmin token refresh failed (${response.status}): ${await response.text()}`);
    const result = (await response.json()) as { access_token: string; refresh_token?: string };
    this.tokens = {
      di_token: result.access_token,
      di_refresh_token: result.refresh_token ?? this.tokens.di_refresh_token,
      di_client_id: jwtClientId(result.access_token) ?? this.tokens.di_client_id,
    };
    await this.tokenStore.save(this.tokens);
  }

  private headers(): Record<string, string> {
    return { ...NATIVE_HEADERS, Authorization: `Bearer ${this.tokens.di_token}`, Accept: "application/json" };
  }
}

function isRun(activity: GarminActivity): boolean {
  const type = activity.activityType?.typeKey ?? activity.activityTypeDTO?.typeKey ?? "";
  return type.toLowerCase().includes("run");
}

function toRunSummary(raw: GarminActivity): RunSummary {
  const activity = { ...raw.summaryDTO, ...raw };
  const distanceM = numberValue(activity, "distance");
  return compact({
    id: String(raw.activityId),
    name: raw.activityName ?? "Run",
    start: textValue(activity, "startTimeLocal", "startTimeGMT"),
    location: textValue(activity, "locationName"),
    distanceKm: distanceM === undefined ? undefined : round(distanceM / 1000, 2),
    movingSeconds: numberValue(activity, "movingDuration", "duration"),
    elapsedSeconds: numberValue(activity, "elapsedDuration"),
    averageHeartRateBpm: roundedValue(activity, "averageHR", "averageHeartRate"),
    maxHeartRateBpm: roundedValue(activity, "maxHR", "maxHeartRate"),
    averageCadenceSpm: roundedValue(
      activity,
      "averageRunningCadenceInStepsPerMinute",
      "averageRunCadence",
      "averageCadence",
    ),
    caloriesKcal: roundedValue(activity, "calories", "caloriesConsumed"),
    averagePowerW: roundedValue(activity, "averagePower", "avgPower"),
    maxPowerW: roundedValue(activity, "maxPower"),
    elevationGainM: roundedValue(activity, "elevationGain", "totalAscent"),
    elevationLossM: roundedValue(activity, "elevationLoss", "totalDescent"),
    aerobicEffect: numberValue(activity, "aerobicTrainingEffect", "trainingEffect"),
    anaerobicEffect: numberValue(activity, "anaerobicTrainingEffect"),
    workoutPhases: workoutPhases(activity),
  });
}

function workoutPhases(activity: Record<string, unknown>): WorkoutPhaseSummary[] | undefined {
  if (!Array.isArray(activity.splitSummaries)) return undefined;
  const phases = activity.splitSummaries.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const split = value as Record<string, unknown>;
    const splitType = textValue(split, "splitType");
    if (!splitType?.startsWith("INTERVAL_")) return [];
    const distanceM = numberValue(split, "distance");
    return [compact({
      type: splitType.slice("INTERVAL_".length).toLowerCase(),
      count: roundedValue(split, "noOfSplits"),
      durationSeconds: numberValue(split, "duration"),
      distanceKm: distanceM === undefined ? undefined : round(distanceM / 1000, 2),
    })];
  });
  const order = new Map(["warmup", "active", "recovery", "cooldown"].map((type, index) => [type, index]));
  phases.sort((left, right) => (order.get(left.type) ?? 99) - (order.get(right.type) ?? 99));
  return phases.length > 0 ? phases : undefined;
}

function numberValue(object: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = object[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function roundedValue(object: Record<string, unknown>, ...keys: string[]): number | undefined {
  const value = numberValue(object, ...keys);
  return value === undefined ? undefined : Math.round(value);
}

function textValue(object: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    if (typeof object[key] === "string") return object[key];
  }
  return undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function tokenExpiresSoon(token: string): boolean {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as {
      exp?: number;
    };
    return !payload.exp || payload.exp <= Math.floor(Date.now() / 1000) + 60;
  } catch {
    return true;
  }
}

function jwtClientId(token: string): string | undefined {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as {
      client_id?: string;
    };
    return payload.client_id;
  } catch {
    return undefined;
  }
}
