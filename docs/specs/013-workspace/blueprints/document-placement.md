# Document placement on create: blueprint

Derived from [Folders → Placement on create](../folders.md#placement-on-create), with the team rules
of [Team shared documents](../team-shared-documents.md), the wizard surface of
[Dedicated route for new-document creation](../../007-editor/new-document-route.md) and the sync of
[Offline Mode](../../006-document/offline-mode.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited
as `Dn`.

Scope, by file:

| File                                                    | Role                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/api-schema/src/placement.ts`                  | `DocumentPlacement`, `PLACEMENT_REJECTIONS`, `isPlacementRejection`      |
| `apps/api/src/placement/resolve-placement.ts`           | `parsePlacement`, `judgeTeam`, `judgeFolder`, `resolvePlacement`, steps  |
| `apps/api/src/placement/placement-log.ts`               | The `placement:` fingerprints                                            |
| `apps/api/src/placement/placement-lookups.ts`           | `placementLookups(env)`: membership and folder reads behind the resolver |
| `apps/api/src/placement/placement-response.ts`          | `placementRejected(rejection)`: the 4xx envelope                         |
| `apps/api/src/routes/documents.ts`                      | `POST /api/documents` parses, resolves, writes                           |
| `apps/api/src/db/documents.ts`                          | `upsertDocumentMeta` inserts `team_id` beside `folder_id`                |
| `apps/api/src/openapi/manifest.ts`                      | The create body's placement fields, 404 status                           |
| `apps/live/lib/api/documents.ts`                        | `apiCreateDocument` sends `teamId` / `folderId`                          |
| `apps/live/app/new/page.tsx`, `create-failure.ts`       | One create; the failure card's copy and action                           |
| `apps/live/components/chrome/ApiErrorPage.tsx`          | `eyebrow` prop                                                           |
| `apps/live/lib/new-document-params.ts`                  | `choosePlacementAgainUrl`                                                |
| `apps/live/lib/duplicate-document.ts`, `useTeamLibrary` | A team Duplicate is one create into the team                             |
| `apps/live/lib/offline/offline-convert.ts`              | The sync's explicit Unsorted refile on a refused folder                  |

## Domain and naming

| Term        | Identifier                                       | Meaning                                                  |
| ----------- | ------------------------------------------------ | -------------------------------------------------------- |
| Placement   | `DocumentPlacement` `{ teamId, folderId }`       | Where a document is filed; null team = Personal Space    |
| Space       | `scope` in logs: `personal` / `team`             | Personal Space or one team's library                     |
| Root        | `folderId: null`, log `folder=root`              | The space's Unsorted                                     |
| Rejection   | `PlacementRejection`, the response `error` token | A named refusal of the whole create                      |
| Folder step | `FolderStep`, `FOLDER_STEPS`                     | One rung of folder resolution; `null` passes to the next |
| Via         | `via` in logs: `explicit` / `root`               | Which folder step decided                                |
| Re-commit   | `clash` in the route                             | A create naming an id the caller already owns            |

Banned: "fallback" for anything the server does, "location" for placement (Save location is a different
concept: cloud or this browser).

## Behaviour and state

`resolvePlacement(requested, caller, lookups)` is a pure sequence over injected lookups:

1. **Team.** `requested.teamId === null` → space `personal`. Otherwise
   `judgeTeam(caller.verifiedUserId, joined)`: no verified id → `team_forbidden` (the membership lookup is not
   made); `joined === false` → `team_forbidden`; else space `team`.
2. **Folder steps** (`FOLDER_STEPS`), first non-null wins: `explicitFolder` (null when
   `requested.folderId === null`; else `judgeFolder`). When none answers, `spaceRoot` does (`folderId: null`,
   `via: 'root'`). A default-folder step is appended to `FOLDER_STEPS` after `explicitFolder`.
3. `judgeFolder(folder, space, caller, joinedFolderTeam)`:
   - `folder === null` → `folder_not_found`.
   - Same space (`folder.teamId === space.teamId`): team → in place; personal → in place when
     `folder.ownerId === caller.ownerId`, else `folder_not_found`.
   - Other space: visible (`folder.teamId === null ? folder.ownerId === caller.ownerId : joinedFolderTeam`)
     → `folder_scope_mismatch`, else `folder_not_found`. `joinedFolderTeam` is looked up only for a team
     folder in the other space, and only with a verified id (else false).

Route order in `POST /api/documents`: body id/name → dates → tabs → **`parsePlacement`** (`placement_invalid`)
→ clash ownership (403) → name → trash (410) → presentation → **resolve** (genuine create only) → insert.
Invariant: no write happens before resolution has succeeded.

## Interfaces and contracts

- Request: `teamId?: string | null`, `folderId?: string | null`. `parsePlacement` returns null for any other
  type, including an empty string (`D15`).
- Success: unchanged `201 { document }`; `document.teamId` / `folderId` are the resolved placement.
- Rejection: `{ error: PlacementRejection }` with status `placement_invalid` 400, `team_forbidden` 403,
  `folder_not_found` 404, `folder_scope_mismatch` 400.
- Client: `apiCreateDocument(owner, { …, teamId?, folderId? })` puts each in the body only when set; a
  rejection throws `ApiError` whose `code` is the token.

## Data and persistence

- `upsertDocumentMeta` INSERT gains `team_id`, written with `folder_id` in the one statement. Its
  `ON CONFLICT` update never sets `folder_id` or `team_id`, so a re-commit keeps its place.
- No migration: `documents.team_id` exists.

## Errors and edge cases

| Case                                         | Handling                                             |
| -------------------------------------------- | ---------------------------------------------------- |
| Guest names a team                           | `team_forbidden`, no membership read                 |
| Invited, removed, or unknown team            | `team_forbidden`                                     |
| Folder deleted, or someone else's            | `folder_not_found`                                   |
| Own personal folder with a `teamId`          | `folder_scope_mismatch`                              |
| Joined team's folder, personal or other team | `folder_scope_mismatch`                              |
| Unjoined team's folder                       | `folder_not_found`                                   |
| `teamId` / `folderId` a number, object, `""` | `placement_invalid`                                  |
| Re-commit with any well-formed placement     | Stored placement kept, `placement: skipped`          |
| Offline sync folder refused                  | Client re-creates at the root, logs `[offline-sync]` |
| `/new` placement refused                     | Placement card, **Choose another place**             |

## Security and trust

- Team membership is read against `ctx.verifiedUserId` only (Clerk session or API token); `X-Owner-Id`
  never reaches `judgeTeam`.
- `folder_not_found` covers every folder the caller cannot see, so the 404/400 split leaks nothing about
  other people's folders or teams the caller has not joined.
- The owner of a team-placed document is the caller, the verified id, as with `PUT /folder`.

## Performance and limits

At most three point reads before the insert (membership, folder, folder-team membership), each a primary-key
or unique-index lookup; a create without placement makes none.

## Presentation and UX

Copy as the spec states it. The card reuses `ApiErrorPage` with `eyebrow` "Placement refused", title
"Couldn’t file the document there", the reason's message, action **Choose another place**, which
`window.location.assign`s `choosePlacementAgainUrl(search)`: `/new` with `folder`, `team` and the bypass
params removed, every other param kept (`D16`).

## Accessibility

Unchanged card: heading, text and a native button; the copy names the reason in text, not colour.

## Web Experience

No new request on the happy path (one fewer: the follow-up PUT is gone); no layout change.

## Observability

| Fingerprint                                                                        | Where             |
| ---------------------------------------------------------------------------------- | ----------------- |
| `placement: resolved scope=<personal/team> folder=<set/root> via=<step>`           | api, info         |
| `placement: rejected reason=<code> scope=<personal/team>`                          | api, warn         |
| `placement: skipped reason=existing`                                               | api, info         |
| `[offline-sync] placement refused reason=<code>, filed in Unsorted`                | editor, warn      |
| `[new] create failed action=<retry/choose>`                                        | editor, debug log |
| `Http<status>.CreateDocument.<Code>`, e.g. `Http404.CreateDocument.FolderNotFound` | editor telemetry  |

## Testing

| Rule                                                            | Test                                                                  |
| --------------------------------------------------------------- | --------------------------------------------------------------------- |
| Parse, team and folder judgements, step order                   | `apps/api/src/placement/resolve-placement.test.ts`                    |
| Every path end to end in the route, one insert, no write on 4xx | `apps/api/src/routes/document-create-placement.test.ts` (real SQLite) |
| Rejection tokens                                                | `packages/api-schema/src/placement.test.ts`                           |
| Body carries placement                                          | `apps/live/lib/api-client.test.ts`                                    |
| Card copy and action                                            | `apps/live/app/new/create-failure.test.ts`                            |
| Choose-again URL                                                | `apps/live/lib/new-document-params.test.ts`                           |
| Team duplicate is one create                                    | `apps/live/lib/duplicate-document.test.ts`                            |
| Sync refile                                                     | `apps/live/lib/offline/offline-convert.test.ts`                       |
| OpenAPI parity                                                  | `apps/api/src/openapi/*.test.ts`                                      |
| Signed-in /new into a team folder; the refusal card             | `apps/live/e2e/clerk-stub/create-placement.spec.ts`                   |

## Constants and configuration

No magic numbers; the status per rejection is a `Record<PlacementRejection, number>` in
`placement-response.ts`. No environment variable or binding.

## Defaults ledger

D15 and D16 in [DEFAULTS.md](DEFAULTS.md).
