// Strip the owner's credentials from a design DTO for anyone who isn't the
// owner: the owner's id, and the design's primary share code.
//
// A design's `ownerId` is personal, not a label: a person's id (an account's, or a guest's) names them across
// every liveworkspace app, so a reader is never handed it. See docs/specs/014-identity/auth-and-guest-access.md.
//
// This lived as a private `redactOwner` inside routes/share.ts, applied to the
// share-code resolver — "the easiest observation vector". It was the only
// caller, so it wasn't shared. But `GET /api/designs/<id>` reaches the same
// DTO for the same audience (`canReadDesign` admits any valid share code,
// view or edit, because a view-only visitor has to be able to open the
// design), and it returned `ownerId` intact — so the redaction guarded one
// door of two. Hence a module: the rule now has one home, both doors, and a
// test surface of its own, matching the precedent set by image-strip /
// origin-check / share-link-row.
//
// Every non-owner reader already behaved as though this value might be blank:
// the client reads it only to compute `isOwner` (correctly false for a blank),
// and `resolveOwnerBadge` in apps/live/lib/presence-rows.ts designs the
// blank case and falls back to the owner's name + colour. So redacting on the
// second door changes what a non-owner RECEIVES, not what they can do.

// `shareCode` is a credential too. It is the design's OLDEST share link, of
// any role, so a view-link visitor who received it held an edit link. A
// visitor always has their own code already (the one they arrived with), and
// only the owner manages links, so nobody else needs it.

import type { DesignDTO } from './types';

// `caller` is the resolved owner of the request (account id, API-token owner,
// or the guest header) — the same value the access gates compare against.
//
// Returns the DTO untouched for the owner, and a copy with `ownerId` blanked
// and `shareCode` nulled for everyone else, including a null caller. Blank
// rather than absent so the wire type stays `ownerId: string` and no client
// has to handle `undefined`; null is the type's existing "no link" value.
export function redactDesignForReader(liveDoc: DesignDTO, caller: string | null): DesignDTO {
  return caller && caller === liveDoc.ownerId
    ? liveDoc
    : { ...liveDoc, ownerId: '', shareCode: null };
}

// A tab-scoped visitor's copy (docs/specs/013-workspace/tab-scoped-share-links.md). Every other tab keeps
// its id and position, so the bar can draw a "Not shared" pill in place, and loses
// its name, folder and timestamp. The deck goes too: slides span tabs.
// `tabScope` null (owner, team member, All-tabs link) returns the design as is.
export function redactDesignForScope(liveDoc: DesignDTO, tabScope: string | null): DesignDTO {
  if (tabScope === null) return liveDoc;
  return {
    ...liveDoc,
    presentation: null,
    tabs: liveDoc.tabs.map((t) =>
      t.id === tabScope
        ? t
        : {
            id: t.id,
            designId: t.designId,
            name: '',
            orderIndex: t.orderIndex,
            updatedAt: 0,
            outOfScope: true,
          },
    ),
  };
}
