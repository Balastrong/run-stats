import type { ReactNode } from "react";
import {
  CloudSun,
  Footprints,
  Gauge,
  HeartPulse,
  Mountain,
  Route as RouteIcon,
  Timer,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { RunReport } from "run-stats";

import {
  decimalNumber,
  formatDate,
  roundedNumber,
  titleCase,
  withUnit,
} from "../services/formatters.ts";

export function RunReportView({ report }: { report: RunReport }) {
  const { run, effort, training, runningDynamics, environment } = report;
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight">
            {run.name || "Run"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {formatDate(run.start)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={<RouteIcon className="size-4" />}
          label="Distance"
          value={run.distanceKm !== undefined ? run.distanceKm.toFixed(2) : "—"}
          unit="km"
        />
        <Stat
          icon={<Timer className="size-4" />}
          label="Moving time"
          value={run.movingTime ?? "—"}
        />
        <Stat
          icon={<Gauge className="size-4" />}
          label="Avg pace"
          value={run.averagePacePerKm ?? "—"}
          unit={run.averagePacePerKm ? "/km" : undefined}
        />
        <Stat
          icon={<Mountain className="size-4" />}
          label="Elevation"
          value={roundedNumber(run.elevationGainM)}
          unit="m gain"
        />
      </div>

      {effort && (
        <Section title="Effort" icon={<HeartPulse className="size-4" />}>
          <Metric
            label="Avg HR"
            value={withUnit(effort.averageHeartRateBpm, "bpm")}
          />
          <Metric
            label="Max HR"
            value={withUnit(effort.maxHeartRateBpm, "bpm")}
          />
          <Metric
            label="Cadence"
            value={withUnit(effort.averageCadenceSpm, "spm")}
          />
          <Metric
            label="Calories"
            value={withUnit(effort.caloriesKcal, "kcal")}
          />
          <Metric
            label="Avg power"
            value={withUnit(effort.averagePowerW, "W")}
          />
          <Metric label="Max power" value={withUnit(effort.maxPowerW, "W")} />
        </Section>
      )}

      {training && (
        <Section title="Training" icon={<TrendingUp className="size-4" />}>
          <Metric
            label="Aerobic"
            value={decimalNumber(training.aerobicEffect)}
          />
          <Metric
            label="Anaerobic"
            value={decimalNumber(training.anaerobicEffect)}
          />
          <Metric
            label="Benefit"
            value={
              training.primaryBenefit
                ? titleCase(training.primaryBenefit.replaceAll("_", " "))
                : "—"
            }
          />
          <Metric
            label="RPE"
            value={
              training.selfReportedRpe !== undefined
                ? `${training.selfReportedRpe}/10`
                : "—"
            }
          />
        </Section>
      )}

      {runningDynamics && (
        <Section
          title="Running dynamics"
          icon={<Footprints className="size-4" />}
        >
          <Metric
            label="GAP"
            value={
              runningDynamics.gradeAdjustedPacePerKm
                ? `${runningDynamics.gradeAdjustedPacePerKm}/km`
                : "—"
            }
          />
          <Metric
            label="Stride"
            value={withUnit(runningDynamics.strideLengthCm, "cm")}
          />
          <Metric
            label="Vert. osc."
            value={withUnit(runningDynamics.verticalOscillationCm, "cm")}
          />
          <Metric
            label="Vert. ratio"
            value={withUnit(runningDynamics.verticalRatioPercent, "%")}
          />
          <Metric
            label="Ground contact"
            value={withUnit(runningDynamics.groundContactTimeMs, "ms")}
          />
        </Section>
      )}

      {environment && (
        <Section title="Environment" icon={<CloudSun className="size-4" />}>
          <Metric
            label="Conditions"
            value={
              environment.conditions ? titleCase(environment.conditions) : "—"
            }
          />
          <Metric
            label="Temp"
            value={withUnit(environment.temperatureC, "°C")}
          />
          <Metric
            label="Feels like"
            value={withUnit(environment.apparentTemperatureC, "°C")}
          />
          <Metric
            label="Humidity"
            value={withUnit(environment.relativeHumidityPercent, "%")}
          />
          <Metric
            label="Wind"
            value={
              environment.windSpeedKph !== undefined
                ? `${environment.windSpeedKph} km/h${environment.windDirection ? ` ${environment.windDirection}` : ""}`
                : "—"
            }
          />
        </Section>
      )}

      {report.splitsPerKm && report.splitsPerKm.length > 0 && (
        <div className="grid gap-2">
          <SectionTitle
            title="Kilometre splits"
            icon={<Zap className="size-4" />}
          />
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Km</th>
                  <th className="px-3 py-2 text-right font-medium">Pace</th>
                  <th className="px-3 py-2 text-right font-medium">HR</th>
                  <th className="px-3 py-2 text-right font-medium">Power</th>
                  <th className="px-3 py-2 text-right font-medium">Cad.</th>
                </tr>
              </thead>
              <tbody>
                {report.splitsPerKm.map((split) => (
                  <tr key={split.km} className="border-t">
                    <td className="px-3 py-1.5 tabular-nums">{split.km}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {split.pacePerKm ?? "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {split.averageHeartRateBpm ?? "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {split.averagePowerW ?? "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {split.averageCadenceSpm ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  unit,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-semibold tabular-nums">
        {value}
        {unit && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {unit}
          </span>
        )}
      </p>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <SectionTitle title={title} icon={icon} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border bg-card p-3 sm:grid-cols-3">
        {children}
      </div>
    </div>
  );
}

function SectionTitle({ title, icon }: { title: string; icon: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
      <span className="text-primary">{icon}</span>
      {title}
    </p>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}
