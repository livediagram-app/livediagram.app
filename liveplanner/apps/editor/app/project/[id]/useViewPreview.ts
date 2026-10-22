import { useState } from 'react';
import type { AccessLevel, ShareRole } from '@liveplanner/api-schema';
import { ADDER_KEY_LENGTH } from '@liveplanner/project';
import { debugLog } from '@/lib/debug-log';

// The role pill's toggle (docs/specs/007-editor/editor-app.md#role-pill): someone whose role allows editing can preview
// the project as a Participant or as a Viewer, a press stepping Editing, Participating, Viewing and back to Editing.
// Local to this tab and visit; the session role itself, which presence reports, never changes. `canEdit` is the one
// answer to "may this person edit right now?": the editor's read-only guard and the mode switch both read it
// (docs/specs/007-editor/editor-modes.md "The mode switch").
const NEXT: Record<AccessLevel, AccessLevel> = {
  edit: 'participate',
  participate: 'view',
  view: 'edit',
};

export function useViewPreview(sessionRole: ShareRole, onEnterPreview: () => void) {
  const [preview, setPreview] = useState<AccessLevel>('edit');
  const canToggleRole = sessionRole === 'edit';
  const toggleViewPreview = () => {
    if (!canToggleRole) return;
    const next = NEXT[preview];
    debugLog('[role] preview', next);
    // No edit toolbar, open editor or selection of another's element may linger into a narrower role.
    if (next !== 'edit') onEnterPreview();
    setPreview(next);
  };
  // The level in force: the session's, narrowed by the preview.
  const previewLevel: AccessLevel = canToggleRole ? preview : sessionRole;
  return {
    // Previewing a narrower role than the session's (a Participant's or a Viewer's).
    viewPreview: canToggleRole && preview !== 'edit',
    previewLevel,
    canToggleRole,
    toggleViewPreview,
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
