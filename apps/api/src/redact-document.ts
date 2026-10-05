// Strip the owner's credentials from a document DTO for anyone who isn't the
// owner: the owner's id, and the document's primary share code.
//
// A document's `ownerId` is a CREDENTIAL, not a label. For a guest owner it is
// the `X-Owner-Id` bearer value itself, so handing it to a reader hands them
// the thing the server uses to recognise that guest — and `POST /api/migrate`
// will reassign every document, folder, image and preference belonging to an
// owner id to whoever presents it (gated on an HMAC signature only when
// `GUEST_ID_HMAC_SECRET` is configured; unset, knowing the id is enough).
// See docs/specs/014-identity/auth-and-guest-access.md + docs/specs/015-api/public-api-and-tokens.md §4.
//
// This lived as a private `redactOwner` inside routes/share.ts, applied to the
// share-code resolver — "the easiest observation vector". It was the only
// caller, so it wasn't shared. But `GET /api/documents/<id>` reaches the same
// DTO for the same audience (`canReadDocument` admits any valid share code,
// view or edit, because a view-only visitor has to be able to open the
// document), and it returned `ownerId` intact — so the redaction guarded one
// door of two. Hence a module: the rule now has one home, both doors, and a
// test surface of its own, matching the precedent set by image-strip /
// origin-check / share-link-row.
//
// Every non-owner reader already behaved as though this value might be blank:
// the client reads it only to compute `isOwner` (correctly false for a blank),
// and `resolveOwnerBadge` in apps/live/lib/presence-rows.ts documents the
// blank case and falls back to the owner's name + colour. So redacting on the
// second door changes what a non-owner RECEIVES, not what they can do.

// `shareCode` is a credential too. It is the document's OLDEST share link, of
// any role, so a view-link visitor who received it held an edit link. A
// visitor always has their own code already (the one they arrived with), and
// only the owner manages links, so nobody else needs it.

import type { DocumentDTO } from './types';

// `caller` is the resolved owner of the request (Clerk sub, API-token owner,
// or the guest header) — the same value the access gates compare against.
//
// Returns the DTO untouched for the owner, and a copy with `ownerId` blanked
// and `shareCode` nulled for everyone else, including a null caller. Blank
// rather than absent so the wire type stays `ownerId: string` and no client
// has to handle `undefined`; null is the type's existing "no link" value.
export function redactDocumentForReader(liveDoc: DocumentDTO, caller: string | null): DocumentDTO {
  return caller && caller === liveDoc.ownerId
    ? liveDoc
    : { ...liveDoc, ownerId: '', shareCode: null, communityState: null };
}

// A tab-scoped visitor's copy (docs/specs/013-workspace/tab-scoped-share-links.md). Every other tab keeps
// its id and position, so the bar can draw a "Not shared" pill in place, and loses
// its name, folder and timestamp. The deck goes too: slides span tabs.
// `tabScope` null (owner, team member, All-tabs link) returns the document as is.
export function redactDocumentForScope(liveDoc: DocumentDTO, tabScope: string | null): DocumentDTO {
  if (tabScope === null) return liveDoc;
  return {
    ...liveDoc,
    presentation: null,
    tabs: liveDoc.tabs.map((t) =>
      t.id === tabScope
        ? t
        : {
            id: t.id,
            documentId: t.documentId,
            name: '',
            orderIndex: t.orderIndex,
            updatedAt: 0,
            outOfScope: true,
          },
    ),
  };
}
