# Commissioner authentication — design proposal

> **STATUS: PROPOSAL — pending review, not yet implemented.**
> This document is for critique before any code is written. Nothing described here
> exists in the codebase yet: the API is currently fully open (per CLAUDE.md, the `prod`
> stage has no auth), and the `commissionerPassword` field on the login screen
> ([login.component.html:32-40](../fantasy-football-ui/src/app/login/login.component.html#L32-L40))
> is collected but never checked against anything. Do not build against this doc until
> it's been reviewed and the open questions at the bottom are resolved.

## Goal

The commissioner (one person per draft session) should be able to enter a password and
get admin privileges — adding/removing players, managing teams, setting the number of
rounds — for the duration of their time in that draft. Everyone else stays view-only.
Cognito was explicitly ruled out as overkill for a fantasy-draft app with a handful of
known users.

## Why "hide the buttons" isn't enough on its own

If the commissioner check only lives client-side (password typed → set a local flag →
show admin buttons), it's UI-only gating. The backend Lambdas (`addPlayer`,
`deletePlayer`, `addTeam`) currently accept requests from anyone, so a determined viewer
could bypass the UI entirely (dev tools, curl, Postman) and write to the board regardless
of the password. That may be an acceptable risk for a trusted friend/family group, but if
"admin privileges" is meant to be a real boundary, the backend needs to enforce
*something* too — see [Option A](#option-a-ui-only-flag-not-a-real-boundary) below for
the "we're fine with that risk" alternative.

## Recommended approach: opaque, DB-backed commissioner token

Stays clear of Cognito/OAuth/JWT libraries — just a random token minted server-side and
checked with a DB read + string compare.

### 1. New session-level DB item

The table today is one item per `(sessionId, teamName)` — there's no natural home for
session-wide settings like a password hash or round count. Add one more item per
session using a reserved sort key so it lives in the same table (no new table, no new
stack):

```json
{
  "sessionId": "1234",
  "teamName": "__session__",
  "commissionerPasswordHash": "<sha256 or bcrypt hash>",
  "commissionerToken": "<opaque token, present only while a commissioner is logged in>",
  "rounds": 15
}
```

- `teamName = "__session__"` is a sentinel that can never collide with a real team name
  (team names come from user input via `addTeam`, so this needs a guard: `addTeam`
  should reject `"__session__"` as a team name).
- `GetDraftBoard`'s existing `Query` on `sessionId` will now also return this item —
  needs a filter to exclude `teamName === "__session__"` from the `teams` array in the
  response (or the Lambda could `GetItem` it separately instead of relying on the filter;
  either works, filter is simpler).
- `rounds` moves here instead of being hardcoded to `15` in `dashboard.component.ts`
  ([dashboard.component.ts:36](../fantasy-football-ui/src/app/dashboard/dashboard.component.ts#L36)) — this is what makes "commissioner sets number of rounds" possible at all, since round count becomes a per-session, server-owned value instead of a client constant.

### 2. New endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/verifyCommissioner` | Body: `{ sessionId, password }`. Hashes the password, compares to `commissionerPasswordHash`. On match: generates `crypto.randomBytes(24).toString('hex')`, writes it to `commissionerToken` on the `__session__` item, returns `{ token }`. On mismatch: `401`. |
| `POST` | `/setRounds` | Body: `{ sessionId, rounds }` + `X-Commissioner-Token` header. Updates `rounds` on the `__session__` item. Commissioner-only (see below). |

### 3. Enforcing the token on writes

`addPlayer`, `deletePlayer`, `addTeam`, and `setRounds` all require an
`X-Commissioner-Token` header. Each does a `GetItem` on the `__session__` item and
compares the header value to `commissionerToken`. No match (or no `__session__` item
yet, i.e. no commissioner has ever logged in) → `403`.

This check is identical across four Lambdas, so it's worth factoring into one shared
helper (e.g. `lambda/models/auth.js`, alongside the existing `lambda/models/team.js`
validators) rather than copy-pasted four times.

*Alternative enforcement point:* API Gateway supports a `RequestAuthorizer` Lambda that
could gate all four write routes centrally, so the write Lambdas themselves stay
unaware of auth entirely. More idiomatic AWS, marginally more CDK wiring (one more
construct + attaching it to four methods). Worth considering if the shared-helper
approach feels like it's leaking auth concerns into every write Lambda.

### 4. Client-side lifecycle ("privileges until they leave the draft")

- `SessionService` gets `setCommissionerToken()` / `getCommissionerToken()` /
  `clearCommissionerToken()`, backed by **`sessionStorage`**, not `localStorage` — unlike
  the session id (which persists across tab closes on purpose, via `localStorage`), the
  commissioner token should not survive closing the tab.
- `leaveDraft()` ([dashboard.component.ts:78-81](../fantasy-football-ui/src/app/dashboard/dashboard.component.ts#L78-L81)) additionally calls `clearCommissionerToken()`.
- This gives "commissioner until they leave the draft" with no expiry/TTL logic needed:
  closing the tab or clicking "Leave Draft" both end it naturally.
- `login.component.ts`'s `enterDraft()` calls `POST /verifyCommissioner` when a password
  was entered; on success, stores the token and proceeds; on failure, shows an inline
  error and does *not* navigate (currently `enterDraft()` navigates unconditionally,
  regardless of the password field). If the password field is left blank, `enterDraft()`
  proceeds as a viewer (no token) — same room, no privileges.
- `DraftApiService`'s write methods (`addPlayer`, `deletePlayer`, `addTeam`) attach the
  `X-Commissioner-Token` header from `SessionService` when present.
- `dashboard.component.ts` gates the existing admin affordances (clicking a cell to
  draft, the delete-player action, "Add Team") behind `sessionService.isCommissioner()`
  (or similar) in the template — same idea as today, just now backed by something real
  on the server side too.

### 5. Spec updates

Per CLAUDE.md, this touches both stacks and both specs would need updating in the same
change as any real implementation:

- `spec/database-stack.md` — document the `__session__` item shape and the reserved
  `teamName` sentinel.
- `spec/infrastructure-stack.md` — document `/verifyCommissioner`, `/setRounds`, and the
  `X-Commissioner-Token` requirement added to `/addPlayer`, `/deletePlayer`, `/addTeam`.

## Alternatives considered

### Option A: UI-only flag (not a real boundary)

Password check happens once, client-side flag flips, admin buttons appear. Zero backend
changes. Fine if the team is comfortable trusting everyone with API access (friends and
family, not a public link) and just wants the password as a soft deterrent /
"don't accidentally draft as the wrong person" guard rather than real security.

### Option B: Stateless signed token (HMAC, JWT-style)

Same `verifyCommissioner` flow, but instead of writing an opaque token to the DB and
reading it back on every write, the Lambda signs a payload (`{ sessionId, exp }`) with a
shared secret (`crypto.createHmac`), and write Lambdas verify the signature locally —
no DB read per write. Saves one `GetItem` per write call, at the cost of managing a
shared secret (CDK-injected env var or Secrets Manager) and writing expiry/rotation
logic. Not recommended here — the extra read is cheap at this traffic volume (a live
draft is a handful of writes over a couple hours), and the DB-backed token is simpler to
reason about and to revoke (just delete/overwrite the `commissionerToken` attribute).

## Open questions for review

1. **"Setting teams"** — does this mean just adding teams (already exists via
   `/addTeam`, would just gain the token check), or also renaming/removing teams
   mid-draft? If removal is needed, that's a new `/deleteTeam` endpoint not scoped here.
2. **Two commissioners at once.** A single `commissionerToken` on the `__session__` item
   means a second successful login (e.g. same person on a second device) silently
   invalidates the first token. Acceptable, or should multiple concurrent tokens be
   supported (e.g. a small list instead of a single string)?
3. **Password provisioning.** The two existing draft rooms (`DRAFT_ROOMS` in
   `constants.ts`) are hardcoded client-side constants, not created through any API —
   there's no "create a session" flow today. Is seeding `commissionerPasswordHash` via a
   one-off manual `PutItem`/console edit acceptable, or is a proper "set/rotate password"
   admin endpoint wanted from the start?
4. **Hash choice.** Plain `sha256` (fast, no dependency, fine if the password itself
   isn't meant to resist offline brute-force since this isn't public-facing) vs. `bcrypt`
   (slower by design, needs a dependency, more defensible if this API is ever opened up
   more broadly). Recommend `sha256` given the threat model, but flagging the trade-off.
5. **Rate limiting `/verifyCommissioner`.** Worth a basic per-`sessionId` attempt
   counter/lockout, or is that overkill for this threat model? Leaning overkill, but
   worth a conscious no rather than an oversight.
