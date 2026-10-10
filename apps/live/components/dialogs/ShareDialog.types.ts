import type { ReactNode } from 'react';
import type { ShareLink, ShareLinkExpiry, ShareRole } from '@/lib/api-client';
import type { Participant } from '@/lib/identity';

export type ShareDialogProps = {
  participant: Participant;
  links: ShareLink[];
  // Whether the document has a share password (docs/specs/013-workspace/share-password.md). The
  // password itself is never shown: the api keeps only its hash.
  sharePasswordSet: boolean;
  shareUrlFor: (code: string) => string;
  // The document's tabs, in bar order, for the Live image control's
  // per-tab picker (docs/specs/013-workspace/live-image-share.md) and the link scope pickers
  // (docs/specs/013-workspace/tab-scoped-share-links.md). The first entry is the default the cached
  // snapshot renders; picking another appends `?tab=<id>` to the image
  // URL. Only `id` + `name` are read.
  tabs: { id: string; name: string }[];
  // When non-null, the owner is signed in via Clerk and their display
  // name is dictated by their account — there's nothing to edit, so
  // the "Your name" row hides entirely (docs/specs/007-editor/live-app.md). Guests (null) get
  // the editable name + shuffle row.
  lockedName?: string | null;
  onSaveName: (name: string) => Promise<void> | void;
  // `tabId` scopes the new link to one tab (docs/specs/013-workspace/tab-scoped-share-links.md); null = All tabs.
  // Resolves to the created link, which the dialog copies straight away;
  // undefined when creation failed (the handler has already toasted).
  onCreateLink: (
    role: ShareRole,
    expiry: ShareLinkExpiry,
    tabId: string | null,
  ) => Promise<ShareLink | undefined | void> | void;
  onRevokeLink: (code: string) => Promise<void> | void;
  // Change which tabs an existing link opens; null widens it to All tabs.
  onRescopeLink: (code: string, tabId: string | null) => Promise<void> | void;
  // Re-arm an expiring link for another round of its creation-time
  // duration (docs/specs/013-workspace/share-link-expiry.md). Only rendered on inactive (expired) rows.
  onExtendLink: (code: string) => Promise<void> | void;
  // Set (or clear, with null) the document's share password. Resolves to
  // whether a password is now set on success (`false` = cleared) and
  // `undefined` on FAILURE, so the dialog never reflects a write that didn't land.
  onSetPassword: (password: string | null) => Promise<boolean | undefined> | void;
  // Offline Mode (docs/specs/006-document/offline-mode.md): an offline document lives only in this browser, so
  // it has nothing to share yet. When true the dialog shows a gate asking the
  // owner to sync it to their account first; `onSyncToCloud` performs that
  // conversion (offline -> cloud), after which the real share options apply.
  offline?: boolean;
  onSyncToCloud?: () => Promise<void>;
  // A guest's Share syncs in one click (docs/specs/006-document/offline-mode.md "Sharing a guest's Local
  // only document"): the gate starts the sync as it opens, once `syncReady` (the reader is known).
  syncAtOnce?: boolean;
  syncReady?: boolean;
  // The Community band (docs/specs/025-community/community.md "Publishing"), drawn beneath the
  // password; absent where publishing doesn't apply.
  community?: ReactNode;
  // Listed in the public Community: the status line says Public (docs/specs/025-community/community.md).
  communityListed?: boolean;
  // Why the password can't be set right now (a published document: a post and a password exclude each
  // other), shown in place of the switch's effect; null or absent when it can.
  passwordLockedReason?: string | null;
  onClose: () => void;
};
