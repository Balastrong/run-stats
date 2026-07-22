import { type FormEvent, useState } from "react";
import { Loader2, Lock, Mail, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Credentials = {
  email: string;
  password: string;
  mfaCode?: string;
};

export function LoginCard({
  pending,
  mfaMethod,
  onSubmit,
}: {
  pending: boolean;
  mfaMethod?: string;
  onSubmit: (credentials: Credentials) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ email, password, mfaCode: mfaCode || undefined });
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <ShieldCheck className="size-5 text-primary" />
          {mfaMethod ? "Verify your login" : "Log in"}
        </CardTitle>
        <CardDescription>
          Your password is sent only to this server for Garmin login. The
          resulting session is stored in an encrypted, HttpOnly cookie.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="email">Garmin email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="username"
                className="pl-9"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Garmin password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="pl-9"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
          </div>
          {mfaMethod && (
            <div className="grid gap-2">
              <Label htmlFor="mfa">MFA code ({mfaMethod})</Label>
              <Input
                id="mfa"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="text-center text-lg tracking-[0.4em]"
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value)}
                required
                autoFocus
              />
            </div>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {mfaMethod ? "Verify code" : "Log in to Garmin"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
