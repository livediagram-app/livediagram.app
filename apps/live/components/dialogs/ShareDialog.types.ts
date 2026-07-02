import type { ShareLink, ShareLinkExpiry, ShareRole } from '@/lib/api-client';
import type { Participant } from '@/lib/identity';

export type ShareDialogProps = {
  participant: Participant;
  links: ShareLink[];
  // The diagram's current share password (spec/24), or null when unset.
  // Shown in the clear so the owner can always see + change it.
  sharePassword: string | null;
  shareUrlFor: (code: string) => string;
  // The diagram's tabs, in bar order, for the Live image control's
  // per-tab picker (spec/54). The first entry is the default the cached
  // snapshot renders; picking another appends `?tab=<id>` to the image
  // URL. Only `id` + `name` are read.
  tabs: { id: string; name: string }[];
  // Whether the owner has confirmed their name (drives the share button
  // behaviour but no longer hides the identity card).
  nameConfirmed: boolean;
  // When non-null, the owner is signed in via Clerk and their display
  // name is dictated by their account — there's nothing to edit, so
  // the "Your name" row hides entirely (spec/07). Guests (null) get
  // the editable name + shuffle row.
  lockedName?: string | null;
  onSaveName: (name: string) => Promise<void> | void;
  onCreateLink: (role: ShareRole, expiry: ShareLinkExpiry) => Promise<void> | void;
  onRevokeLink: (code: string) => Promise<void> | void;
  // Re-arm an expiring link for another round of its creation-time
  // duration (spec/34). Only rendered on inactive (expired) rows.
  onExtendLink: (code: string) => Promise<void> | void;
  // Set (or clear, with null) the diagram's share password. Resolves to
  // the stored value on success (`null` = cleared) and `undefined` on
  // FAILURE, so the field never reflects a write that didn't land.
  onSetPassword: (password: string | null) => Promise<string | null | undefined> | void;
  onClose: () => void;
};
