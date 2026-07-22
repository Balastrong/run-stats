import { Activity } from "lucide-react";

export function AppHeader() {
  return (
    <header className="mb-8 mt-4 flex items-center gap-4">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
        <Activity className="size-7" strokeWidth={2.25} />
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
          Garmin Connect
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Run Stats
        </h1>
        <p className="text-sm text-muted-foreground">
          A tiny installable UI for the run-stats API.
        </p>
      </div>
    </header>
  );
}
