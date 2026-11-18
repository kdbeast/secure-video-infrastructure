# Secure Intelligent Video Infrastructure: Project Overview

> **Status:** Planning draft. No application code exists yet.
> **Last updated:** 2026-11-16 (rev 3: single worker app with processors, single-tenant MVP, 8 GB upload requirement)
> **Companion docs:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [TECH_STACK.md](./TECH_STACK.md)

## How to read decision status

Every statement about scope or design in these three documents carries one of these labels.

| Label | Meaning |
|---|---|
| ✅ **Confirmed** | Explicitly decided by the project owner. Change only by deliberate decision. |
| 🟡 **Proposed** | Recommended default, proposed for review. Treated as the working assumption until challenged. |
| ❓ **Open** | Undecided. Needs an answer before the relevant phase starts. |

Anything not marked ✅ should not be treated as a commitment.

---

## 1. Purpose

Secure Intelligent Video Infrastructure is a platform for **ingesting, processing, protecting, enriching and delivering video**. It has two defining characteristics:

- **Secure:** uploaded media is treated as untrusted input, stored privately, and only reachable through authorized, time-limited access.
- **Intelligent:** each video is automatically analyzed (for example transcription, scene and content understanding, moderation, search indexing) so that video becomes searchable and governable, not just playable.

## 2. Confirmed decisions

| # | Decision | Status |
|---|---|---|
| C1 | Modular **TypeScript monorepo**, managed with **pnpm + Turborepo** | ✅ Confirmed |
| C2 | **Next.js + TypeScript using the App Router** for the frontend (React is used through Next.js). **Vite is not used.** | ✅ Confirmed (corrects rev 1, which proposed React + Vite) |
| C3 | **Express + TypeScript** as the dedicated backend API. Next.js API routes do **not** replace it. | ✅ Confirmed |
| C4 | **MongoDB with Mongoose** as the primary database layer | ✅ Confirmed |
| C5 | **Redis** for queue backing, rate limiting, caching and ephemeral state | ✅ Confirmed |
| C6 | **BullMQ** for background job orchestration | ✅ Confirmed |
| C7 | **FFmpeg** for probing, transcoding and packaging | ✅ Confirmed |
| C8 | **Cloudflare R2** (S3-compatible API) for all media and derived artifacts | ✅ Confirmed |
| C9 | **One worker application (`apps/worker`) with separate processors** for ingest, transcode, AI and maintenance. The worker app is separate from Next.js and Express: never merged into the API and never run inside Next.js. | ✅ Confirmed (supersedes the rev 1/2 description of four separate worker applications) |
| C10 | Planning begins with documentation only; no code or package installs yet | ✅ Confirmed |
| C11 | **Authentication: JWT plus rotating refresh tokens delivered in secure cookies** | ✅ Confirmed (cookie attributes and topology details are 🟡/❓ in ARCHITECTURE.md §6.6) |
| C12 | **Tailwind CSS + shadcn/ui** for styling and UI components | ✅ Confirmed |
| C13 | **Zod** for validation | ✅ Confirmed |
| C14 | **Vitest** (unit/integration) and **Playwright** (end-to-end) for testing | ✅ Confirmed |
| C15 | Next.js talks to Express **over HTTP only**. Heavy processing never runs in Next.js request handlers. | ✅ Confirmed |
| C16 | **Single-tenant MVP, designed for future multi-tenancy.** Multi-tenancy is not implemented now; the architecture preserves flexibility for later tenant isolation. | ✅ Confirmed |
| C17 | **Maximum supported video upload size: 8 GB.** | ✅ Confirmed (unit interpretation and implementation details are ❓, see Q19) |

Everything else in these documents is 🟡 Proposed or ❓ Open.

## 3. Goals and non-goals

### Confirmed requirements (✅)

| # | Requirement |
|---|---|
| R1 | **Maximum supported video upload size is 8 GB.** Uploads up to this size must work end to end (upload, ingest, transcode, playback), and larger uploads must be rejected. See ARCHITECTURE.md §5.4 and the Phase 0 verification list in §7 below. |
| R2 | **Single-tenant MVP.** One tenant per deployment in the MVP. Multi-tenancy is a later, separate effort, and the design must not make it unnecessarily hard. |

### Goals (🟡 Proposed unless noted)

1. Accept large video uploads reliably, up to the confirmed 8 GB maximum (R1), including resumable and multipart uploads, without routing bytes through Next.js or Express.
2. Produce adaptive-bitrate streams (HLS) from arbitrary source files.
3. Never expose raw or processed media through public, guessable URLs.
4. Run heavy work (FFmpeg, AI inference) in a worker application that is separate from Next.js and Express, with independently configured processors that can later be split into separate deployables.
5. Generate AI-derived metadata asynchronously without delaying playback availability.
6. Keep modules cleanly bounded so any module can be extracted into its own service later.

### Non-goals for the initial phases (🟡 Proposed)

- Live streaming and real-time ingest.
- Full DRM (Widevine / FairPlay / PlayReady). Tracked as an open question.
- Video editing, clipping or timeline tools.
- Native mobile apps.
- Multi-region active-active deployment.
- **Implementing multi-tenancy** (tenant management, per-tenant isolation, per-tenant quotas or billing). Only architectural flexibility for it is in scope now (R2).
- Uploads larger than 8 GB.

## 4. Users and roles (🟡 Proposed)

| Role | Needs |
|---|---|
| **Uploader / Creator** | Upload videos, track processing status, manage metadata, control who can watch. |
| **Viewer** | Authorized playback, search across video content. |
| **Administrator** | Manage users, roles, quotas, retention and audit visibility for the single tenant. |
| **Platform Operator** | Monitor queues and the worker application, handle failures, manage infrastructure. |

✅ **Tenancy:** the MVP is single-tenant (C16). There is exactly one tenant per deployment, and no tenant-management features exist. The design rules that keep future multi-tenancy possible are in ARCHITECTURE.md §6.7 (🟡 Proposed). The only open follow-up is Q20 (which flexibility rules to adopt now, and the preferred future isolation model).

## 5. Modules and responsibilities

Each module is a bounded unit in the monorepo (🟡 Proposed). Modules communicate through typed interfaces and queue messages, never by reaching into each other's persistence.

| Module | Type | Responsibility |
|---|---|---|
| **web** | App (Next.js, App Router) | Rendering, routing and UI: upload UI, library, player, search, admin screens. Talks to the backend **only over HTTP to the Express API**. Holds no database, queue or storage credentials and contains no business logic or media processing. |
| **api** | App (Express + TypeScript) | The single backend API. Authentication, authorization, request validation, upload session orchestration, playback authorization, job enqueueing. Does **not** run FFmpeg or AI. |
| **worker** | App (Node.js; `apps/worker`) | The **single worker application**. Consumes BullMQ queues through four separate **processors** (table below). Separate from Next.js and Express. Never merged into the API. Exposes no public HTTP. |
| **auth** | Package | Identity, sessions/tokens, RBAC policy evaluation. |
| **videos** | Package | Video domain model, state machine, metadata. |
| **uploads** | Package | Upload session logic, multipart coordination, validation rules. |
| **playback** | Package | Playback authorization and signed-access issuing. |
| **pipeline** | Package | Job definitions, queue names, payload schemas, flow composition. |
| **storage** | Package | S3-compatible client abstraction, bucket and key conventions, presigning. |
| **ai** | Package | AI stage interfaces and provider adapters. |
| **contracts** | Package | Browser-safe Zod schemas and API types shared by `web`, `api` and workers. Imports nothing server-only. 🟡 Proposed. |
| **shared** | Package | Server-side utilities: config loading, logging, errors. Not imported by `web`. |

### Processors inside `apps/worker` (✅ four processors, 🟡 details)

Each processor has its own queue configuration, its own concurrency setting and its own resource configuration. Processors do not import each other and communicate only through queues, so any of them can later be split into its own deployable.

| Processor | Queue(s) | Responsibility |
|---|---|---|
| **ingest** | `ingest` | Validates uploaded objects, runs `ffprobe`, enforces limits (including the 8 GB maximum), computes or verifies checksums, accepts or rejects media. |
| **transcode** | `transcode`, `package` | Produces renditions, HLS packaging, thumbnails and posters with FFmpeg. |
| **ai** | `ai.<stage>` | Runs the AI pipeline stages and writes results back. |
| **maintenance** | `maintenance` | Scheduled and housekeeping jobs: orphaned upload cleanup, retention enforcement, re-processing. |

The exact folder layout is described in [ARCHITECTURE.md](./ARCHITECTURE.md).

## 6. Upload-to-playback summary

A one-paragraph view; the full step-by-step flow is in ARCHITECTURE.md.

A creator uses the Next.js app, whose upload component requests an upload session from the Express API. The API checks authorization and quota, records a video in `PENDING_UPLOAD`, and returns presigned multipart URLs. The browser uploads directly to a private raw-media bucket on Cloudflare R2, in parts, so files up to the confirmed 8 GB maximum can be uploaded and resumed. On completion the API verifies the object and enqueues an ingest job. The worker application's ingest processor probes and validates the file; its transcode processor produces an HLS ladder and thumbnails into a private processed-media bucket; the video becomes `READY` and playable. AI jobs fan out in parallel and enrich the video later without blocking playback. Viewers request a playback session from the API, which authorizes them and returns short-lived signed access to the manifest and segments.

## 7. Delivery phases (🟡 Proposed)

| Phase | Outcome |
|---|---|
| **0. Foundation** | Monorepo skeleton, lint/test/build tooling, local dev environment (Mongo, Redis, S3-compatible store), CI. **Plus the R2 and 8 GB verification spike** (list below). |
| **1. Core pipeline** | Auth, upload sessions, ingest, single-ladder HLS transcode, playback authorization, basic player. |
| **2. Hardening** | Full ABR ladder, retries and dead-letter handling, observability, rate limits, sandboxing of FFmpeg. |
| **3. Intelligence** | Transcription, thumbnails/scene detection, moderation, search indexing. |
| **4. Scale and governance** | Retention policies, audit logging, quotas, cost controls. Multi-tenancy is **not** planned here; it would be a separate, later effort (R2). |

### Phase 0 verification requirements for the 8 GB maximum (✅ requirement, 🟡 test plan)

The detailed checks are in ARCHITECTURE.md §5.4. In summary, Phase 0 must demonstrate, against a real Cloudflare R2 bucket:

1. A file at the maximum size (and one just over it) behaves as specified: accepted at the limit, rejected above it.
2. Browser-direct multipart upload of an 8 GB file completes, resumes after interruption, and aborts cleanly.
3. R2's multipart constraints (equal part sizes, 5 MiB minimum part, 10,000-part cap) are respected by the chosen part-size policy, and per-part presigned URLs plus browser CORS work.
4. The worker application can download, probe and transcode an 8 GB source within its configured scratch-disk, memory and time limits.

## 8. Open questions

These are consolidated from all three documents. Each should be answered before the phase noted.

| # | Question | Needed by |
|---|---|---|
| Q1 | ~~Single-tenant or multi-tenant?~~ **Resolved: single-tenant MVP, designed for future multi-tenancy (C16).** The tenant isolation model for the future (shared or per-tenant buckets and databases) is deliberately deferred; see Q20. | n/a |
| Q2 | What is the target scale (videos per day, max duration, concurrent viewers)? **Maximum file size is resolved: 8 GB (C17).** | Phase 0 |
| Q3 | ~~Which object store provider?~~ **Resolved: Cloudflare R2 (C8).** Follow-ups are Q15 and Q16. | n/a |
| Q4 | Is full DRM required, or are signed URLs/cookies plus AES-128 HLS encryption sufficient? | Phase 1 |
| Q5 | Are viewers authenticated users only, or must anonymous/share-link playback be supported? | Phase 1 |
| Q6 | Is a CDN in scope, and if so which one? | Phase 1 |
| Q7 | AI deployment model: external APIs, self-hosted models, or a hybrid? Are there data-residency constraints that forbid sending video or audio to third parties? | Phase 3 |
| Q8 | Which AI capabilities are mandatory for the first AI release? | Phase 3 |
| Q9 | Retention rules: how long are original uploads kept after transcoding? | Phase 2 |
| Q10 | Which compliance regimes apply (GDPR, SOC 2, HIPAA, others)? | Phase 2 |
| Q11 | ~~Auth approach?~~ **Resolved: JWT + rotating refresh tokens in secure cookies (C11).** Follow-ups are Q17 and Q18. | n/a |
| Q12 | Target deployment for Express, the worker application **and Next.js** (Node container, managed container service, Kubernetes, or a platform host for Next.js)? | Phase 2 |
| Q13 | ~~Package manager and task runner?~~ **Resolved: pnpm + Turborepo (C1).** | n/a |
| Q14 | ~~UI stack?~~ **Resolved: Tailwind + shadcn/ui (C12).** Remaining: brand tokens, themes, accessibility targets. | Phase 1 |
| Q15 | R2 topology: public custom domain for processed media, or access only through the S3 API endpoint? Which Cloudflare features (Workers, CDN, WAF) are in scope? | Phase 0 |
| Q16 | Local development and CI: emulate R2 (for example MinIO) or use real R2 dev buckets? What compatibility tests are required against real R2? | Phase 0 |
| Q17 | Edge topology: single origin with path routing (`/api` to Express) or separate subdomains (`app.` / `api.`)? Drives cookie and CORS design (ARCHITECTURE.md §6.6). | Phase 0 |
| Q18 | Token details: access-token lifetime, refresh lifetime, signing algorithm and key rotation, reuse-detection grace window, login methods (password, SSO, MFA). | Phase 1 |
| Q19 | **8 GB upload details.** Is "8 GB" 8,000,000,000 bytes or 8 GiB (8,589,934,592 bytes)? (Working assumption: design and test for 8 GiB, which covers both readings.) Part-size policy, checksum policy, maximum duration, and presigned-URL lifetime/refresh strategy for multi-hour uploads. | Phase 0 |
| Q20 | **Tenancy flexibility.** Which of the proposed future-proofing rules (ARCHITECTURE.md §6.7) are adopted now (for example a tenant identifier on every document and storage key, set to one default tenant)? Which future isolation model is preferred: shared database and buckets with a tenant key, per-tenant buckets, or per-tenant databases? (Decision on the future model can wait; the MVP rules cannot.) | Phase 0 |
| Q21 | **Worker deployment shape.** Initially run all four processors in one process, or run several instances of the same worker image with different enabled-processor sets? What triggers a split (GPU needs, egress restrictions, FFmpeg load starving ingest)? | Phase 0 |
| Q22 | **Worker resource sizing for 8 GB sources.** Scratch-disk budget, memory, FFmpeg thread limits, job timeouts and lock durations per processor. To be derived from the Phase 0 measurements. | Phase 0 |

## 9. Glossary

| Term | Meaning |
|---|---|
| **ABR** | Adaptive bitrate: the player switches between quality levels based on network conditions. |
| **HLS** | HTTP Live Streaming: playlist plus segment based delivery. |
| **Rendition** | One encoded quality level (resolution and bitrate) of a video. |
| **Ladder** | The set of renditions produced for a video. |
| **Presigned URL** | Time-limited URL granting temporary access to one object operation. |
| **RSC** | React Server Component: renders on the server in Next.js and ships no component JavaScript to the browser. |
| **Client Component** | A component marked `"use client"`; hydrates in the browser and can use state, effects and browser APIs. |
| **DLQ** | Dead-letter queue for jobs that exhausted retries. |
