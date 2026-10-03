import { useRef, useState } from 'react';

import { connectRoom, type ShareLink, type ShareRole } from '@/lib/api-client';
import { useLatest } from '@/hooks/ui/useLatest';

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
export function useEditorRealtime() {
  // Single open room connection for the current document. Re-opens
  // whenever documentId changes.
  const roomRef = useRef<ReturnType<typeof connectRoom> | null>(null);
  // Sharing state for the current document. Mirrors the API row's
  // `shareable` + `shareCode` columns; refreshed on hydration, and
  // after share / unshare. Drives whether realtime (WS room) is
  // active.
  const [documentShareable, setDocumentShareable] = useState(false);
  // Team library placement (docs/specs/013-workspace/team-shared-documents.md): non-null when the document lives
  // in a team's shared library. Drives the header badge's "Team"
  // state (shareable still wins with "Shared").
  const [documentTeamId, setDocumentTeamId] = useState<string | null>(null);
  // The legacy single share code (back-compat fallback for older
  // documents that haven't been migrated to share_links yet, and for
  // visitor arrivals that came in via the legacy URL flow). Modern
  // documents populate shareLinks instead.
  const [documentShareCode, setDocumentShareCode] = useState<string | null>(null);
  // True for the owner of the loaded document; false for visitors who
  // arrived via /live/document/shared?s=<code>. Drives whether the
  // Share button shows.
  const [isOwner, setIsOwner] = useState(true);
  // The document's owner id (from the api fetch). Used to derive the
  // owner badge at the top of the canvas: when the owner is currently
  // in the room their full Participant row is in `livePresence` and we
  // can show avatar + name; otherwise the badge shows just the role
  // strip (Viewing / Editing) and skips the owner row entirely.
  const [documentOwnerId, setDocumentOwnerId] = useState<string | null>(null);
  // Owner display info from the document fetch (api worker joins
  // participants on document.ownerId). Lets the top-middle Owner badge
  // render for visitors even when the owner isn't currently in the
  // realtime room — livePresence would otherwise be empty, and the
  // badge would hide.
  const [documentOwnerName, setDocumentOwnerName] = useState<string | null>(null);
  const [documentOwnerColor, setDocumentOwnerColor] = useState<string | null>(null);
  // Visitor-side "Make a copy" loading flag. Header button disables
  // itself while the api round-trips so a frantic double-click can't
  // produce two copies under the user's account.
  const [copying, setCopying] = useState(false);
  // Every active share link for the current document (owner-only). The
  // ShareDialog list renders straight off this array. shareable is
  // derived: shareLinks.length > 0 OR documentShareable from a freshly
  // loaded row.
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  // The document's optional share password (docs/specs/013-workspace/share-password.md), owner-only. Null
  // when unset. The ShareDialog shows + edits this in the clear.
  const [sharePassword, setSharePassword] = useState<string | null>(null);
  // `passwordRetry` bumps to re-run the bootstrap once the visitor
  // submits a password (see the bootstrap effect deps).
  const [passwordRetry, setPasswordRetry] = useState(0);
  // Viewer-side password gate. Non-null when the visitor's share URL
  // points at a password-protected document and they haven't supplied a
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
  // suffices". Tracked separately from `documentShareCode` (which is
  // the document's primary code surfaced for sharing) because a
  // document can have many active codes.
  const [sessionShareCode, setSessionShareCode] = useState<string | null>(null);
  // Mirror into a ref so the room-message handler (registered once
  // when the WebSocket opens) can read the LATEST value without
  // re-registering on every change. Specifically, the share-revoked
  // op handler checks "is the revoked code mine?" and needs the
  // up-to-date sessionShareCode rather than the value captured at
  // mount.
  const sessionShareCodeRef = useLatest(sessionShareCode);

  return {
    roomRef,
    documentShareable,
    setDocumentShareable,
    documentTeamId,
    setDocumentTeamId,
    documentShareCode,
    setDocumentShareCode,
    isOwner,
    setIsOwner,
    documentOwnerId,
    setDocumentOwnerId,
    documentOwnerName,
    setDocumentOwnerName,
    documentOwnerColor,
    setDocumentOwnerColor,
    copying,
    setCopying,
    shareLinks,
    setShareLinks,
    sharePassword,
    setSharePassword,
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
