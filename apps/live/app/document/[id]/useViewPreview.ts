import { useState } from 'react';
import type { ShareRole } from '@livediagram/api-schema';
import { debugLog } from '@/lib/debug-log';

// The role pill's toggle (docs/specs/007-editor/live-app.md#role-pill): someone whose role allows
// editing can preview the document read-only. Local to this tab and visit; the
// session role itself, which presence reports, never changes. `canEdit` is the one answer to
// "may this person edit right now?": the editor's read-only guard and the tab bar's mode switch
// both read it (docs/specs/007-editor/editor-modes.md "The mode switch").
export function useViewPreview(sessionRole: ShareRole, onEnterPreview: () => void) {
  const [viewPreview, setViewPreview] = useState(false);
  const canToggleRole = sessionRole === 'edit';
  const toggleViewPreview = () => {
    if (!canToggleRole) return;
    const next = !viewPreview;
    debugLog('[role] view preview', next);
    // No edit toolbar or open editor may linger into viewing.
    if (next) onEnterPreview();
    setViewPreview(next);
  };
  const previewing = canToggleRole && viewPreview;
  return {
    viewPreview: previewing,
    canToggleRole,
    toggleViewPreview,
    canEdit: sessionRole === 'edit' && !previewing,
  };
}
