# Secure Video Infrastructure (SIV)

Developer-focused video infrastructure: secure uploads, processing, protected playback and video intelligence, exposed through APIs.

Architecture and decisions are documented in [ARCHITECTURE.md](ARCHITECTURE.md), [TECH_STACK.md](TECH_STACK.md), [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) and [MONOREPO_FOUNDATION_PLAN.md](MONOREPO_FOUNDATION_PLAN.md).

## Repository layout

| Path | Contents |
|---|---|
| `apps/web` | Next.js frontend (App Router) |
| `apps/api` | Express API |
| `apps/worker` | Background worker (processors: ingest, transcode, ai, maintenance) |
| `packages/*` | Shared domain and library packages (`@siv/*`) |
| `tooling/*` | Shared TypeScript and ESLint configuration |

## Prerequisites

- Node.js **22.22.x** (see `.nvmrc`)
- pnpm **10.34.9** (see `packageManager` in `package.json`)
- FFmpeg and FFprobe (needed once video processing is implemented)

## Getting started

```sh
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

`pnpm dev` builds the shared packages once, then runs the web app (http://localhost:3000), the API (http://localhost:4000) and the worker in watch mode.

| Command | What it does |
|---|---|
| `pnpm dev` | Run all apps in development mode |
| `pnpm build` | Build all packages and apps |
| `pnpm typecheck` | Type-check every workspace |
| `pnpm lint` | Lint every workspace |
| `pnpm format` / `pnpm format:check` | Format / check formatting with Prettier |
| `pnpm clean` | Remove build output |

## Environment configuration

### Ownership

Each app owns its own environment file and validates it at startup. There is no shared root `.env`. Packages never read environment variables; apps pass configuration to them.

| App | Local file (git-ignored) | Template | Validated in |
|---|---|---|---|
| `apps/api` | `apps/api/.env` | `apps/api/.env.example` | `apps/api/src/env/index.ts` |
| `apps/worker` | `apps/worker/.env` | `apps/worker/.env.example` | `apps/worker/core/env/index.ts` |
| `apps/web` | `apps/web/.env.local` | `apps/web/.env.example` | `apps/web/src/env/server.ts` |

Current variables:

| App | Variable | Required | Default | Secret |
|---|---|---|---|---|
| api | `NODE_ENV` | No | `development` | No |
| api | `PORT` | No | `4000` | No |
| api | `LOG_LEVEL` | No | `info` | No |
| worker | `NODE_ENV` | No | `development` | No |
| worker | `LOG_LEVEL` | No | `info` | No |
| worker | `WORKER_PROCESSORS` | No | `ingest,transcode,ai,maintenance` | No |
| web (server only) | `API_INTERNAL_URL` | Production only | `http://localhost:4000` in development | No |

Database, Redis, R2, authentication and AI variables are added with the tasks that integrate those services.

### How variables are loaded

- **api and worker (development):** `pnpm dev` runs `node --env-file-if-exists=.env --import tsx --watch …` in the app directory. A missing `.env` is allowed; defaults apply. Editing the `.env` file restarts the process.
- **web (development):** Next.js loads `apps/web/.env.local` itself.
- **Production:** variables come from the deployment platform. No `.env` file is read by the `start` scripts.
- **Precedence:** a variable already set in the environment always wins over the file.
- **Invalid configuration:** the app exits with code 1 and lists the invalid variable **names**. Values are never printed.

### Turborepo and shell variables

Turborepo runs tasks in strict environment mode, so a shell variable such as `PORT=4100 pnpm dev` does **not** reach the apps. Use one of these instead:

- Change the value in the app's `.env` / `.env.local` file (recommended), or
- Run the app directly with pnpm, which passes shell variables through:

  ```sh
  PORT=4100 pnpm --filter @siv/api dev
  ```

### Web app rules

- The web app holds **no secrets**: no database, Redis, R2, JWT or AI credentials, on the server or in the browser.
- `NEXT_PUBLIC_*` values are embedded in browser JavaScript. **No public variables are currently approved**; adding one requires review and a dedicated public environment module.
- Server-only configuration lives in `apps/web/src/env/server.ts`, which imports `server-only`. Importing it from a Client Component fails the build.
- Only files under each app's environment folder may read `process.env`. ESLint enforces this.

## Secrets

### Never commit

- `.env`, `.env.local` or any other real environment file (only `.env.example` files are committed)
- Credentials of any kind: connection strings with passwords, access keys, tokens, signing secrets
- Private keys and certificates (`*.pem`, `*.key`, `*.p12`, `*.pfx`)
- Registry auth tokens in the committed root `.npmrc`

These file patterns are git-ignored, but ignore rules are a safety net, not a guarantee. Check `git status` before every commit.

### Handling rules

- Each developer creates their own local env files from the examples. Credentials are never shared through the repository.
- Use individual, least-privilege development credentials (for example, a development-only R2 bucket token).
- `.env.example` files contain variable names, descriptions and non-secret defaults only. Secret variables are listed with an **empty** value and marked `# SECRET`.
- Never log configuration objects as a whole. Log only selected non-secret fields.

### GitHub secret scanning (repository owner action)

This repository is public. The owner should enable, under **Settings → Advanced Security**:

1. **Secret Protection** (secret scanning)
2. **Push protection**

Status: **pending owner confirmation.**

### Manual secret scan with Gitleaks

Use the official Gitleaks binary (`brew install gitleaks`), not the unrelated npm package of the same name. Run from the repository root; reports are redacted and written outside the repository.

Scan the full Git history:

```sh
gitleaks git --log-opts="--all" --redact --no-banner -v \
  --report-format json --report-path "$TMPDIR/gitleaks-history.json" .
```

Scan the working tree (tracked and untracked, non-ignored files only):

```sh
SCAN="$TMPDIR/gitleaks-worktree"; rm -rf "$SCAN"; mkdir -p "$SCAN"
git ls-files -z --cached --others --exclude-standard | rsync -a --from0 --files-from=- ./ "$SCAN/"
gitleaks dir --redact --no-banner -v \
  --report-format json --report-path "$TMPDIR/gitleaks-worktree.json" "$SCAN"
rm -rf "$SCAN"
```

Exit code `0` means no findings.

### If a secret is found

1. Stop committing and pushing.
2. Report the finding (rule, file, line, commit) to the project owner. Never paste the secret itself.
3. Treat any real credential in this public repository as compromised: **revoke or rotate it with its provider first.**
4. Remove it from the current files in a normal commit.
5. Do not rewrite Git history or force-push without explicit owner approval.
6. Suppress a false positive (by fingerprint in `.gitleaksignore`) only with owner approval and a recorded reason.
