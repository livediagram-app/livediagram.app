// What a reader who is not an item's owner is handed of it: the item's wire shape (each product's DTO) with the
// owner's credentials stripped, and the Community's and a tab-scoped link's narrower copies. Each product's api binds
// these over its own DTO (livediagram's and livehuddle's redact-document.ts); see each product's
// docs/specs/014-identity/auth-and-guest-access.md and docs/specs/015-api/public-api-and-tokens.md section 4.
//
// An item's `ownerId` is no business of a reader's: a guest's id is the same in every liveworkspace app, so it would
// tie the reader's view of this item to that guest everywhere else. `shareCode` is a credential too: it is the
// item's OLDEST share link, of any role, so a view-link visitor who received it held an edit link. A visitor always
// has their own code already (the one they arrived with), and only the owner manages links, so nobody else needs
// it. Every non-owner reader already behaves as though `ownerId` might be blank (the client reads it only to work
// out `isOwner`), so redacting changes what a non-owner RECEIVES, not what they can do.

/** The fields the reader redaction blanks. */
export type ReaderRedactable = {
  ownerId: string;
  shareCode: string | null;
  communityState?: unknown;
};

/**
 * The item untouched for its owner (`caller` is the request's resolved owner: account id, API-token owner, or the
 * guest header, the value the access gates compare against), and for everyone else, a null caller included, a copy
 * with `ownerId` blanked and `shareCode` and `communityState` nulled. Blank rather than absent so the wire type stays
 * `ownerId: string`; null is the type's existing "no link" value.
 */
export function redactItemForReader<T extends ReaderRedactable>(item: T, caller: string | null): T {
  return caller && caller === item.ownerId
    ? item
    : { ...item, ownerId: '', shareCode: null, communityState: null };
}

/** The fields the Community redaction drops. */
export type CommunityRedactable = {
  ownerName: string | null;
  ownerColor: string | null;
  folderId: string | null;
  source: string | null;
  tabs: readonly { connection?: unknown }[];
};

/**
 * A Community visitor's copy (each product's docs/specs/025-community/community.md), on top of the reader
 * redaction: the post names its author (or "Anonymous") itself, so the item carries nobody's name or colour, and
 * nothing about where it sits in its owner's library or came from. A connected tab keeps its name and loses its
 * connection (connected-tabs.md): a stranger is told of no other item.
 */
export function redactItemForCommunity<T extends CommunityRedactable>(item: T): T {
  return {
    ...item,
    ownerName: null,
    ownerColor: null,
    folderId: null,
    source: null,
    tabs: item.tabs.map(({ connection: _connection, ...tab }) => tab),
  };
}

/** The fields the tab-scope redaction reads: the deck, and tabs with their place. */
export type ScopeRedactable = {
  presentation: string | null;
  tabs: readonly { id: string; orderIndex: number }[];
};

/**
 * A tab-scoped visitor's copy (each product's docs/specs/013-workspace/tab-scoped-share-links.md). Every other tab
 * keeps its id, its position and its item's id under `parentKey` (`documentId`, ...), so the bar can draw a "Not
 * shared" pill in place, and loses its name, folder and timestamp. The deck goes too: slides span tabs. `tabScope`
 * null (owner, team member, All-tabs link) returns the item as is.
 */
export function redactItemForScope<T extends ScopeRedactable>(
  item: T,
  tabScope: string | null,
  parentKey: keyof T['tabs'][number] & string,
): T {
  if (tabScope === null) return item;
  return {
    ...item,
    presentation: null,
    tabs: item.tabs.map((t) =>
      t.id === tabScope
        ? t
        : {
            id: t.id,
            [parentKey]: (t as Record<string, unknown>)[parentKey],
            name: '',
            orderIndex: t.orderIndex,
            updatedAt: 0,
            outOfScope: true,
          },
    ),
  };
}
