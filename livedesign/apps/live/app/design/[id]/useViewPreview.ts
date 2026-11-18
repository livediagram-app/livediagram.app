import { useMemo, useState } from 'react';
import type { AccessLevel, ShareRole } from '@livedesign/api-schema';
import { ADDER_KEY_LENGTH } from '@livedesign/design';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import {
  EDITING_MODES,
  editingModes,
  nextEditingMode,
} from '@liveworkspace/workbench/lib/editing-mode';

// The Editing Mode button's preview (docs/specs/007-editor/live-app.md#role-pill, Work Tracker 1291): someone may
// preview the design as each role below their own, a press stepping down from their real role and back round to it (an
// Editor: Editor, Participant, Viewer; a Participant: Participant, Viewer). A Viewer has nothing to preview.
// Local to this tab and visit; the session role itself, which presence reports, never changes. `canEdit` is the one
// answer to "may this person edit right now?": the editor's read-only guard reads it.

// The modes this app offers, widest first: every one.
export const PREVIEW_MODES: readonly AccessLevel[] = EDITING_MODES;

export function useViewPreview(sessionRole: ShareRole, onEnterPreview: () => void) {
  // The previewed mode, or null for the session's own role.
  const [preview, setPreview] = useState<AccessLevel | null>(null);
  // The modes this session may take, from its own role down (the Editing Mode button's steps).
  const previewModes = useMemo(
    () => editingModes<AccessLevel>(sessionRole, PREVIEW_MODES),
    [sessionRole],
  );
  // An Editor's session: the Participant preview stamps what it adds with a key of its own (previewAdderKey).
  const canToggleRole = sessionRole === 'edit';
  // The level in force: the preview while this session may take it, else the session's own role.
  const previewLevel: AccessLevel =
    preview !== null && previewModes.includes(preview) ? preview : sessionRole;
  // Straight to a level (the Editing Mode button's press), one this session may take.
  const setViewPreview = (next: AccessLevel) => {
    if (!previewModes.includes(next) || next === previewLevel) return;
    debugLog('[role] preview', next);
    // No edit toolbar, open editor or selection of another's element may linger into a narrower role.
    if (next !== 'edit') onEnterPreview();
    setPreview(next);
  };
  // One step down, wrapping back to the session's own role.
  const toggleViewPreview = () => {
    const next = nextEditingMode(previewLevel, previewModes);
    if (next) setViewPreview(next);
  };
  return {
    // Previewing a narrower role than the session's.
    viewPreview: previewLevel !== sessionRole,
    previewLevel,
    previewModes,
    canToggleRole,
    toggleViewPreview,
    setViewPreview,
    canEdit: previewLevel === 'edit',
  };
}

// The adder key an Editor's Participant preview stamps what it adds with: its own, so the preview may move, rewrite and
// delete what it added and nothing else, as a Participant may. Shaped as the room mints one (ADDER_KEY_LENGTH hex
// characters), since the Participant rule refuses an add whose stamp is not a valid key; random for this visit, so it
// matches no real Participant's and, being saved on what it adds, carries nothing of the person's own id.
let previewKey: string | null = null;
export function previewAdderKey(): string {
  if (previewKey === null) {
    const bytes = crypto.getRandomValues(new Uint8Array(ADDER_KEY_LENGTH / 2));
    previewKey = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return previewKey;
}
