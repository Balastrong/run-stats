import { ChevronRight, Flame, Route as RouteIcon } from "lucide-react";
import type { RunReference } from "run-stats";

import { Card, CardContent } from "@/components/ui/card";

import { formatDate } from "../services/formatters.ts";

export function RecentRunsList({
  runs,
  onSelect,
  disabled,
}: {
  runs: RunReference[];
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  if (runs.length === 0) {
    return <EmptyState message="No recent runs found for this account." />;
  }

  return (
    <div className="grid gap-2">
      {runs.map((run) => (
        <button
          key={run.id}
          type="button"
          onClick={() => onSelect(run.id)}
          disabled={disabled}
          className="group flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <RouteIcon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{run.name || "Run"}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(run.start)}
            </p>
          </div>
          {run.distanceKm !== undefined && (
            <span className="text-sm font-semibold tabular-nums">
              {run.distanceKm.toFixed(2)} km
            </span>
          )}
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </button>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
        <Flame className="size-6 opacity-40" />
        {message}
      </CardContent>
    </Card>
  );
}
