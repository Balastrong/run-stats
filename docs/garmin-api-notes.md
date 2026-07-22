# Garmin API notes

Living reference for Garmin Connect behavior observed while developing `run-stats`.

Garmin Connect's consumer endpoints are undocumented and may change without notice. Unless a section explicitly says otherwise, these notes describe observed behavior rather than a supported public contract.

Last reviewed: 2026-07-13

## Integration overview

The project currently uses Garmin Connect's native/mobile API with a DI OAuth bearer token:

- API host: `https://connectapi.garmin.com`
- Token host: `https://diauth.garmin.com`
- Saved token fields: `di_token`, `di_refresh_token`, and `di_client_id`
- Implementation: [`packages/run-stats/src/sources/garmin/garmin-source.ts`](../packages/run-stats/src/sources/garmin/garmin-source.ts)
- Authentication: [`packages/run-stats/src/sources/garmin/auth.ts`](../packages/run-stats/src/sources/garmin/auth.ts)

The Garmin Connect website uses paths such as:

```text
https://connect.garmin.com/gc-api/activitylist-service/activities/search/activities
```

The corresponding native API request drops the `/gc-api` proxy prefix and uses the `connectapi` host:

```text
https://connectapi.garmin.com/activitylist-service/activities/search/activities
```

The web and native routes expose the same underlying service, although authentication and required headers differ.

## Authentication and headers

Native requests currently imitate the Garmin Connect Android client and include Garmin-specific client headers plus:

```http
Authorization: Bearer <di_token>
Accept: application/json
```

The DI access token is a JWT. The client refreshes it shortly before expiry and retries a request once after an HTTP `401`.

Token files contain reusable account credentials and must remain private. The project writes them with owner-only permissions (`0600`) and creates their directory with `0700` permissions.

### Original-file downloads use a different Accept header

Observed endpoint:

```text
GET /download-service/files/activity/{activityId}
```

This returns Garmin's original activity as a ZIP archive, normally containing a FIT file.

Sending `Accept: application/json` produced:

```text
HTTP 406 NotAcceptableException
```

Known Garmin clients override the download request to:

```http
Accept: */*
```

Keep JSON and binary request headers separate if original-file downloads are reintroduced.

## Running activity list

The bulk summary uses:

```text
GET /activitylist-service/activities/search/activities
    ?activityType=running
    &limit={pageSize}
    &start={offset}
    &excludeChildren=false
```

Observed pagination behavior:

- `start` is a zero-based result offset.
- `limit` is the requested page size.
- The project uses pages of at most 100 activities.
- A page shorter than the requested size is treated as the end.
- Fifty runs therefore normally require one request; 250 runs require three.

This endpoint returns summary information for many runs at once. It avoids the much larger request fan-out required for full per-activity reports.

## Useful fields in an activity-list entry

The following fields have been observed in a running activity entry. Presence varies by device, activity type, sensors, and workout structure.

### Identity and timing

- `activityId`
- `activityUUID`
- `activityName`
- `activityType.typeKey`
- `startTimeLocal`
- `startTimeGMT`
- `endTimeGMT`
- `beginTimestamp`
- `timeZoneId`
- `locationName`

Date formatting is not guaranteed to be identical across endpoints. Activity-list samples use `YYYY-MM-DD HH:mm:ss`, while detail payloads may use `YYYY-MM-DDTHH:mm:ss.s`.

### Core totals

- `distance` — metres
- `duration`, `movingDuration`, `elapsedDuration` — seconds, sometimes fractional
- `elevationGain`, `elevationLoss` — metres
- `minElevation`, `maxElevation`, `avgElevation` — metres
- `averageSpeed`, `maxSpeed`, `avgGradeAdjustedSpeed` — metres per second
- `calories`, `bmrCalories` — kcal
- `steps`
- `waterEstimated` — millilitres

### Effort and running dynamics

- `averageHR`, `maxHR` — bpm
- `averageRunningCadenceInStepsPerMinute`
- `maxRunningCadenceInStepsPerMinute`
- `avgPower`, `maxPower`, `normPower` — watts
- `avgVerticalOscillation`
- `avgGroundContactTime`
- `avgStrideLength`
- `avgVerticalRatio`
- `vO2MaxValue`
- `differenceBodyBattery`

Field names differ between list and detail endpoints. Known aliases include:

- `avgPower` / `averagePower`
- `averageHR` / `averageHeartRate`
- `averageRunningCadenceInStepsPerMinute` / `averageRunCadence`
- `elevationGain` / `totalAscent`
- `elevationLoss` / `totalDescent`

### Training information

- `aerobicTrainingEffect`
- `anaerobicTrainingEffect`
- `trainingEffectLabel`
- `aerobicTrainingEffectMessage`
- `anaerobicTrainingEffectMessage`
- `workoutId`
- `moderateIntensityMinutes`
- `vigorousIntensityMinutes`

### Zone totals

Some entries include flat time-in-zone fields directly in the list response:

- `hrTimeInZone_1` through `hrTimeInZone_5`
- `powerTimeInZone_1` through `powerTimeInZone_5`

Values are seconds and may be fractional. These are totals only; zone boundaries are not included.

## Workout split summaries

Structured runs may include:

- `hasSplits`
- `hasIntensityIntervals`
- `lapCount`
- `minActivityLapDuration`
- `splitSummaries`

`splitSummaries` is already part of the activity-list response, so using it adds no API calls.

Observed workout-related `splitType` values:

- `INTERVAL_WARMUP`
- `INTERVAL_ACTIVE`
- `INTERVAL_RECOVERY`
- `INTERVAL_COOLDOWN`

Each summary can contain:

- `noOfSplits` — number of matching workout steps
- `duration` — combined duration in seconds
- `distance` — combined distance in metres
- `averageSpeed`, `maxSpeed`
- `totalAscent`, `elevationLoss`
- `maxDistance`

Important limitation: these are aggregates grouped by split type. For example, five active repetitions appear as one `INTERVAL_ACTIVE` summary with `noOfSplits: 5`, combined time, and combined distance. The list response does not expose each repetition individually.

Other observed split types include `RWD_RUN`, `RWD_WALK`, and `RWD_STAND`. They describe movement classification and can overlap the whole activity, so the bulk formatter intentionally includes only `INTERVAL_*` workout phases.

The bulk output calculates phase pace from aggregate duration and distance. Small differences are possible because Garmin's distance values and the displayed kilometres are rounded.

### Fastest split fields

The list response may also contain:

- `fastestSplit_1000`
- `fastestSplit_1609`
- `fastestSplit_5000`
- `fastestSplit_10000`

These are fastest elapsed times for fixed distances, not workout steps. The bulk formatter intentionally ignores them.

## Full per-activity data

The existing detailed report uses up to five requests per activity:

```text
GET /activity-service/activity/{id}
GET /activity-service/activity/{id}/splits
GET /activity-service/activity/{id}/details?maxChartSize=4000&maxPolylineSize=0
GET /activity-service/activity/{id}/hrTimeInZones
GET /activity-service/activity/{id}/weather
```

The endpoints provide different layers:

- Activity: metadata and summary metrics.
- Splits: recorded laps and workout steps.
- Details: chart samples used to calculate kilometre splits and running dynamics.
- HR zones: time plus zone boundaries.
- Weather: conditions near the activity.

Fetching a rich report for 50 runs can therefore require about 251 requests including the list request. This is why bulk mode uses list summaries only.

## Rate limiting and failure behavior

Garmin does not publish a quota for these consumer endpoints. Treat the limit as unknown and changeable.

Known behavior and precautions:

- HTTP `429` means Garmin has temporarily throttled requests.
- Do not retry `429` responses in a tight loop.
- Honor `Retry-After` when Garmin supplies it.
- Repeated login attempts appear more sensitive than ordinary authenticated reads.
- Community reports describe temporary login/API blocks lasting longer than 48 hours, but no reliable cooldown duration is documented.
- Permanent suspension is possible under Garmin's terms for abusive or unauthorized automation, even though a small personal export is more likely to receive a temporary throttle.
- Prefer pagination, caching, and incremental updates over repeatedly fetching historical data.

The summary-only bulk operation is deliberately cheap: approximately one request per 100 runs and no per-run calls.

## Bulk output decisions

Current command:

```bash
run-stats bulk [count]
```

Behavior:

- Defaults to 50 runs.
- Includes running activities only.
- Writes compact Markdown-like text to stdout.
- Can be redirected with `run-stats bulk 200 > garmin-runs.md`.
- Includes workout phase aggregates from `splitSummaries`.
- Omits fixed-distance fastest splits.
- Omits fields that add little analytical value or expose unnecessary private data.

## Privacy-sensitive fields

Raw activity-list entries may contain more personal information than expected, including:

- Start and end coordinates
- Owner ID, name, display name, and profile-image URLs
- Account roles and permission scopes
- Device and workout IDs
- Privacy settings

Do not paste unsanitized raw payloads into issues, logs, or external AI systems. At minimum, remove coordinates, names, profile URLs, account IDs, UUIDs, tokens, role lists, and device identifiers.

## Official alternatives

Garmin provides two supported alternatives:

- Garmin Account Management can prepare a full personal-data export. It is asynchronous and may take from roughly 48 hours to significantly longer.
- The official Garmin Connect Activity API supports activity files, push/ping-pull delivery, and historical backfill, but requires approval and is aimed at business integrations.

Neither is currently used by this project.

## Updating this document

When recording a new observation, include:

1. Date observed.
2. Endpoint and host.
3. Authentication method and relevant non-secret headers.
4. Request parameters.
5. HTTP status and response shape.
6. Whether the behavior was reproduced or seen only once.
7. Any device/activity conditions that may affect the response.

Always sanitize payload examples before committing them.
