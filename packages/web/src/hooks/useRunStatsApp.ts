import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, ApiError, errorMessage } from "../services/api.ts";
import { fetchRuns } from "../services/runs.ts";
import {
  selectionToSearch,
  searchToSelection,
  type Selection,
} from "../services/run-types.ts";

const AUTH_STATUS_KEY = ["auth", "status"] as const;

type Credentials = {
  email: string;
  password: string;
  mfaCode?: string;
};

export function useRunStatsApp() {
  const queryClient = useQueryClient();
  const [mfaMethod, setMfaMethod] = useState<string>();
  const search = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });
  const selection = searchToSelection(search);

  function setSelection(next: Selection | null) {
    void navigate({ search: selectionToSearch(next) });
  }

  const statusQuery = useQuery({
    queryKey: AUTH_STATUS_KEY,
    queryFn: () => api("/api/auth/status"),
    staleTime: Infinity,
  });
  const authenticated = statusQuery.data?.authenticated === true;

  const runsQuery = useQuery({
    queryKey: ["runs", selection],
    queryFn: () => fetchRuns(selection as Selection),
    enabled: authenticated && selection !== null,
  });

  const loginMutation = useMutation({
    mutationFn: (credentials: Credentials) =>
      api("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      }),
    onSuccess: () => {
      queryClient.setQueryData(AUTH_STATUS_KEY, { authenticated: true });
      setMfaMethod(undefined);
      toast.success("Connected to Garmin");
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.payload.mfaRequired
      ) {
        setMfaMethod(String(error.payload.method ?? "email"));
        toast.info("Enter the verification code Garmin just sent you.");
      } else {
        toast.error(errorMessage(error));
      }
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => api("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.setQueryData(AUTH_STATUS_KEY, { authenticated: false });
      queryClient.removeQueries({ queryKey: ["runs"] });
      setSelection(null);
      toast.success("Logged out");
    },
  });

  useEffect(() => {
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js");
  }, []);

  useEffect(() => {
    const error = runsQuery.error;
    if (!error) return;
    if (error instanceof ApiError && error.status === 401)
      queryClient.setQueryData(AUTH_STATUS_KEY, { authenticated: false });
    toast.error(errorMessage(error));
  }, [runsQuery.error, queryClient]);

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  }

  return {
    authenticated,
    checking: statusQuery.isPending,
    fetching: runsQuery.isFetching,
    mfaMethod,
    selection,
    result: runsQuery.data,
    hasRunError: runsQuery.isError,
    loginPending: loginMutation.isPending,
    logoutPending: logoutMutation.isPending,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    selectRun: setSelection,
    copyText,
  };
}
