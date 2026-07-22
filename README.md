# run-stats

`run-stats` is a full-stack TypeScript web app for browsing compact Garmin Connect
statistics. It retrieves and formats data only; it does not call an AI or assess runs.

> [!IMPORTANT]
> This is an independent, unofficial project. It is not affiliated with, endorsed by,
> or supported by Garmin. The current integration uses private, undocumented Garmin
> Connect endpoints that may change or stop working without notice.

The repository is a pnpm workspace with two packages:

- `packages/web` is the private TanStack Start web app.
- `packages/run-stats` is one publishable npm package containing the shared run logic
  and the `run-stats` CLI.

The web app depends on `run-stats` through pnpm's `workspace:^` protocol. Publishing
the CLI and shared logic therefore requires only one npm package release.

## Requirements

- Node.js 24 or newer
- pnpm

```sh
pnpm install
```

## Web app

Start the development server:

```sh
pnpm dev
```

Open `http://localhost:3000`. Vite listens on all interfaces, so another device on
the same network can open `http://YOUR-COMPUTER-IP:3000` for testing.

The web app supports Garmin login with MFA, recent and bulk runs, the latest run, and
lookup by activity ID. Browser tokens are encrypted into an `HttpOnly`,
`SameSite=Strict` cookie and are separate from the CLI token file.

## CLI

Run the CLI locally from the workspace:

```sh
pnpm dev:cli -- login
pnpm dev:cli -- recent
pnpm dev:cli -- latest
pnpm dev:cli -- show 23584703311
pnpm dev:cli -- show 23584703311 --format json
```

Only `garmin` is registered today and can be selected explicitly:

```sh
pnpm dev:cli -- --source garmin recent
```

The password is used only for login and is never written to disk. The refreshable
CLI session is stored with owner-only permissions at:

```text
~/.config/run-stats/garmin/garmin_tokens.json
```

Set `GARMIN_TOKEN_FILE` in `.env` to use another token location.

Install the published package globally with:

```sh
npm install --global run-stats
run-stats recent
```

To test a global link before publishing:

```sh
pnpm --filter run-stats build
pnpm --filter run-stats link --global
run-stats recent
```

## Develop

```sh
pnpm check
pnpm test
pnpm build
```

Tests use synthetic activity records and never contact Garmin. Inspect the npm
tarball without publishing it with:

```sh
pnpm pack:cli --dry-run
```

To add another source, implement `RunSource` from
`packages/run-stats/src/types.ts` and register it in
`packages/run-stats/src/cli.ts`.

## Architecture

- Shared domain types, formatting, and Garmin integration live in
  `packages/run-stats/src` and are exported by the `run-stats` package.
- The executable is emitted as `packages/run-stats/dist/cli.js` and published as the
  `run-stats` binary.
- Web routes live in `packages/web/src/routes`.
- Garmin authentication and cookie encryption are server-only.
- Vite builds the React client and server; Nitro owns the runtime output.

Garmin integration uses private, undocumented Garmin Connect endpoints and may need
maintenance if Garmin changes them. Garmin's official Activity API requires acceptance
into the Garmin Connect Developer Program.

### Deploy

Build and start the production web server:

```sh
pnpm build
WEB_SESSION_SECRET="$(openssl rand -base64 32)" pnpm start
```

Use a stable `WEB_SESSION_SECRET` of at least 32 characters in production. Changing it
logs out every browser. Production cookies are marked `Secure`, so use HTTPS.

TanStack Start uses Nitro for provider-neutral deployment. Select another preset at
build time when needed:

```sh
NITRO_PRESET=vercel pnpm build
NITRO_PRESET=netlify pnpm build
NITRO_PRESET=cloudflare-module pnpm build
```

The built-in login limiter is process-local, bounded, and applies both per-account and
global limits without trusting client-supplied forwarding headers. For a public
multi-instance deployment, also configure distributed rate limiting at the provider,
reverse proxy, or WAF.
