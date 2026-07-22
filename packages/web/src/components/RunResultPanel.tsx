import { Bot, Copy, Loader2, Timer } from "lucide-react";
import { toMarkdown } from "run-stats/format";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { RecentRunsList } from "./RecentRunsList.tsx";
import { RunReportView } from "./RunReportView.tsx";
import type { RunResult, Selection } from "../services/run-types.ts";

export function RunResultPanel({
  selection,
  result,
  fetching,
  error,
  onSelect,
  onCopy,
}: {
  selection: Selection | null;
  result?: RunResult;
  fetching: boolean;
  error: boolean;
  onSelect: (selection: Selection) => void;
  onCopy: (value: string) => void;
}) {
  if (selection === null)
    return <MessageCard text="Choose an action above to see your runs." />;
  if (fetching && !result) return <LoadingCard />;
  if (error && !result)
    return <MessageCard text="Could not load. Please try again." />;
  if (!result) return <LoadingCard />;

  if (result.kind === "recent")
    return (
      <div className="mt-6 grid gap-3">
        <div className="flex items-center gap-2 px-1">
          <Timer className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Recent runs</h2>
          {fetching && (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          )}
          <Badge variant="secondary" className="ml-auto tabular-nums">
            {result.runs.length}
          </Badge>
        </div>
        <RecentRunsList
          runs={result.runs}
          onSelect={(id) => onSelect({ kind: "report", id })}
          disabled={fetching}
        />
      </div>
    );

  if (result.kind === "report")
    return (
      <Card className="mt-6 shadow-sm">
        <CardContent className="pt-6">
          <div className="mb-4 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCopy(toMarkdown(result.report))}
            >
              <Bot className="size-4" />
              Copy
            </Button>
          </div>
          <RunReportView report={result.report} />
        </CardContent>
      </Card>
    );

  return (
    <Card className="mt-6 gap-0 overflow-hidden py-0 shadow-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b py-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          JSON result
        </CardTitle>
        <div className="flex items-center gap-3">
          {fetching && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Loading…
            </span>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onCopy(JSON.stringify(result.data, null, 2))}
            aria-label="Copy result"
          >
            <Copy className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <pre className="max-h-[55vh] min-h-52 overflow-auto bg-neutral-950 p-4 font-mono text-[0.8rem] leading-relaxed whitespace-pre-wrap wrap-break-word text-emerald-100">
          {JSON.stringify(result.data, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}

function MessageCard({ text }: { text: string }) {
  return (
    <Card className="mt-6 shadow-sm">
      <CardContent className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        {text}
      </CardContent>
    </Card>
  );
}

function LoadingCard() {
  return (
    <Card className="mt-6 shadow-sm">
      <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading…
      </CardContent>
    </Card>
  );
}
