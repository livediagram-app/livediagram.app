import { useState } from 'react';
import type { AccessLevel, ShareRole } from '@livediagram/api-schema';
import { debugLog } from '@/lib/debug-log';

// The role pill's toggle (docs/specs/007-editor/live-app.md#role-pill): someone whose role allows editing can preview
// the document as a Participant or as a Viewer, a press stepping Editing, Participating, Viewing and back to Editing.
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
// delete what it added and nothing else, as a Participant may. No real Participant's key matches it.
export function previewAdderKey(selfId: string): string {
  return `preview-${selfId}`;
}
