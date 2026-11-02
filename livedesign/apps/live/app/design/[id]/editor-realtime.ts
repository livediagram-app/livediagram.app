import { useRef, useState } from 'react';

import type { CommunityShareInfo } from '@livedesign/api-schema';
import { connectRoom, type ShareRole } from '@/lib/api-client';
import { mayShareDesign } from './editor-page-helpers';
import { useChangesetSeen } from './useChangesetSeen';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';

// Sharing, session-permission and realtime-room infrastructure for the
// editor: the shareable / team / share-code flags that decide whether
// the WebSocket room runs, the owner-vs-visitor identity + owner badge
// info, the share-link list + password, the granted session role +
// session share code, and the room ref. A cohesive slice
// lifted out of useEditorState — same pattern as usePanelLayout /
// usePresenceState.
//
// The room-presence VALUES (cursors, selections, laser trails) live in
// usePresenceState; this slice owns the gating + connection plumbing the
// hydration/bootstrap, autosave and room hooks read and write.

// A design opened from the Community (docs/specs/025-community/community.md): the post and its author, and the
// design's own id when the viewer is its author (the Community bar then offers to edit it rather than copy it),
// else null.
export type CommunitySession = CommunityShareInfo & { ownDesignId: string | null };

export function useEditorRealtime() {
  // Single open room connection for the current design. Re-opens
  // whenever designId changes.
  const roomRef = useRef<ReturnType<typeof connectRoom> | null>(null);
  // Whether the design is saved on the server, so it has a room (docs/specs/024-agents/
  // agent-changesets.md "Rooms for personal designs"): every server-stored design opens one,
  // personal ones included, since an agent is a second writer. False for an Offline Mode design
  // and until a load succeeds.
  const [designServerStored, setDesignServerStored] = useState(false);
  // The changeset revision each loaded tab holds (useChangesetSeen): set by every tab load, raised
  // by every changeset applied, sent with every save.
  const changesetSeen = useChangesetSeen();
  // Sharing state for the current design. Mirrors the API row's
  // `shareable` + `shareCode` columns; refreshed on hydration, and
  // after share / unshare. Drives whether realtime (WS room) is
  // active.
  const [designShareable, setDesignShareable] = useState(false);
  // Team library placement (docs/specs/013-workspace/team-shared-designs.md): non-null when the design lives
  // in a team's shared library. Drives the header badge's "Team"
  // state (shareable still wins with "Shared").
  const [designTeamId, setDesignTeamId] = useState<string | null>(null);
  // The legacy single share code (back-compat fallback for older
  // designs that haven't been migrated to share_links yet, and for
  // visitor arrivals that came in via the legacy URL flow). Modern
  // designs populate shareLinks instead.
  const [designShareCode, setDesignShareCode] = useState<string | null>(null);
  // True for the owner of the loaded design; false for visitors who
  // arrived via /live/design/shared?s=<code>. Drives whether the
  // Share button shows.
  const [isOwner, setIsOwner] = useState(true);
  // The design's owner id (from the api fetch). Used to derive the
  // owner badge at the top of the canvas: when the owner is currently
  // in the room their full Participant row is in `livePresence` and we
  // can show avatar + name; otherwise the badge shows just the role
  // strip (Viewing / Editing) and skips the owner row entirely.
  const [designOwnerId, setDesignOwnerId] = useState<string | null>(null);
  // Owner display info from the design fetch (api worker joins
  // participants on design.ownerId). Lets the top-middle Owner badge
  // render for visitors even when the owner isn't currently in the
  // realtime room — livePresence would otherwise be empty, and the
  // badge would hide.
  const [designOwnerName, setDesignOwnerName] = useState<string | null>(null);
  const [designOwnerColor, setDesignOwnerColor] = useState<string | null>(null);
  // Visitor-side "Make a copy" loading flag. Header button disables
  // itself while the api round-trips so a frantic double-click can't
  // produce two copies under the user's account.
  const [copying, setCopying] = useState(false);
  // `passwordRetry` bumps to re-run the bootstrap once the visitor
  // submits a password (see the bootstrap effect deps).
  const [passwordRetry, setPasswordRetry] = useState(0);
  // Viewer-side password gate. Non-null when the visitor's share URL
  // points at a password-protected design and they haven't supplied a
  // valid password yet. Read early by the preferences + capabilities
  // gates.
  const [sharePasswordGate, setSharePasswordGate] = useState<{ invalid: boolean } | null>(null);
  // The role granted to the current session. Owners always have 'edit';
  // visitors get whatever role their share code carried. Drives the
  // save / op-broadcast gates so view-only visitors can't push edits.
  const [sessionRole, setSessionRole] = useState<ShareRole>('edit');
  // Visitors are admitted via a share code in the URL (?s=<code>).
  // Owners arrive via ?d=<id> with no share code. Write endpoints
  // accept the code as a fallback authorisation so edit visitors can
  // persist their changes; null means "owner — owner check
  // suffices". Tracked separately from `designShareCode` (which is
  // the design's primary code surfaced for sharing) because a
  // design can have many active codes.
  const [sessionShareCode, setSessionShareCode] = useState<string | null>(null);
  // Mirror into a ref so the room-message handler (registered once
  // when the WebSocket opens) can read the LATEST value without
  // re-registering on every change. Specifically, the share-revoked
  // op handler checks "is the revoked code mine?" and needs the
  // up-to-date sessionShareCode rather than the value captured at
  // mount.
  const sessionShareCodeRef = useLatest(sessionShareCode);
  // Set when the session came in on a Community post's link (docs/specs/025-community/community.md
  // "Viewing a post's design"): the post and its author. Such a visitor never joins the room and
  // sees the Community bar instead of the identity prompt. Null for every other session.
  const [sessionCommunity, setSessionCommunity] = useState<CommunitySession | null>(null);
  // Owner, or a joined member of the design's team: see mayShareDesign.
  const canShareDesign = mayShareDesign({
    isOwner,
    teamId: designTeamId,
    sessionShareCode,
  });

  return {
    canShareDesign,
    sessionCommunity,
    setSessionCommunity,
    roomRef,
    designServerStored,
    setDesignServerStored,
    changesetSeen,
    designShareable,
    setDesignShareable,
    designTeamId,
    setDesignTeamId,
    designShareCode,
    setDesignShareCode,
    isOwner,
    setIsOwner,
    designOwnerId,
    setDesignOwnerId,
    designOwnerName,
    setDesignOwnerName,
    designOwnerColor,
    setDesignOwnerColor,
    copying,
    setCopying,
    passwordRetry,
    setPasswordRetry,
    sharePasswordGate,
    setSharePasswordGate,
    sessionRole,
    setSessionRole,
    sessionShareCode,
    setSessionShareCode,
    sessionShareCodeRef,
  };
}
