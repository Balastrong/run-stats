# run-stats

`run-stats` retrieves Garmin Connect running data and turns it into compact,
readable reports. Use it through the browser, from the command line, or as a
TypeScript library.

It reports run details such as pace, heart rate, power, elevation, training
effect, running dynamics, weather, splits, and laps when Garmin provides them.
It does not call an AI service or assess the quality of a run.

> [!IMPORTANT]
> This is an independent, unofficial project. It is not affiliated with,
> endorsed by, or supported by Garmin. The integration uses private,
> undocumented Garmin Connect endpoints that may change or stop working without
> notice.

## Features

- Responsive, installable web app with Garmin login and MFA support
- Recent-run list, latest-run report, activity-ID lookup, and bulk summaries
- Markdown and JSON output from the CLI
- Refreshable sessions for both the CLI and browser
- Reusable TypeScript types, formatters, and source interface
- No Garmin requests in the test suite

## Requirements

- Node.js 24 or newer
- pnpm 11 (the workspace pins `pnpm@11.8.0`)
- A Garmin Connect account

## Quick start

```sh
pnpm install
pnpm dev
```

Open <http://localhost:3000> and sign in with Garmin. Vite listens on all
interfaces, so you can also test from another device at
`http://YOUR-COMPUTER-IP:3000`.

The browser session is encrypted into a 30-day `HttpOnly`, `SameSite=Strict`
cookie. It is independent of the CLI session described below.

## CLI

Run the CLI from the workspace:

```sh
pnpm dev:cli -- login
pnpm dev:cli -- recent
pnpm dev:cli -- latest
pnpm dev:cli -- show 23584703311
pnpm dev:cli -- show 23584703311 --format json
pnpm dev:cli -- bulk 20
```

| Command              | Purpose                                                 | Useful options                     |
| -------------------- | ------------------------------------------------------- | ---------------------------------- |
| `login`              | Authenticate with Garmin and save a refreshable session | `--email <email>`                  |
| `recent`             | List recent runs and their activity IDs                 | `--limit <number>` (default: `10`) |
| `latest`             | Print the most recent run                               | `--format markdown\|json`          |
| `show <activity-id>` | Print one run by Garmin activity ID                     | `--format markdown\|json`          |
| `bulk [count]`       | Print compact summaries for several runs                | default count: `50`                |

Garmin is currently the only registered source. You can select it explicitly by
placing the global option before the command:

```sh
pnpm dev:cli -- --source garmin recent
```

The password is read only from an interactive prompt and is never written to
disk. The CLI stores its session with owner-only permissions at:

```text
~/.config/run-stats/garmin/garmin_tokens.json
```

To use another location, set `GARMIN_TOKEN_FILE` in the environment or in a
root-level `.env` file:

```sh
GARMIN_TOKEN_FILE=/path/to/garmin_tokens.json pnpm dev:cli -- recent
```

### Install from npm

```sh
npm install --global run-stats
run-stats login
run-stats recent
```

To test a global link before publishing:

```sh
pnpm link:cli
run-stats recent
```

## Library

The `run-stats` package exports the Garmin source, normalized run types, helpers
for finding the latest run, and Markdown and bulk-text formatters:

```ts
import { GarminSource, getMostRecentRun, toMarkdown } from "run-stats";

const source = new GarminSource();
const report = await getMostRecentRun(source);

process.stdout.write(toMarkdown(report));
```

This uses the same token file as the CLI. You can pass a different token-file
path or a custom `GarminTokenStore` to `new GarminSource(...)`.

To integrate another provider, implement the exported `RunSource` interface.
The CLI registry is currently configured in `packages/run-stats/src/cli.ts`.

## Configuration

| Variable             | Used by         | Description                                                                               |
| -------------------- | --------------- | ----------------------------------------------------------------------------------------- |
| `GARMIN_TOKEN_FILE`  | CLI and library | Overrides the default Garmin token-file path                                              |
| `WEB_SESSION_SECRET` | Web app         | Encrypts browser sessions; required in production and must contain at least 32 characters |
| `NITRO_PRESET`       | Web build       | Selects a Nitro deployment target                                                         |

In development, the web app generates an ephemeral session secret if
`WEB_SESSION_SECRET` is absent; restarting the server then logs out browser
sessions.

## Development

This repository is a pnpm workspace:

- `packages/run-stats` contains the publishable npm library and CLI.
- `packages/web` contains the private TanStack Start application.

Common commands:

| Command                   | Description                                              |
| ------------------------- | -------------------------------------------------------- |
| `pnpm dev`                | Build the library, then start the web development server |
| `pnpm dev:web`            | Start only the web development server                    |
| `pnpm dev:cli -- <args>`  | Run the CLI directly from TypeScript source              |
| `pnpm check`              | Type-check both packages                                 |
| `pnpm test`               | Build the library and run all tests                      |
| `pnpm build`              | Build both packages                                      |
| `pnpm pack:cli --dry-run` | Inspect the npm tarball without publishing               |

Tests use synthetic activity records and do not contact Garmin.

## Architecture

- Shared domain types, formatting, authentication, and Garmin normalization live
  in `packages/run-stats/src`.
- The CLI is emitted as `packages/run-stats/dist/cli.js` and published as the
  `run-stats` executable.
- The web app consumes the library through pnpm's `workspace:^` protocol.
- TanStack Start provides the React UI and API routes; Nitro produces the server
  runtime.
- Garmin authentication stays server-side. The web app never exposes Garmin
  tokens to browser JavaScript.

## Deployment

Build and start the production web server:

```sh
pnpm build
WEB_SESSION_SECRET="$(openssl rand -base64 32)" pnpm start
```

Keep `WEB_SESSION_SECRET` stable between deployments; changing it invalidates
all browser sessions. Production cookies are marked `Secure`, so serve the app
over HTTPS.

TanStack Start uses Nitro for provider-neutral deployment. Select a different
preset at build time when needed:

```sh
NITRO_PRESET=vercel pnpm build
NITRO_PRESET=netlify pnpm build
NITRO_PRESET=cloudflare-module pnpm build
```

The built-in login limiter is process-local and applies both per-account and
global limits without trusting client-supplied forwarding headers. For a public,
multi-instance deployment, add distributed rate limiting at the provider,
reverse proxy, or WAF.

## License

[MIT](LICENSE)
