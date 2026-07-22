import { CheckCircle2, Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";

import { AppHeader } from "./components/AppHeader.tsx";
import { useRunStatsApp } from "./hooks/useRunStatsApp.ts";
import { LoginCard } from "./components/LoginCard.tsx";
import { RunActionsCard } from "./components/RunActionsCard.tsx";
import { RunResultPanel } from "./components/RunResultPanel.tsx";

export function App() {
  const app = useRunStatsApp();

  return (
    <div className="relative min-h-svh">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-linear-to-b from-primary/10 to-transparent" />
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-[max(2rem,env(safe-area-inset-top))]">
        <AppHeader />

        {app.checking ? (
          <Card className="shadow-sm">
            <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Checking session…
            </CardContent>
          </Card>
        ) : !app.authenticated ? (
          <LoginCard
            pending={app.loginPending}
            mfaMethod={app.mfaMethod}
            onSubmit={app.login}
          />
        ) : (
          <RunActionsCard
            selection={app.selection}
            fetching={app.fetching}
            loggingOut={app.logoutPending}
            onSelect={app.selectRun}
            onLogout={() => app.logout()}
          />
        )}

        {app.authenticated && (
          <RunResultPanel
            selection={app.selection}
            result={app.result}
            fetching={app.fetching}
            error={app.hasRunError}
            onSelect={app.selectRun}
            onCopy={app.copyText}
          />
        )}

        <footer className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-emerald-500" />
          Sessions are encrypted and stored in an HttpOnly cookie.
        </footer>
      </main>
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}
