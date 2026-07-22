import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import {
  QueryClient,
  QueryClientProvider,
  defaultShouldDehydrateQuery,
} from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { type ReactNode, useState } from "react";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1.0, viewport-fit=cover",
      },
      { name: "theme-color", content: "#17261d" },
      { title: "Run Stats" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon.svg" },
    ],
  }),
  component: RootComponent,
});

const QUERY_CACHE_MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours

function RootComponent() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
            gcTime: QUERY_CACHE_MAX_AGE,
          },
        },
      }),
  );
  // Persisters touch `window`, so only build one on the client; SSR keeps a plain provider.
  const [persister] = useState(() =>
    typeof window === "undefined"
      ? undefined
      : createAsyncStoragePersister({
          storage: window.localStorage,
          key: "run-stats-query-cache",
        }),
  );

  if (!persister) {
    return (
      <QueryClientProvider client={queryClient}>
        <RootDocument>
          <Outlet />
        </RootDocument>
      </QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: QUERY_CACHE_MAX_AGE,
        dehydrateOptions: {
          // Never persist auth status: it must always be revalidated against the session cookie.
          shouldDehydrateQuery: (query) =>
            defaultShouldDehydrateQuery(query) && query.queryKey[0] !== "auth",
        },
      }}
    >
      <RootDocument>
        <Outlet />
      </RootDocument>
    </PersistQueryClientProvider>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
