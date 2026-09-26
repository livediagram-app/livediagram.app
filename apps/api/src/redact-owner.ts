// Strip the owner's id from a diagram DTO for anyone who isn't the owner.
//
// A diagram's `ownerId` is a CREDENTIAL, not a label. For a guest owner it is
// the `X-Owner-Id` bearer value itself, so handing it to a reader hands them
// the thing the server uses to recognise that guest — and `POST /api/migrate`
// will reassign every diagram, folder, image and preference belonging to an
// owner id to whoever presents it (gated on an HMAC signature only when
// `GUEST_ID_HMAC_SECRET` is configured; unset, knowing the id is enough).
// See docs/specs/014-identity/auth-and-guest-access.md + docs/specs/015-api/public-api-and-tokens.md §4.
//
// This lived as a private `redactOwner` inside routes/share.ts, applied to the
// share-code resolver — "the easiest observation vector". It was the only
// caller, so it wasn't shared. But `GET /api/diagrams/<id>` reaches the same
// DTO for the same audience (`canReadDiagram` admits any valid share code,
// view or edit, because a view-only visitor has to be able to open the
// diagram), and it returned `ownerId` intact — so the redaction guarded one
// door of two. Hence a module: the rule now has one home, both doors, and a
// test surface of its own, matching the precedent set by image-strip /
// origin-check / share-link-row.
//
// Every non-owner reader already behaved as though this value might be blank:
// the client reads it only to compute `isOwner` (correctly false for a blank),
// and `resolveOwnerBadge` in apps/live/lib/presence-rows.ts documents the
// blank case and falls back to the owner's name + colour. So redacting on the
// second door changes what a non-owner RECEIVES, not what they can do.

import type { DiagramDTO } from './types';

// `caller` is the resolved owner of the request (Clerk sub, API-token owner,
// or the guest header) — the same value the access gates compare against.
//
// Returns the DTO untouched for the owner, and a copy with `ownerId` blanked
// for everyone else, including a null caller. Blank rather than absent so the
// wire type stays `ownerId: string` and no client has to handle `undefined`.
export function redactOwnerId(diagram: DiagramDTO, caller: string | null): DiagramDTO {
  return caller && caller === diagram.ownerId ? diagram : { ...diagram, ownerId: '' };
}
