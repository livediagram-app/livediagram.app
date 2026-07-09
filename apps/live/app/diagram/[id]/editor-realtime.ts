import { useRef, useState } from 'react';

import { connectRoom, type ShareLink, type ShareRole } from '@/lib/api-client';
import { isYjsRealtimeEnabled } from '@/lib/yjs-flag';
import { YjsMirror } from '@/lib/yjs-mirror';

// Sharing, session-permission and realtime-room infrastructure for the
// editor: the shareable / team / share-code flags that decide whether
// the WebSocket room runs, the owner-vs-visitor identity + owner badge
// info, the share-link list + password, the granted session role +
// session share code, and the room/echo-guard refs. A cohesive slice
// lifted out of useEditorState — same pattern as usePanelLayout /
// usePresenceState.
//
// The room-presence VALUES (cursors, selections, laser trails) live in
// usePresenceState; this slice owns the gating + connection plumbing the
// hydration/bootstrap, autosave and room hooks read and write.
export function useEditorRealtime() {
  // `remoteUpdateRef` blocks the auto-save effect from re-broadcasting
  // a remote update back through the room (which would cause an
  // infinite save/broadcast loop between two connected clients).
  const remoteUpdateRef = useRef(false);
  // Single open room connection for the current diagram. Re-opens
  // whenever diagramId changes.
  const roomRef = useRef<ReturnType<typeof connectRoom> | null>(null);
  // Level 2 (spec/75): the shared Yjs doc mirror. Created once, only when
  // the experimental flag is on; null keeps the editor on the L0/L1 op path
  // with zero overhead. Lazy-init in a ref so the doc survives re-renders.
  const yjsMirrorRef = useRef<YjsMirror | null>(null);
  if (yjsMirrorRef.current === null && isYjsRealtimeEnabled()) {
    yjsMirrorRef.current = new YjsMirror();
  }
  // Sharing state for the current diagram. Mirrors the API row's
  // `shareable` + `shareCode` columns; refreshed on hydration, and
  // after share / unshare. Drives whether realtime (WS room) is
  // active.
  const [diagramShareable, setDiagramShareable] = useState(false);
  // Team library placement (spec/35): non-null when the diagram lives
  // in a team's shared library. Drives the header badge's "Team"
  // state (shareable still wins with "Shared").
  const [diagramTeamId, setDiagramTeamId] = useState<string | null>(null);
  // The legacy single share code (back-compat fallback for older
  // diagrams that haven't been migrated to share_links yet, and for
  // visitor arrivals that came in via the legacy URL flow). Modern
  // diagrams populate shareLinks instead.
  const [diagramShareCode, setDiagramShareCode] = useState<string | null>(null);
  // True for the owner of the loaded diagram; false for visitors who
  // arrived via /live/diagram/shared?s=<code>. Drives whether the
  // Share button shows.
  const [isOwner, setIsOwner] = useState(true);
  // The diagram's owner id (from the api fetch). Used to derive the
  // owner badge at the top of the canvas: when the owner is currently
  // in the room their full Participant row is in `livePresence` and we
  // can show avatar + name; otherwise the badge shows just the role
  // strip (Viewing / Editing) and skips the owner row entirely.
  const [diagramOwnerId, setDiagramOwnerId] = useState<string | null>(null);
  // Owner display info from the diagram fetch (api worker joins
  // participants on diagram.ownerId). Lets the top-middle Owner badge
  // render for visitors even when the owner isn't currently in the
  // realtime room — livePresence would otherwise be empty, and the
  // badge would hide.
  const [diagramOwnerName, setDiagramOwnerName] = useState<string | null>(null);
  const [diagramOwnerColor, setDiagramOwnerColor] = useState<string | null>(null);
  // Visitor-side "Make a copy" loading flag. Header button disables
  // itself while the api round-trips so a frantic double-click can't
  // produce two copies under the user's account.
  const [copying, setCopying] = useState(false);
  // Every active share link for the current diagram (owner-only). The
  // ShareDialog list renders straight off this array. shareable is
  // derived: shareLinks.length > 0 OR diagramShareable from a freshly
  // loaded row.
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  // The diagram's optional share password (spec/24), owner-only. Null
  // when unset. The ShareDialog shows + edits this in the clear.
  const [sharePassword, setSharePassword] = useState<string | null>(null);
  // `passwordRetry` bumps to re-run the bootstrap once the visitor
  // submits a password (see the bootstrap effect deps).
  const [passwordRetry, setPasswordRetry] = useState(0);
  // Viewer-side password gate. Non-null when the visitor's share URL
  // points at a password-protected diagram and they haven't supplied a
  // valid password yet. Read early by the preferences + capabilities
  // gates.
  const [sharePasswordGate, setSharePasswordGate] = useState<{ invalid: boolean } | null>(null);
  // The role granted to the current session. Owners always have 'edit';
  // visitors get whatever role their share code carried. Drives the
  // save / op-broadcast gates so view-only visitors can't push edits.
  const [sessionRole, setSessionRole] = useState<ShareRole>('edit');
  // Visitors are admitted via a share code in the URL (?s=<code>).
  // Owners arrive via ?d=<id> with no share code. The log endpoints
  // accept the code as a fallback authorisation so edit visitors can
  // persist their own entries; null means "owner — owner check
  // suffices". Tracked separately from `diagramShareCode` (which is
  // the diagram's primary code surfaced for sharing) because a
  // diagram can have many active codes.
  const [sessionShareCode, setSessionShareCode] = useState<string | null>(null);
  // Mirror into a ref so the room-message handler (registered once
  // when the WebSocket opens) can read the LATEST value without
  // re-registering on every change. Specifically, the share-revoked
  // op handler checks "is the revoked code mine?" and needs the
  // up-to-date sessionShareCode rather than the value captured at
  // mount.
  const sessionShareCodeRef = useRef(sessionShareCode);
  sessionShareCodeRef.current = sessionShareCode;

  return {
    remoteUpdateRef,
    roomRef,
    yjsMirrorRef,
    diagramShareable,
    setDiagramShareable,
    diagramTeamId,
    setDiagramTeamId,
    diagramShareCode,
    setDiagramShareCode,
    isOwner,
    setIsOwner,
    diagramOwnerId,
    setDiagramOwnerId,
    diagramOwnerName,
    setDiagramOwnerName,
    diagramOwnerColor,
    setDiagramOwnerColor,
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
