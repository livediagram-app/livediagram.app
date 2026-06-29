import type { ShareLink, ShareLinkExpiry, ShareRole } from '@/lib/api-client';
import type { Participant } from '@/lib/identity';

export type ShareDialogProps = {
  participant: Participant;
  links: ShareLink[];
  // The diagram's current share password (spec/24), or null when unset.
  // Shown in the clear so the owner can always see + change it.
  sharePassword: string | null;
  shareUrlFor: (code: string) => string;
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
  // Set (or clear, with null) the diagram's share password. Returns the
  // stored value so the field can reflect what now gates access.
  onSetPassword: (password: string | null) => Promise<string | null> | void;
  onClose: () => void;
};
