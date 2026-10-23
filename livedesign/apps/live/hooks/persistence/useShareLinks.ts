// Share-link actions for the Share dialog, lifted out of
// editor-page.tsx: create / revoke a link, build the absolute visitor
// URL, and save the participant's display name (the dialog's identity
// card). The share-link list + shareable flags stay as page state
// because the hydration / save effects also write them; this hook owns
// only the mutations the dialog triggers and reconciles that state
// through the setters passed in.

import type { Dispatch, SetStateAction } from 'react';
import {
  apiCreateShareLink,
  apiDeleteShareLink,
  apiExtendShareLink,
  apiRescopeShareLink,
  apiSaveSelf,
  apiSetSharePassword,
  type ShareLink,
  type ShareLinkExpiry,
  type ShareRole,
} from '@/lib/api-client';
import { LEVEL_TELEMETRY_TYPE } from '@livedesign/api-schema';
import { track } from '@/lib/telemetry';
import { useToast } from '@/hooks/ui/useToast';
import type { Participant } from '@/lib/identity';

type ShareLinksDeps = {
  // The current design id. All link actions no-op until it exists
  // (the editor route always has a real id by the time the dialog is
  // open — the mint-id flow lives on /live/new, docs/specs/007-editor/new-design-route.md).
  designId: string | null;
  selfParticipant: Participant;
  setSelfParticipant: Dispatch<SetStateAction<Participant>>;
  setShareLinks: Dispatch<SetStateAction<ShareLink[]>>;
  // Whether the design has a share password (docs/specs/013-workspace/share-password.md); the
  // password itself never comes back from the api. Reconciled after a save / clear.
  setSharePasswordSet: Dispatch<SetStateAction<boolean>>;
  setDesignShareable: Dispatch<SetStateAction<boolean>>;
  setDesignShareCode: Dispatch<SetStateAction<string | null>>;
  // The design's primary share code; revoke promotes the next link to
  // primary when the current primary is the one being revoked.
  designShareCode: string | null;
  // Marks the participant's name confirmed (share is an implicit
  // confirmation gesture).
  confirmName: () => void;
};

export function useShareLinks(deps: ShareLinksDeps) {
  const {
    designId,
    selfParticipant,
    setSelfParticipant,
    setShareLinks,
    setSharePasswordSet,
    setDesignShareable,
    setDesignShareCode,
    designShareCode,
    confirmName,
  } = deps;
  const toast = useToast();

  // Save the participant's name (used from the share dialog's identity
  // card). Mints the design id if this is the first share gesture so
  // the share URL is shareable from the moment it's created.
  const updateParticipantName = async (name: string) => {
    if (!name) return;
    if (name === selfParticipant.name) return;
    const updated: Participant = { ...selfParticipant, name };
    setSelfParticipant(updated);
    await apiSaveSelf(updated).catch(() => {});
  };

  // Create a new share link for the current design with the given
  // role and lifetime (docs/specs/013-workspace/share-link-expiry.md; 'never' = works until revoked). The
  // editor route always has a real designId by the time the Share
  // dialog is open — the welcome / mint-id flow now lives on
  // /live/new (docs/specs/007-editor/new-design-route.md) — so this just calls the API directly.
  //
  // `tabId` scopes the link to one tab (docs/specs/013-workspace/tab-scoped-share-links.md); null = All tabs.
  const createShareLink = async (
    role: ShareRole,
    expiry: ShareLinkExpiry = 'never',
    tabId: string | null = null,
  ): Promise<ShareLink | undefined> => {
    if (!designId) return undefined;
    confirmName();
    try {
      const link = await apiCreateShareLink(selfParticipant.id, designId, role, expiry, tabId);
      setShareLinks((prev) => [...prev, link]);
      setDesignShareable(true);
      setDesignShareCode((prev) => prev ?? link.code);
      // Telemetry (docs/specs/017-telemetry/telemetry.md): a share link was created. `type` is the
      // role (Edit / View) — a preset, never user content. A chosen
      // lifetime emits a second preset alongside (docs/specs/013-workspace/share-link-expiry.md).
      track('Document', 'Shared', LEVEL_TELEMETRY_TYPE[role]);
      if (expiry !== 'never') {
        const expiryType = {
          week: 'ExpiryWeek',
          month: 'ExpiryMonth',
          sixMonths: 'ExpirySixMonths',
        }[expiry];
        track('Document', 'Shared', expiryType);
      }
      if (tabId) track('Document', 'Shared', 'TabScoped');
      // Returned so the Share dialog can copy the new pass straight away.
      return link;
    } catch {
      toast.error('Could not create the share link. Try again.');
      return undefined;
    }
  };

  // Re-arm an expired (or active) expiring link for another round of
  // its creation-time duration (docs/specs/013-workspace/share-link-expiry.md). The server computes the new
  // deadline; the returned link replaces the stale row in state so the
  // dialog's Active / Inactive split updates immediately.
  const extendShareLink = async (code: string) => {
    if (!designId) return;
    try {
      const link = await apiExtendShareLink(selfParticipant.id, designId, code);
      setShareLinks((prev) => prev.map((l) => (l.code === code ? link : l)));
      track('Document', 'Shared', 'Extended');
    } catch {
      toast.error('Could not extend the link. Try again.');
    }
  };

  // Change which tabs a link opens (docs/specs/013-workspace/tab-scoped-share-links.md). The server tells the
  // link's holders to reload; the returned link replaces the row in place.
  const rescopeShareLink = async (code: string, tabId: string | null) => {
    if (!designId) return;
    try {
      const link = await apiRescopeShareLink(selfParticipant.id, designId, code, tabId);
      setShareLinks((prev) => prev.map((l) => (l.code === code ? link : l)));
      track('Document', 'Shared', 'Rescoped');
    } catch {
      toast.error('Could not change which tabs the link opens. Try again.');
    }
  };

  const revokeShareLink = async (code: string) => {
    if (!designId) return;
    try {
      await apiDeleteShareLink(selfParticipant.id, designId, code);
    } catch {
      // Don't optimistically drop the row when the revoke didn't land: the link
      // still works, so leave it on screen and tell the user.
      toast.error('Could not revoke the link. Try again.');
      return;
    }
    // Counterpart to the Design/Shared emit when a link is created.
    track('Document', 'Removed', 'ShareLink');
    setShareLinks((prev) => {
      const next = prev.filter((l) => l.code !== code);
      if (next.length === 0) {
        setDesignShareable(false);
        setDesignShareCode(null);
      } else if (designShareCode === code) {
        setDesignShareCode(next[0]!.code);
      }
      return next;
    });
  };

  // Set or clear the design's share password (docs/specs/013-workspace/share-password.md). A null / empty
  // value removes it. Persists through the api, reconciles page state, and
  // emits telemetry. Resolves to whether a password is now set (`false` is a
  // successful clear); FAILURE resolves to `undefined`, distinct from both, so
  // the dialog never renders "Saved" / "No password" over a write that didn't land.
  const setDesignSharePassword = async (
    password: string | null,
  ): Promise<boolean | undefined> => {
    if (!designId) return undefined;
    // Trimmed, as the visitor's gate trims what is typed, so the two always agree.
    const trimmed = password?.trim() || null;
    try {
      const passwordSet = await apiSetSharePassword(selfParticipant.id, designId, trimmed);
      setSharePasswordSet(passwordSet);
      // Telemetry (docs/specs/017-telemetry/telemetry.md): the `type` is a preset, never the password.
      track('Document', 'Shared', passwordSet ? 'PasswordSet' : 'PasswordCleared');
      return passwordSet;
    } catch {
      toast.error('Could not update the share password. Try again.');
      return undefined;
    }
  };

  // Absolute share URL helper used by the dialog. Visitor links carry
  // the share code as a query param and land on the dedicated visitor
  // path; the editor page reads the code there. Router stitches /live
  // onto the app's hostname so this URL always resolves end-to-end.
  const shareUrlFor = (code: string) => `${window.location.origin}/design/shared?s=${code}`;

  return {
    updateParticipantName,
    createShareLink,
    extendShareLink,
    rescopeShareLink,
    revokeShareLink,
    setDesignSharePassword,
    shareUrlFor,
  };
}
