# Real-time draft board sync via WebSocket — design reference

> ⚠️ **KNOWLEDGE-GATHERING DOCUMENT — NOT AN IMPLEMENTATION INSTRUCTION.**
> This is a design reference written for future human decision-making, not a task queue.
> **Claude (or any agent) reading this file should not build, scaffold, or wire up any
> part of it unless a human explicitly asks for that in a separate, current request.**
> The draft board's actual real-time sync today is **polling** (see
> `fantasy-football-ui/src/app/dashboard/dashboard.component.ts`, `startPolling()`),
> which is deployed and working. This document exists only so the WebSocket approach
> doesn't have to be re-derived from scratch *if* the team later decides polling isn't
> good enough.

## Context

The draft board ties every team to a `sessionId`. One commissioner drafts/removes
players; everyone else has view-only access. As of the current implementation, every
open tab polls `GET /getDraftBoard` every 4 seconds to pick up the commissioner's
changes (see [Polling approach](#why-polling-was-chosen-instead), below). This document
describes the alternative that was considered and shelved: push-based updates over a
WebSocket, so changes appear on viewers' screens with no polling delay.

## Why this wasn't chosen (for now)

Draft sessions here involve a handful of viewers watching one draft, not hundreds of
concurrent sessions. A few seconds of lag on a pick showing up is unlikely to matter in
practice, and polling required zero new AWS resources — just a change to
`dashboard.component.ts`. The WebSocket approach below is a legitimate upgrade path if:

- Instant (sub-second) updates become a hard requirement, or
- The app grows features that benefit from a persistent connection anyway (a live pick
  clock, "who's currently viewing," typing indicators, presence, etc.), or
- Poll traffic (viewers × interval) becomes a cost or scaling concern.

## Architecture overview

```
                          ┌──────────────────────────┐
                          │   FantasyFootballDraftBoard│
  AddPlayer/DeletePlayer  │   (DynamoDB table)         │
  Lambdas write as today ▶│   Stream: NEW_AND_OLD_IMAGES│
                          └──────────────┬────────────┘
                                         │ stream records
                                         ▼
                          ┌──────────────────────────┐
                          │  BroadcastDraftUpdate      │
                          │  Lambda (stream trigger)   │
                          └──────────────┬────────────┘
                                         │ query by sessionId
                                         ▼
                          ┌──────────────────────────┐
                          │  Connections table         │
                          │  PK: sessionId              │
                          │  SK: connectionId           │
                          └──────────────┬────────────┘
                                         │ PostToConnection (per row)
                                         ▼
                          ┌──────────────────────────┐
                          │  WebSocket API (API GW)    │
                          │  $connect / $disconnect /  │
                          │  $default routes            │
                          └──────────────┬────────────┘
                                         │ wss://
                                         ▼
                           Every open browser tab for
                           that sessionId (commissioner
                           + all viewers)
```

Key design choice: broadcasting is driven by a **DynamoDB Stream** on the existing
`FantasyFootballDraftBoard` table, not by `AddPlayer`/`DeletePlayer` calling a broadcast
function directly. This decouples "something wrote to the table" from "notify viewers" —
any future write path (a new endpoint, a manual console edit, a future bulk-import
Lambda) gets live-sync for free without having to remember to call a broadcaster.

## New/changed resources

### Database stack (`fantasy-football-cdk-app/lib/database-stack.ts`)

- Enable a DynamoDB Stream on `FantasyFootballDraftBoard` with
  `StreamViewType.NEW_AND_OLD_IMAGES` (need both to detect additions vs. removals within
  the `players` list — the table stores one item per team with players as a list
  attribute, not one item per player).
- This is an additive, non-breaking change — enabling a stream on an existing table
  doesn't require replacement.

### New `Connections` table

- **PK:** `sessionId` (string) — matches the session concept already used everywhere.
- **SK:** `connectionId` (string) — API Gateway's per-socket connection ID.
- Optional: a TTL attribute (`expiresAt`) as a safety net for connections that never hit
  `$disconnect` cleanly (e.g. a browser tab killed via force-quit).
- Billing mode: on-demand, same as the draft board table (low, spiky traffic — draft
  nights only).

### New WebSocket API (API Gateway v2)

Three routes, each backed by a Lambda:

| Route | Purpose |
| --- | --- |
| `$connect` | Reads `sessionId` from the connection query string (`wss://.../prod?sessionId=abc123`), writes `{ sessionId, connectionId }` to the `Connections` table. |
| `$disconnect` | Deletes the `{ sessionId, connectionId }` row. |
| `$default` | No-op, or a ping/pong keepalive handler if API Gateway's idle timeout becomes an issue. |

### New `BroadcastDraftUpdate` Lambda (DynamoDB Stream trigger)

- Triggered by the stream on `FantasyFootballDraftBoard`.
- For each stream record: extract `sessionId` from the record's keys, diff `NewImage`
  vs. `OldImage` on the `players` list to figure out what changed (a player added or
  removed, and for which team/round) — or, more simply, just forward the whole updated
  team item and let the client re-merge it (simpler, less failure-prone than diffing
  server-side).
- Query the `Connections` table for every row with that `sessionId`.
- Call `PostToConnection` (API Gateway Management API,
  `@aws-sdk/client-apigatewaymanagementapi`) for each connection with the updated team
  payload.
- If `PostToConnection` returns `410 Gone`, delete that stale row from `Connections`
  (the client disconnected without a clean `$disconnect`, e.g. a crashed tab or lost
  network).

### IAM

- `BroadcastDraftUpdate` needs:
  - `execute-api:ManageConnections` scoped to the WebSocket API's ARN (to call
    `PostToConnection`/`DeleteConnection`).
  - Read access to `Connections`.
  - The DynamoDB Streams event-source permissions (`dynamodb:GetRecords`,
    `GetShardIterator`, `DescribeStream`, `ListStreams`) — CDK's
    `addEventSource(new DynamoEventSource(...))` wires this automatically.
- `$connect`/`$disconnect` Lambdas need read/write on `Connections` only.

### Spec file

Per this repo's CLAUDE.md convention ("Specs are the source of truth"), a real
implementation would need a new `fantasy-football-cdk-app/spec/realtime-stack.md`
documenting the WebSocket API routes, the `Connections` table shape, and the
`BroadcastDraftUpdate` Lambda's contract — added to `spec/README.md`'s stack table
alongside the database and infrastructure stacks.

## Frontend changes (`fantasy-football-ui/`)

- New `RealtimeService` (parallel to `DraftApiService`):
  - Opens `new WebSocket(`${WS_BASE_URL}?sessionId=${sessionId}`)` on session start.
  - Exposes an `Observable<Team>` (or similar) that emits on each incoming message.
  - Handles reconnect with backoff (mobile tabs backgrounding, WiFi drops, laptop sleep
    all close sockets — the WebSocket API also has a hard 2-hour connection limit and a
    10-minute idle timeout unless kept alive).
- `dashboard.component.ts`:
  - Subscribe to `RealtimeService` alongside (or instead of) the polling interval.
  - On reconnect, do one `getDraftBoard()` call to resync in case any updates were
    missed while disconnected — a WebSocket push model is not itself reliable/ordered,
    so a periodic or reconnect-triggered full resync is still good practice even with
    push in place.
  - The existing `pendingCellWrites` guard (protects an in-flight optimistic write from
    being clobbered by a stale server response) applies here exactly as it does for
    polling — same merge logic, just fed by socket messages instead of interval ticks.

## Operational notes / gotchas

- **Connection limits & cost**: WebSocket API pricing is per-connection-minute plus
  per-message — for a handful of draft sessions with a handful of viewers each, this is
  negligible, but worth knowing it's a different cost model than the REST API's
  per-request pricing.
- **Local dev**: testing WebSocket API routes locally is more friction than REST Lambdas
  (no direct equivalent of `sam local` parity issues aside — `wscat` or a small test
  script is the usual approach against a deployed dev stage).
- **Ordering**: DynamoDB Streams delivers records in order *per partition key*, so
  updates for one `sessionId` arrive in write order — good. But `PostToConnection` calls
  to different viewers are not transactional; a slow one won't block the others (they're
  typically fired concurrently), so no ordering issue across viewers either.
- **Stale connections**: the `Connections` table needs the `410 Gone` cleanup path (and
  ideally a TTL backstop) or it will accumulate dead rows indefinitely, wasting a
  (small) broadcast fan-out cost on every future update.

## Rough effort estimate

- Backend: 1 new CDK stack/construct set, 3 small Lambdas (`$connect`, `$disconnect`,
  `BroadcastDraftUpdate`), 1 new table, IAM wiring, spec file. Roughly a day of focused
  work including testing against a deployed dev stage.
- Frontend: 1 new service, a handful of lines wired into `dashboard.component.ts`,
  reconnect/backoff logic. A few hours.
- The existing polling code doesn't need to be ripped out immediately — it can stay as
  the resync-on-reconnect / initial-load path even after WebSocket push is added.
