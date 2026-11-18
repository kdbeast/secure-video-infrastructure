# Secure Intelligent Video Infrastructure: Tech Stack

> **Status:** Planning draft. No packages are installed and no code exists yet.
> **Last updated:** 2026-11-17 (rev 3: single worker application with processors, single-tenant MVP, 8 GB upload; rev 2: frontend corrected to Next.js)
> **Companion docs:** [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)

Status labels: ✅ **Confirmed** (decided by project owner), 🟡 **Proposed** (working default), ❓ **Open** (undecided).

**Versioning note:** specific library and framework versions are intentionally not pinned here. They should be chosen and verified against current releases when Phase 0 begins, then recorded in the lockfile and a short ADR. This matters most for Next.js, whose conventions (for example request-interception file naming and caching defaults) have changed between major versions.

**Revision note (rev 2):** rev 1 proposed React + Vite, Fastify and the native MongoDB driver. These are **superseded**. The frontend is Next.js (App Router), the API is Express and the data layer is Mongoose. **Vite is not used.**

---

## 1. Confirmed stack

| Area | Technology | Role | Status |
|---|---|---|---|
| Language | **TypeScript** | All apps and packages | ✅ |
| Monorepo | **pnpm** workspaces + **Turborepo** | Apps plus shared packages, task orchestration and caching | ✅ |
| Frontend | **Next.js + TypeScript** | Rendering, routing, UI | ✅ |
| Frontend routing | **Next.js App Router** | File-based routing, layouts, Server and Client Components | ✅ |
| Styling / UI | **Tailwind CSS + shadcn/ui** | Styling and component primitives | ✅ |
| Backend API | **Express + TypeScript** | The single dedicated backend API | ✅ |
| Database | **MongoDB + Mongoose** | System of record | ✅ |
| Authentication | **JWT + rotating refresh tokens in secure cookies** | Sessions across Next.js and Express | ✅ |
| Object storage | **Cloudflare R2** (S3-compatible API) | Raw uploads, HLS output, artifacts | ✅ |
| Queue | **Redis + BullMQ** | Job orchestration; Redis also for rate limiting and caches | ✅ |
| Media processing | **FFmpeg** (with `ffprobe`) | Probe, transcode, package | ✅ |
| Validation | **Zod** | API, queue payloads and forms | ✅ |
| Testing | **Vitest + Playwright** | Unit/integration and end-to-end | ✅ |
| Runtime | **Node.js** | Next.js server, Express API, worker application | ✅ |
| Worker structure | **One worker application (`apps/worker`) with separate ingest, transcode, AI and maintenance processors** | Background processing, separate from Next.js and Express | ✅ |
| Tenancy | **Single-tenant MVP, designed for future multi-tenancy** | Multi-tenancy is not implemented now | ✅ |
| Upload limit | **Maximum video upload size: 8 GB** | Drives multipart upload design and worker sizing | ✅ |

### Explicitly excluded (✅)
- **Vite** is not part of the frontend stack.
- **Next.js API routes do not replace Express.** Express is the only backend API.
- **The worker application is not merged into the API** and never runs inside Next.js.
- **Four separate worker applications are not the architecture.** There is one worker application with four processors; splitting processors into separate deployables is a future option, not the current structure.
- **Multi-tenancy is not implemented in the MVP.**

## 2. Proposed technology decisions

Each item is 🟡 Proposed unless marked ❓. Nothing below contradicts section 1.

### 2.1 Monorepo and tooling

| Concern | Proposal | Rationale |
|---|---|---|
| TypeScript setup | Shared base `tsconfig` plus **project references** for packages | Fast incremental builds, enforced package graph. |
| Next.js integration | Next.js builds itself; Turborepo orchestrates the pipeline. Shared packages consumed by `apps/web` are either pre-built or transpiled via the Next.js configuration ❓ | Common workspace friction point; decide in Phase 0. |
| Lint / format | **ESLint** plus **Prettier** (Biome ❓) | Mature ecosystem; import-boundary rules available. |
| Module boundaries | Lint rule restricting cross-package imports; `apps/web` may import only `packages/contracts`; inside `apps/worker`, a processor may import only `apps/worker/core` and packages, never another processor | Makes the dependency rules in ARCHITECTURE.md §3 enforceable, keeps server-only code out of the Next.js bundle, and keeps processors splittable. |
| Node version | Active LTS, pinned via `.nvmrc` / `engines` | Reproducible runtime. |
| Commit hygiene | Conventional commits, pre-commit checks | Optional. |

### 2.2 Frontend (Next.js, App Router)

| Concern | Proposal | Notes |
|---|---|---|
| Rendering model | **Server Components by default**; `"use client"` only for leaf components that need interactivity | Detailed table in ARCHITECTURE.md §4.1. |
| Data fetching | Server Components fetch from Express over HTTP using a server-only API client that forwards the user's credentials | No database access from Next.js. |
| Mutations | Client Components call Express directly. **Server Actions are not used for business mutations.** | Keeps Express the single mutation and authorization surface. ❓ revisit only with a clear need. |
| Route Handlers / API routes | Not used for product endpoints | Express owns all endpoints. |
| Request interception | Used for session checks and refresh (see ARCHITECTURE.md §6.6); exact file convention depends on the Next.js version ❓ | Must not do heavy work. |
| Styling | **Tailwind CSS** (✅) with design tokens defined once | |
| Components | **shadcn/ui** (✅): components are copied into the repo and owned by us, built on Radix primitives | Initially lives in `apps/web`; extract to `packages/ui` only if a second frontend appears ❓. |
| Forms | Shared Zod schemas from `packages/contracts`; form library ❓ (React Hook Form with a Zod resolver is a common choice) | Client validation is UX only; Express re-validates. |
| Client-side server state | ❓ TanStack Query, only inside Client Components that need polling or cache invalidation (for example processing status). | Less central than in rev 1 because Server Components handle most reads. |
| Player | **hls.js** with native HLS fallback, in a Client Component loaded without SSR | |
| Upload client | Custom multipart uploader using presigned URLs, with parallel parts, retry and abort | Uppy is an alternative ❓. Runs only in Client Components. |
| Fonts / images | Next.js built-in optimizations where applicable | Thumbnails and posters come from R2; image optimization of private media must not bypass authorization ❓. |
| Hosting | ❓ Own Node container behind the same edge as Express, or a platform host | Affects the single-origin cookie design (Q12, Q17). |
| Environment | Only non-secret values use the public prefix; server-side Express URL is a plain server variable | |

### 2.3 Backend API (Express + TypeScript)

| Concern | Proposal | Rationale |
|---|---|---|
| Structure | One Express app composed of module routers (`auth`, `videos`, `uploads`, `playback`) mounted from the domain packages | Matches the modular monorepo. |
| Validation | **Zod** (✅) middleware per route validating body, params and query using schemas from `packages/contracts` | Express has no built-in schema validation, so a thin shared middleware is needed ❓ (custom vs a small library). |
| Error handling | Centralized error middleware, typed application errors, consistent error response shape | Express needs explicit handling for async errors; verify behavior for the chosen major version ❓. |
| Security middleware | Security headers (Helmet or equivalent), body size limits, strict CORS only if topology B is chosen | See ARCHITECTURE.md §6.6. |
| Rate limiting | Redis-backed limiter on login, refresh, upload-session creation and playback issuance | Redis is already confirmed. |
| Cookies | Cookie parsing middleware; cookies set only by Express | |
| JWT / crypto | JWT library ❓ (for example `jose`); signing algorithm and key rotation ❓ (Q18). Refresh tokens are opaque and stored hashed. | |
| Password hashing | A modern memory-hard algorithm (Argon2 or bcrypt) ❓, if password login is used | Login methods are open (Q18). |
| API contract | OpenAPI generated from the Zod schemas ❓ | Documentation and optional client generation. |
| Logging | **Pino** (structured JSON) with request correlation IDs 🟡 | |
| Config | Typed env loading validated at startup with Zod | Fail fast on misconfiguration. |

### 2.4 Data layer (MongoDB + Mongoose)

| Concern | Proposal | Rationale |
|---|---|---|
| ODM | **Mongoose** (✅), models owned by the domain package that owns the collection | Replaces the rev 1 native-driver proposal. |
| Types | Mongoose models carry TypeScript types; API-facing shapes are defined as Zod schemas in `packages/contracts`. Mapping between them is explicit and covered by tests, so the two do not silently drift ❓ | Avoids exposing persistence shapes through the API. |
| Boundary validation | Zod at the API boundary (✅); Mongoose schema validation for persistence invariants | Defense in depth. |
| Indexes | Declared in models, with index creation controlled explicitly in production ❓ | Avoid surprise index builds. Natural unique indexes lead with `tenantId` where free (T8). |
| Tenancy fields | Every model (`users`, `videos`, `uploadSessions`, `renditions`, `aiResults`, `auditEvents`, `jobRecords`, `refreshTokens`) carries its own `tenantId`, set server-side to one constant default value in the MVP (ARCHITECTURE.md §8); repositories take a tenant context (ARCHITECTURE.md §6.7) ❓ Q20 | Preserves flexibility for future multi-tenancy without implementing it. No tenant or membership models in the MVP. |
| Transactions | Used sparingly; design for idempotent single-document updates first | Requires a replica set; local dev should match production. |
| Migrations | Lightweight versioned migration scripts ❓ | Collections evolve. |
| Search | ❓ MongoDB text search, Atlas Search/Vector Search, or a separate engine | Depends on hosting and AI scope (Q7, Q8). |
| Refresh-token storage | `refreshTokens` collection with hashed tokens and TTL index on expiry | See ARCHITECTURE.md §6.6. |

### 2.5 Queues and workers (Redis + BullMQ)

| Concern | Proposal | Rationale |
|---|---|---|
| Queue layout | One queue per concern: `ingest`, `transcode`, `package`, `ai.<stage>`, `maintenance`; each owned by one processor in `apps/worker` | Independent concurrency, retries and rate limits. |
| Per-processor configuration | Each processor has its own Zod-validated configuration covering queue options (attempts, backoff, retention, rate limit, lock duration, stalled-job settings), **concurrency**, and **resource settings** (scratch disk budget, FFmpeg threads and parallel processes, child-process timeouts, memory ceilings, GPU and egress for AI) | Requirement: independent queue config, concurrency and resources per processor. |
| One BullMQ worker per queue | Each queue is consumed by its own BullMQ worker instance inside the worker application | Concurrency is then independent per queue. |
| Enabled processors | A configuration setting selects which processors an instance starts (default: all) | Lets the same image be deployed with different processor sets, which is the mechanism for a future split (ARCHITECTURE.md §4.3, Q21). |
| Payload tenancy | Job payloads include `tenantId` (constant in the MVP) | Tenancy flexibility (T6). |
| Orchestration | BullMQ **Flows** for parent/child dependencies (for example transcode then package) | Models the pipeline without custom coordination code. |
| Payloads | Small, versioned, Zod-validated; IDs and storage keys only, never media | Keeps Redis lean and payloads stable. |
| Retries | Exponential backoff, per-queue attempts, dead-letter handling | See ARCHITECTURE.md §5.3. |
| Idempotency | Deterministic job IDs and output keys | Safe re-runs. |
| Producers and consumers | Express enqueues jobs. The worker application consumes them. Next.js never produces or consumes queue jobs. | Preserves the separation. |
| Long jobs | Lock duration, timeouts and progress reporting are set for the transcode processor to handle 8 GB sources; short-job processors keep short settings | Long and short jobs must not share timeout settings (Q22). |
| Redis deployment | Persistence enabled; eviction policy that never evicts queue data | BullMQ correctness requirement. |
| Operator visibility | Queue dashboard on an internal-only route ❓ | Troubleshooting. |

❓ Managed vs self-hosted Redis, and topology (single, sentinel, cluster), depend on scale (Q2).

### 2.6 Media processing (FFmpeg)

| Concern | Proposal | Rationale |
|---|---|---|
| Invocation | Spawn `ffmpeg`/`ffprobe` as child processes through a thin typed wrapper in the worker | Simple, debuggable, no wrapper-library lock-in. |
| Where it runs | **Only** in the worker application image, in child processes started by the ingest and transcode processors (and AI audio extraction if needed). Never in the Next.js or Express images or request handlers. | Confirmed separation rule; child processes keep heavy work off the Node event loop shared by processors. |
| Scratch disk | Sized for 8 GB sources: initial planning estimate roughly 3× source size (about 24 GiB) per concurrent transcode job, to be replaced by Phase 0 measurement | Q22. |
| Output format | **HLS** | Broad player support, works with object storage. |
| Segment container | ❓ fMP4/CMAF vs MPEG-TS (A4) | fMP4 preferred for modern players and future DASH; confirm. |
| Video codec | H.264 baseline ladder for compatibility ❓ | Maximum compatibility; HEVC/AV1 as later options. |
| Audio codec | AAC | Compatibility. |
| Ladder | ❓ Fixed ladder to start (A5) | Simpler; content-adaptive later. |
| Hardening | Non-root container, resource limits, timeouts, restricted protocols, input limits | See ARCHITECTURE.md §6.3. |
| Distribution | FFmpeg installed in the worker application image only; version pinned in the image | Reproducible. |

### 2.7 Object storage (Cloudflare R2)

| Concern | Proposal | Rationale |
|---|---|---|
| Provider | **Cloudflare R2** (✅) | |
| Client | **AWS SDK for JavaScript v3** S3 client pointed at the R2 endpoint, wrapped by `packages/storage` | R2 exposes an S3-compatible API; one place for storage logic. |
| Uploads | **Presigned multipart** uploads direct from the browser; **mandatory** for the confirmed 8 GB maximum because a single PUT tops out at roughly 5 GiB | Keeps bytes off Next.js and Express; supports resume. |
| R2 multipart limits (checked 2026-11-16 against Cloudflare documentation; re-verify in Phase 0) | Part size 5 MiB to 5 GiB (last part may be smaller); at most 10,000 parts; **all parts except the last must be the same size**; maximum object size 5 TiB; incomplete uploads auto-abort after 7 days by default | 8 GiB at the 5 MiB minimum is 1,639 parts, so limits do not block 8 GB. Equal-size rule means Express chooses one part size per upload. |
| Part-size policy | Server-chosen fixed size per upload; working assumption 64 MiB (128 parts for 8 GiB), range 16–128 MiB ❓ (Q19) | ARCHITECTURE.md §5.4. |
| Not yet confirmed | Per-part presigned `UploadPart` URLs from a browser, signature binding of part size, CORS/`ETag` exposure, presigned lifetime, behavior behind a custom domain | Phase 0 checks V3 to V6. |
| Bucket access | Buckets private; no public access enabled on raw or processed buckets | Access only via presigned or signed access. |
| CORS | R2 bucket CORS policy allowing the web origin for upload requests and exposing the headers the uploader needs | Required for browser-direct multipart. |
| Lifecycle | Rules to abort incomplete multipart uploads (sooner than R2's 7-day default) and expire temp objects | Safety net behind the maintenance processor. |
| Key layout | `{bucket}/{tenantId}/{videoId}/{version}/...` with a constant default `tenantId` in the MVP (T3) | R2 has no rename, so key layout is chosen now. |
| Local development / CI | ❓ Emulate with MinIO (or similar) locally, plus compatibility tests against a real R2 bucket (Q16) | R2 is not fully identical to S3 in every behavior. |
| Phase 0 spike | ❓ Verify R2 multipart limits, presigned URL behavior (S3 endpoint vs custom domain), CORS and the HLS segment authorization approach | Not yet verified in these documents. |
| CDN | ❓ Cloudflare in front of the processed bucket (Q6, Q15) | Affects playback authorization (ARCHITECTURE.md §6.4). |

### 2.8 AI pipeline

| Concern | Proposal | Rationale |
|---|---|---|
| Abstraction | `packages/ai` defines stage interfaces; providers are adapters | Swap vendors or models without touching pipeline code. |
| Transcription | Whisper-class model, self-hosted or via API ❓ | Depends on privacy constraints (Q7). |
| Visual analysis | ❓ Open; depends on Q8 | Frame tagging, captions, moderation models. |
| Embeddings / search | ❓ Open; see §2.4 search | Depends on search backend. |
| Execution | The **AI processor** inside `apps/worker`, with its own queues, concurrency and resource settings. When external providers or GPUs are needed it runs as its own instance of the same worker image (Q21). | Isolated scaling and egress control without a separate application. |
| Governance | Enable flags and budgets read through a tenant-keyed settings lookup (deployment-level in the MVP); provenance recorded per result | Cost and compliance control; can become per-tenant later. |

### 2.9 Testing and quality

| Concern | Technology / proposal |
|---|---|
| Unit and integration tests | **Vitest** (✅) across packages and Express |
| Component tests | Vitest with React Testing Library for Client Components ❓ (Server Components are better covered by end-to-end tests) |
| End-to-end | **Playwright** (✅): login and refresh flow, upload through playback, authorization failures, cookie behavior |
| Phase 0 large-file verification | The 8 GB checks V1 to V12 in ARCHITECTURE.md §5.4, run against a real R2 bucket: boundary sizes, an end-to-end 8 GiB browser upload (Playwright), R2 part rules, per-part presigned URLs and CORS, resume, abort and lifecycle, oversize defense, integrity, worker at 8 GiB, processor independence, slow-link upload and bad input at size |
| Integration infra | Testcontainers or Docker Compose for MongoDB, Redis and an R2-compatible store 🟡 |
| Media fixtures | Small, committed, license-clean sample videos plus deliberately malformed files for rejection tests |
| CI | Lint, typecheck, test, build, dependency and image scanning on every change ❓ CI provider open |

### 2.10 Infrastructure and deployment

| Concern | Proposal | Status |
|---|---|---|
| Containers | Docker images for `web`, `api` and `worker` (one worker image; processors selected by configuration); multi-stage builds | 🟡 |
| Local environment | Docker Compose: MongoDB (replica set), Redis, R2-compatible store; web and api run from the monorepo | 🟡 |
| Edge / routing | Single origin with path routing (`/api` to Express, rest to Next.js) as working assumption (Q17) | 🟡 / ❓ |
| Production orchestration | ❓ Kubernetes vs managed containers vs other (Q12) | ❓ |
| CDN | ❓ Q6, Q15 | ❓ |
| Secrets | Secret manager or platform-injected env; none in the repo; the web app receives no data-store secrets | 🟡 |
| Observability | OpenTelemetry for traces/metrics, Pino for logs; backend ❓ | 🟡 / ❓ |
| IaC | ❓ Terraform / Pulumi / none initially | ❓ |

## 3. Decisions that depend on each other

| If this is decided… | …it constrains |
|---|---|
| Edge topology (Q17) | Cookie scope and names, CORS, CSRF controls, local-dev proxy, Next.js hosting options |
| Next.js hosting (Q12) | Whether single-origin path routing is practical; request-interception behavior |
| R2 verification spike (Q15) | Presigning/CORS behavior, lifecycle rules, CDN options, signed-access mechanism for HLS |
| DRM requirement (Q4) | Packaging format, key management, player choice, CDN options |
| AI deployment model (Q7) | Egress rules, GPU needs, privacy controls, cost model |
| Search backend | Whether MongoDB alone suffices or another datastore joins the stack |
| Tenancy flexibility rules (Q20) | Key conventions, document shape, repository and queue payload design (the MVP is single-tenant, ✅) |
| Worker deployment shape (Q21) | Container resource limits, egress policy per processor, GPU use, scaling approach |
| Part-size and upload policy (Q19) | Browser upload code, API session design, URL issuing cadence, worker scratch sizing |
| Token design (Q18) | Cookie attributes, refresh behavior, key management |

## 4. Open questions specific to the tech stack

Resolved since rev 1 (now ✅ in section 1; rev 3 adds the single worker application, single-tenant MVP and 8 GB limit): Express vs Fastify vs NestJS (**Express**), Mongoose vs native driver (**Mongoose**), auth approach (**JWT + rotating refresh cookies**), UI components and styling (**Tailwind + shadcn/ui**), package manager and task runner (**pnpm + Turborepo**), object store (**R2**), build tool and frontend framework (**Next.js, no Vite**).

| # | Question |
|---|---|
| T1 | ESLint + Prettier or Biome? |
| T2 | How are shared packages consumed by Next.js (pre-built vs transpiled in the Next.js config)? |
| T3 | Which JWT library, signing algorithm and key rotation approach? Login methods (password, SSO, MFA)? |
| T4 | Form library, and is TanStack Query used in Client Components at all? |
| T5 | Zod-to-Express validation middleware: custom or a small library? OpenAPI generation approach? |
| T6 | Search/vector backend for AI-derived data? |
| T7 | Self-hosted vs API-based AI models, and which? |
| T8 | HLS container (fMP4 vs TS), codec ladder and whether DASH is needed? |
| T9 | Observability backend and CI provider? |
| T10 | Managed vs self-hosted Redis and MongoDB? |
| T11 | Local R2 emulation approach and the compatibility test plan (Q16)? |
| T12 | Where does the shadcn/ui component code live (`apps/web` vs a `packages/ui`)? |
| T13 | Initial worker deployment: all processors in one process, or the same image started with different enabled-processor sets (Q21)? |
| T14 | Which tenancy flexibility rules are adopted now (Q20)? |
| T15 | 8 GB upload: part size, parallelism, presigned lifetime, session expiry and checksum approach (Q19)? |
| T16 | Worker resource sizing for 8 GB sources: scratch, memory, FFmpeg threads, timeouts (Q22)? |

Shared questions Q1–Q22 are tracked in [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md).

## 5. Explicitly not decided yet

No dependencies have been installed, no versions pinned, no frameworks scaffolded and no configuration files created. Everything in §2 other than items marked ✅ is a recommendation for review.
