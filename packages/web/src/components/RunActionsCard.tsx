import { useState } from "react";
import { Layers, Loader2, LogOut, Search, Timer, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import type { Selection } from "../services/run-types.ts";

export function RunActionsCard({
  selection,
  fetching,
  loggingOut,
  onSelect,
  onLogout,
}: {
  selection: Selection | null;
  fetching: boolean;
  loggingOut: boolean;
  onSelect: (selection: Selection) => void;
  onLogout: () => void;
}) {
  const [activityId, setActivityId] = useState("");

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <Badge variant="secondary" className="gap-1.5 py-1 pl-1.5 pr-2.5">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Garmin connected
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            disabled={loggingOut}
          >
            <LogOut className="size-4" />
            Log out
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-2 sm:grid-cols-3">
          <RunAction
            active={selection?.kind === "recent"}
            disabled={fetching}
            icon={<Timer className="size-4 text-primary" />}
            title="Recent 10"
            description="Latest activities"
            onClick={() => onSelect({ kind: "recent" })}
          />
          <RunAction
            active={selection?.kind === "latest"}
            disabled={fetching}
            icon={<Zap className="size-4 text-primary" />}
            title="Latest run"
            description="Most recent run"
            onClick={() => onSelect({ kind: "latest" })}
          />
          <RunAction
            active={selection?.kind === "bulk"}
            disabled={fetching}
            icon={<Layers className="size-4 text-primary" />}
            title="Bulk 50"
            description="Summaries batch"
            onClick={() => onSelect({ kind: "bulk" })}
          />
        </div>
        <Separator />
        <div className="flex items-end gap-2">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="activity">Look up an activity</Label>
            <Input
              id="activity"
              inputMode="numeric"
              placeholder="Activity ID"
              value={activityId}
              onChange={(event) => setActivityId(event.target.value)}
            />
          </div>
          <Button
            onClick={() => onSelect({ kind: "report", id: activityId })}
            disabled={fetching || !/^\d+$/.test(activityId)}
          >
            <Search className="size-4" />
            Show
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RunAction({
  active,
  disabled,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      data-active={active}
      className="h-auto flex-col items-start gap-1 py-3 data-[active=true]:border-primary data-[active=true]:bg-primary/5"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </span>
      <span className="text-xs font-normal text-muted-foreground">
        {description}
      </span>
    </Button>
  );
}
